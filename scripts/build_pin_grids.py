#!/usr/bin/env python3
"""Generate pre-baked land-masked pin-field grids for /kekeringan/relief/ from 514 BPS polygons."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
GEOJSON_PATH = ROOT / "web" / "public" / "mock-data" / "jateng-regions.geojson"
DATASET_PATH = ROOT / "web" / "public" / "mock-data" / "jateng-drought-36m.json"
OUT_DIR = ROOT / "web" / "public" / "relief-data"

PRESETS: list[dict[str, Any]] = [
    {
        "id": "indonesia",
        "label": "Indonesia (Nusantara)",
        "label_en": "Indonesia (Archipelago)",
        "prov_prefixes": None,
        "step_deg": 0.13,
        "bbox_override": [95.0, -11.1, 141.1, 6.2],
        "anchors": [
            {"name": "Medan", "lon": 98.6722, "lat": 3.5952},
            {"name": "Jakarta", "lon": 106.8456, "lat": -6.2088},
            {"name": "Semarang", "lon": 110.4203, "lat": -6.9932},
            {"name": "Surabaya", "lon": 112.7521, "lat": -7.2575},
            {"name": "Balikpapan", "lon": 116.8312, "lat": -1.2379},
            {"name": "Makassar", "lon": 119.4327, "lat": -5.1477},
            {"name": "Kupang", "lon": 123.6070, "lat": -10.1772},
            {"name": "Jayapura", "lon": 140.7181, "lat": -2.5916},
        ],
    },
    {
        "id": "jawa",
        "label": "Jawa & Bali",
        "label_en": "Java & Bali",
        "prov_prefixes": {"31", "32", "33", "34", "35", "36", "51"},
        "step_deg": 0.045,
        "bbox_override": None,
        "anchors": [
            {"name": "Jakarta", "lon": 106.8456, "lat": -6.2088},
            {"name": "Bandung", "lon": 107.6191, "lat": -6.9175},
            {"name": "Semarang", "lon": 110.4203, "lat": -6.9932},
            {"name": "Yogyakarta", "lon": 110.3695, "lat": -7.7956},
            {"name": "Surabaya", "lon": 112.7521, "lat": -7.2575},
            {"name": "Malang", "lon": 112.6304, "lat": -7.9666},
            {"name": "Denpasar", "lon": 115.2126, "lat": -8.6705},
        ],
    },
    {
        "id": "jateng",
        "label": "Jateng & DIY",
        "label_en": "Central Java & DIY",
        "prov_prefixes": {"33", "34"},
        "step_deg": 0.025,
        "bbox_override": None,
        "anchors": [
            {"name": "Tegal", "lon": 109.1402, "lat": -6.8694},
            {"name": "Semarang", "lon": 110.4203, "lat": -6.9932},
            {"name": "Magelang · Bompon", "lon": 110.2177, "lat": -7.4797},
            {"name": "Yogyakarta", "lon": 110.3695, "lat": -7.7956},
            {"name": "Solo", "lon": 110.8243, "lat": -7.5755},
            {"name": "Wonogiri", "lon": 110.9250, "lat": -7.8150},
            {"name": "Cilacap", "lon": 109.0154, "lat": -7.7279},
        ],
    },
    {
        "id": "sumatera",
        "label": "Sumatera",
        "label_en": "Sumatra",
        "prov_prefixes": {"11", "12", "13", "14", "15", "16", "17", "18", "19", "21"},
        "step_deg": 0.075,
        "bbox_override": None,
        "anchors": [
            {"name": "Banda Aceh", "lon": 95.3238, "lat": 5.5483},
            {"name": "Medan", "lon": 98.6722, "lat": 3.5952},
            {"name": "Padang", "lon": 100.3543, "lat": -0.9471},
            {"name": "Pekanbaru", "lon": 101.4478, "lat": 0.5071},
            {"name": "Palembang", "lon": 104.7754, "lat": -2.9761},
            {"name": "Bandar Lampung", "lon": 105.2667, "lat": -5.3971},
        ],
    },
    {
        "id": "ntt_bali",
        "label": "Bali & Nusa Tenggara",
        "label_en": "Bali & Nusa Tenggara",
        "prov_prefixes": {"51", "52", "53"},
        "step_deg": 0.05,
        "bbox_override": None,
        "anchors": [
            {"name": "Denpasar", "lon": 115.2126, "lat": -8.6705},
            {"name": "Mataram", "lon": 116.1165, "lat": -8.5833},
            {"name": "Sumbawa", "lon": 117.4200, "lat": -8.4932},
            {"name": "Labuan Bajo", "lon": 119.8877, "lat": -8.4964},
            {"name": "Waingapu", "lon": 120.2641, "lat": -9.6567},
            {"name": "Kupang", "lon": 123.6070, "lat": -10.1772},
        ],
    },
    {
        "id": "kalimantan",
        "label": "Kalimantan",
        "label_en": "Kalimantan",
        "prov_prefixes": {"61", "62", "63", "64", "65"},
        "step_deg": 0.085,
        "bbox_override": None,
        "anchors": [
            {"name": "Pontianak", "lon": 109.3425, "lat": -0.0263},
            {"name": "Palangkaraya", "lon": 113.9213, "lat": -2.2136},
            {"name": "Banjarmasin", "lon": 114.5908, "lat": -3.3194},
            {"name": "Balikpapan", "lon": 116.8312, "lat": -1.2379},
            {"name": "Samarinda", "lon": 117.1536, "lat": -0.5022},
            {"name": "Tarakan", "lon": 117.5785, "lat": 3.3274},
        ],
    },
    {
        "id": "sulawesi",
        "label": "Sulawesi",
        "label_en": "Sulawesi",
        "prov_prefixes": {"71", "72", "73", "74", "75", "76"},
        "step_deg": 0.06,
        "bbox_override": None,
        "anchors": [
            {"name": "Manado", "lon": 124.8421, "lat": 1.4748},
            {"name": "Gorontalo", "lon": 123.0595, "lat": 0.5435},
            {"name": "Palu", "lon": 119.8707, "lat": -0.8917},
            {"name": "Kendari", "lon": 122.5151, "lat": -3.9985},
            {"name": "Makassar", "lon": 119.4327, "lat": -5.1477},
        ],
    },
]


def ring_bbox(ring: list[list[float]]) -> tuple[float, float, float, float]:
    xs = [pt[0] for pt in ring]
    ys = [pt[1] for pt in ring]
    return min(xs), min(ys), max(xs), max(ys)


def point_in_ring(x: float, y: float, ring: list[list[float]]) -> bool:
    inside = False
    n = len(ring)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-15) + xi):
            inside = not inside
        j = i
    return inside


class PolyPart:
    __slots__ = ("kode", "bbox", "outer", "holes")

    def __init__(self, kode: str, rings: list[list[list[float]]]) -> None:
        self.kode = kode
        self.outer = rings[0]
        self.holes = rings[1:]
        self.bbox = ring_bbox(self.outer)

    def contains(self, x: float, y: float) -> bool:
        minx, miny, maxx, maxy = self.bbox
        if x < minx or x > maxx or y < miny or y > maxy:
            return False
        if not point_in_ring(x, y, self.outer):
            return False
        for h in self.holes:
            if point_in_ring(x, y, h):
                return False
        return True


def build_parts(features: list[dict[str, Any]], valid_codes: set[str], prov_prefixes: set[str] | None) -> list[PolyPart]:
    parts: list[PolyPart] = []
    for feat in features:
        kode = str(feat.get("properties", {}).get("kode_bps", ""))
        if not kode or kode not in valid_codes:
            continue
        if prov_prefixes is not None and kode[:2] not in prov_prefixes:
            continue
        geom = feat.get("geometry") or {}
        gtype = geom.get("type")
        coords = geom.get("coordinates") or []
        if gtype == "Polygon" and coords:
            parts.append(PolyPart(kode, coords))
        elif gtype == "MultiPolygon" and coords:
            for poly in coords:
                if poly:
                    parts.append(PolyPart(kode, poly))
    return parts


def generate_preset(preset: dict[str, Any], features: list[dict[str, Any]], valid_codes: set[str]) -> dict[str, Any]:
    parts = build_parts(features, valid_codes, preset["prov_prefixes"])
    if not parts:
        raise RuntimeError(f"No polygon parts matched preset {preset['id']}")

    if preset["bbox_override"]:
        minx, miny, maxx, maxy = preset["bbox_override"]
    else:
        minx = min(p.bbox[0] for p in parts) - 0.03
        miny = min(p.bbox[1] for p in parts) - 0.03
        maxx = max(p.bbox[2] for p in parts) + 0.03
        maxy = max(p.bbox[3] for p in parts) + 0.03

    step = float(preset["step_deg"])
    ncols = max(1, int(math.ceil((maxx - minx) / step)))
    nrows = max(1, int(math.ceil((maxy - miny) / step)))

    # Spatial bucket index by row band to keep point-in-polygon build blazingly fast
    row_buckets: list[list[PolyPart]] = [[] for _ in range(nrows)]
    for p in parts:
        r0 = max(0, int((p.bbox[1] - miny) / step))
        r1 = min(nrows - 1, int((p.bbox[3] - miny) / step))
        for r in range(r0, r1 + 1):
            row_buckets[r].append(p)

    lons: list[float] = []
    lats: list[float] = []
    reg_idx: list[int] = []
    cols: list[int] = []
    rows: list[int] = []
    code_to_idx: dict[str, int] = {}
    codes: list[str] = []

    for r in range(nrows):
        lat = miny + (r + 0.5) * step
        cands = row_buckets[r]
        if not cands:
            continue
        for c in range(ncols):
            lon = minx + (c + 0.5) * step
            hit_kode = None
            for p in cands:
                if p.contains(lon, lat):
                    hit_kode = p.kode
                    break
            if hit_kode is None:
                continue
            idx = code_to_idx.get(hit_kode)
            if idx is None:
                idx = len(codes)
                code_to_idx[hit_kode] = idx
                codes.append(hit_kode)
            lons.append(round(lon, 4))
            lats.append(round(lat, 4))
            reg_idx.append(idx)
            cols.append(c)
            rows.append(r)

    return {
        "id": preset["id"],
        "label": preset["label"],
        "labelEn": preset["label_en"],
        "stepDeg": step,
        "spacingKm": round(step * 111.32, 1),
        "bbox": [round(minx, 4), round(miny, 4), round(maxx, 4), round(maxy, 4)],
        "pinCount": len(lons),
        "codes": codes,
        "lons": lons,
        "lats": lats,
        "regIdx": reg_idx,
        "cols": cols,
        "rows": rows,
        "anchors": preset["anchors"],
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    gj = json.loads(GEOJSON_PATH.read_text(encoding="utf-8"))
    ds = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    features = gj["features"]
    valid_codes = set(ds["regions"].keys())

    manifest: list[dict[str, Any]] = []
    for preset in PRESETS:
        grid = generate_preset(preset, features, valid_codes)
        out_path = OUT_DIR / f"grid-{preset['id']}.json"
        out_path.write_text(json.dumps(grid, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
        size_kb = round(out_path.stat().st_size / 1024.0, 1)
        manifest.append(
            {
                "id": grid["id"],
                "label": grid["label"],
                "labelEn": grid["labelEn"],
                "stepDeg": grid["stepDeg"],
                "spacingKm": grid["spacingKm"],
                "pinCount": grid["pinCount"],
                "regionCount": len(grid["codes"]),
                "bbox": grid["bbox"],
                "sizeKb": size_kb,
            }
        )
        print(f"Built {preset['id']:10s}: {grid['pinCount']:5d} pins | {len(grid['codes']):3d} kab/kota | {grid['spacingKm']:4.1f} km | {size_kb:5.1f} KB")

    (OUT_DIR / "presets.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
