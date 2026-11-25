"""Export & pack quantized Int8 3D pin-field cubes (`PIN1` binary spec) from CHIRPS / mock baselines."""

from __future__ import annotations

import argparse
import json
import math
import struct
from pathlib import Path
from typing import Any, Sequence

PIN1_MAGIC = b"PIN1"
NODATA_I8 = -128


def quantize_value(val: float | None, scale_min: float, scale_max: float) -> int:
    """Quantize a float into signed Int8 [-127..+127] with -128 reserved for nodata."""
    if val is None or math.isnan(val) or math.isinf(val):
        return NODATA_I8
    span = max(scale_max - scale_min, 1e-9)
    t = max(0.0, min(1.0, (val - scale_min) / span))
    q = int(round(t * 254.0 - 127.0))
    return max(-127, min(127, q))


def dequantize_value(q: int, scale_min: float, scale_max: float) -> float | None:
    """Invert Int8 quantization back into physical scale."""
    if q == NODATA_I8:
        return None
    t = (q + 127.0) / 254.0
    return scale_min + t * (scale_max - scale_min)


def pack_pinbin(
    meta: dict[str, Any],
    lons: Sequence[float],
    lats: Sequence[float],
    frames: Sequence[Sequence[float | None]],
) -> bytes:
    """
    Pack a time-series pin grid into `PIN1` binary format:
      [4B magic 'PIN1'][4B uint32 LE metaLen][meta JSON UTF-8]
      [pinCount * float32 lons][pinCount * float32 lats]
      [T * pinCount * int8 quantized values]
    """
    pin_count = len(lons)
    if len(lats) != pin_count:
        raise ValueError("lons and lats lengths must match")
    scale_min = float(meta.get("scale_min", -3.0))
    scale_max = float(meta.get("scale_max", 3.0))
    full_meta = {
        **meta,
        "pin_count": pin_count,
        "time_count": len(frames),
        "scale_min": scale_min,
        "scale_max": scale_max,
    }
    meta_bytes = json.dumps(full_meta, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

    header = bytearray()
    header.extend(PIN1_MAGIC)
    header.extend(struct.pack("<I", len(meta_bytes)))
    header.extend(meta_bytes)

    coords_buf = bytearray()
    coords_buf.extend(struct.pack(f"<{pin_count}f", *[float(x) for x in lons]))
    coords_buf.extend(struct.pack(f"<{pin_count}f", *[float(y) for y in lats]))

    vals_buf = bytearray()
    for frame in frames:
        if len(frame) != pin_count:
            raise ValueError(f"frame length {len(frame)} != pin_count {pin_count}")
        q_row = [quantize_value(v, scale_min, scale_max) for v in frame]
        vals_buf.extend(struct.pack(f"<{pin_count}b", *q_row))

    return bytes(header + coords_buf + vals_buf)


def unpack_pinbin(blob: bytes) -> tuple[dict[str, Any], list[float], list[float], list[list[float | None]]]:
    """Decode `PIN1` binary cube back into metadata, coordinates, and dequantized frames."""
    if len(blob) < 8 or blob[:4] != PIN1_MAGIC:
        raise ValueError("Invalid PIN1 header magic")
    meta_len = struct.unpack("<I", blob[4:8])[0]
    meta_end = 8 + meta_len
    meta = json.loads(blob[8:meta_end].decode("utf-8"))
    pin_count = int(meta["pin_count"])
    time_count = int(meta["time_count"])
    scale_min = float(meta["scale_min"])
    scale_max = float(meta["scale_max"])

    pos = meta_end
    f32_bytes = pin_count * 4
    lons = list(struct.unpack(f"<{pin_count}f", blob[pos : pos + f32_bytes]))
    pos += f32_bytes
    lats = list(struct.unpack(f"<{pin_count}f", blob[pos : pos + f32_bytes]))
    pos += f32_bytes

    frames: list[list[float | None]] = []
    for _ in range(time_count):
        raw_i8 = struct.unpack(f"<{pin_count}b", blob[pos : pos + pin_count])
        pos += pin_count
        frames.append([dequantize_value(q, scale_min, scale_max) for q in raw_i8])

    return meta, lons, lats, frames


def build_dry_run_pinbin(grid_json_path: Path, dataset_json_path: Path, metric: str = "spi3") -> bytes:
    """Create a `.pinbin` cube from a pre-baked grid JSON and 36-month regional dataset."""
    grid = json.loads(grid_json_path.read_text(encoding="utf-8"))
    ds = json.loads(dataset_json_path.read_text(encoding="utf-8"))
    months: list[str] = ds["months"]
    codes: list[str] = grid["codes"]
    reg_idx: list[int] = grid["regIdx"]
    regions = ds["regions"]

    scale_bounds = {
        "spi3": (-3.0, 3.0),
        "ssma": (-3.0, 3.0),
        "vhi": (0.0, 100.0),
        "pdlvi": (0.0, 1.0),
    }
    scale_min, scale_max = scale_bounds.get(metric, (-3.0, 3.0))

    frames: list[list[float | None]] = []
    for m_idx in range(len(months)):
        frame_vals: list[float | None] = []
        for idx in reg_idx:
            kode = codes[idx]
            reg = regions.get(kode)
            if not reg or m_idx >= len(reg["series"]):
                frame_vals.append(None)
            else:
                frame_vals.append(float(reg["series"][m_idx][metric]))
        frames.append(frame_vals)

    meta = {
        "region": grid["id"],
        "label": grid["label"],
        "metric": metric,
        "source": "SIMULASI_514_MOCK" if ds.get("is_simulated", True) else "R2_OBSERVATION",
        "is_simulated": bool(ds.get("is_simulated", True)),
        "spacing_km": grid["spacingKm"],
        "step_deg": grid["stepDeg"],
        "bbox": grid["bbox"],
        "time_labels": months,
        "scale_min": scale_min,
        "scale_max": scale_max,
        "anchors": grid.get("anchors", []),
    }
    return pack_pinbin(meta, grid["lons"], grid["lats"], frames)


def export_gee_chirps_45y(
    grid_json_path: Path,
    out_pinbin_path: Path,
    start_year: int = 1981,
    end_year: int = 2025,
    gee_project: str = "",
) -> Path:
    """
    Extract real annual CHIRPS v2.0 SPI-12 (1981..end_year) over exact pin coordinates via GEE
    and save a compressed `.pinbin` cube for /kekeringan/relief/.
    """
    import ee  # type: ignore

    if gee_project.strip():
        ee.Initialize(project=gee_project.strip())
    else:
        ee.Initialize()

    grid = json.loads(grid_json_path.read_text(encoding="utf-8"))
    lons: list[float] = grid["lons"]
    lats: list[float] = grid["lats"]
    step_deg = float(grid["stepDeg"])
    scale_m = max(5000, int(round(step_deg * 111_320)))

    chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
    years = list(range(start_year, end_year + 1))

    # Build annual precipitation stack
    annual_imgs = []
    for y in years:
        img = (
            chirps.filterDate(f"{y}-01-01", f"{y + 1}-01-01")
            .select("precipitation")
            .sum()
            .rename(f"y{y}")
        )
        annual_imgs.append(img)

    stack = ee.Image.cat(annual_imgs)
    # Log-transformed standardized anomaly (SPI-12 proxy across 45-year baseline)
    log_stack = stack.add(1.0).log()
    mean_img = log_stack.reduce(ee.Reducer.mean())
    std_img = log_stack.reduce(ee.Reducer.stdDev()).max(0.05)
    spi_stack = log_stack.subtract(mean_img).divide(std_img).clamp(-3.0, 3.0)

    # Batch sample points in chunks of 1,500 to respect GEE payload limits
    frames: list[list[float | None]] = [[None] * len(lons) for _ in years]
    chunk_size = 1500
    for start in range(0, len(lons), chunk_size):
        end = min(len(lons), start + chunk_size)
        feats = [
            ee.Feature(ee.Geometry.Point([lons[i], lats[i]]), {"pid": i})
            for i in range(start, end)
        ]
        fc = ee.FeatureCollection(feats)
        sampled = spi_stack.reduceRegions(
            collection=fc,
            reducer=ee.Reducer.first(),
            scale=scale_m,
            tileScale=4,
        ).getInfo()
        for f in sampled.get("features", []):
            props = f.get("properties", {})
            pid = int(props["pid"])
            for yi, y in enumerate(years):
                val = props.get(f"y{y}")
                frames[yi][pid] = float(val) if val is not None else None

    meta = {
        "region": grid["id"],
        "label": grid["label"],
        "metric": "spi3",
        "cadence": "annual_spi12",
        "source": "UCSB-CHG/CHIRPS/DAILY (1981-2025)",
        "is_simulated": False,
        "spacing_km": grid["spacingKm"],
        "step_deg": step_deg,
        "bbox": grid["bbox"],
        "time_labels": [str(y) for y in years],
        "scale_min": -3.0,
        "scale_max": 3.0,
        "anchors": grid.get("anchors", []),
    }
    blob = pack_pinbin(meta, lons, lats, frames)
    out_pinbin_path.parent.mkdir(parents=True, exist_ok=True)
    out_pinbin_path.write_bytes(blob)
    return out_pinbin_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Build PIN1 binary cube for Drought in Control 3D Relief.")
    parser.add_argument("--grid", required=True, type=Path, help="Path to web/public/relief-data/grid-<id>.json")
    parser.add_argument("--out", required=True, type=Path, help="Output .pinbin file path")
    parser.add_argument("--dry-run", action="store_true", help="Pack from mock 36m dataset instead of calling GEE")
    parser.add_argument("--dataset", type=Path, default=Path("web/public/mock-data/jateng-drought-36m.json"))
    parser.add_argument("--metric", default="spi3", choices=["spi3", "ssma", "vhi", "pdlvi"])
    parser.add_argument("--start-year", type=int, default=1981)
    parser.add_argument("--end-year", type=int, default=2025)
    parser.add_argument("--gee-project", default="")
    args = parser.parse_args()

    if args.dry_run:
        blob = build_dry_run_pinbin(args.grid, args.dataset, metric=args.metric)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_bytes(blob)
        print(f"Dry-run PIN1 saved to {args.out} ({len(blob) / 1024:.1f} KB)")
    else:
        out_p = export_gee_chirps_45y(
            args.grid,
            args.out,
            start_year=args.start_year,
            end_year=args.end_year,
            gee_project=args.gee_project,
        )
        print(f"GEE CHIRPS PIN1 saved to {out_p} ({out_p.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
