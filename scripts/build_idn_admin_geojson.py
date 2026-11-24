"""Build real 514-Kabupaten/Kota national GeoJSON and 36-month drought dataset from local COD-AB GDB."""

import json
import math
from pathlib import Path
from typing import Any

import geopandas as gpd

GDB_URI = (
    "zip://D:/GIS_DATA/Cikande_PMT_LandChange_V3/01_RAW/ancillary/"
    "cod_ab_idn/idn_admin_boundaries.gdb.zip"
)
LAYER_NAME = "idn_admin2"

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "web" / "public" / "mock-data"
OUT_GEOJSON = OUT_DIR / "jateng-regions.geojson"
OUT_TS = OUT_DIR / "jateng-drought-36m.json"

PILOT_META: dict[str, dict[str, Any]] = {
    "3329": {"das": "Pemali", "mean_slope_deg": 7.4, "linked_panen_field_id": None},
    "3321": {"das": "Jratunseluna Hilir", "mean_slope_deg": 1.2, "linked_panen_field_id": None},
    "3315": {"das": "Lusi–Serang", "mean_slope_deg": 4.5, "linked_panen_field_id": None},
    "3308": {"das": "Progo Tengah / DAS Bompon", "mean_slope_deg": 16.5, "linked_panen_field_id": "bompon-magelang"},
    "3310": {"das": "Opak–Bengawan Solo", "mean_slope_deg": 4.8, "linked_panen_field_id": "klaten-irigasi"},
    "3312": {"das": "Bengawan Solo Hulu", "mean_slope_deg": 14.2, "linked_panen_field_id": None},
    "3306": {"das": "Bogowonto", "mean_slope_deg": 12.1, "linked_panen_field_id": None},
    "3305": {"das": "Luk Ulo", "mean_slope_deg": 10.8, "linked_panen_field_id": None},
    "3404": {"das": "Progo–Opak Lintas Provinsi", "mean_slope_deg": 8.6, "linked_panen_field_id": None},
    "3401": {"das": "Progo Hilir–Serang", "mean_slope_deg": 11.4, "linked_panen_field_id": None},
    "3402": {"das": "Opak Hilir", "mean_slope_deg": 3.1, "linked_panen_field_id": None},
    "3403": {"das": "Karst Sewu–Oyo", "mean_slope_deg": 15.6, "linked_panen_field_id": None},
}


def round_coords(obj: Any, precision: int = 4) -> Any:
    if isinstance(obj, float):
        return round(obj, precision)
    if isinstance(obj, (list, tuple)):
        return [round_coords(item, precision) for item in obj]
    if isinstance(obj, dict):
        return {k: round_coords(v, precision) for k, v in obj.items()}
    return obj


def clean_provinsi(raw: str) -> str:
    s = (raw or "").strip()
    if s == "Daerah Istimewa Yogyakarta":
        return "D.I. Yogyakarta"
    return s


def infer_climate_zone(lat: float, lon: float) -> str:
    # BMKG 3 zona hujan: Monsunal (Jawa/Bali/Nusra/Lampung), Ekuatorial (Sumatera/Kalimantan), Lokal (Sulawesi/Maluku/Papua)
    if lon >= 118.5 and lat > -8.2:
        return "lokal"
    if lat > -5.5 and lon < 118.5:
        return "ekuatorial"
    return "monsunal"


def generate_months(n: int = 36, end_ym: str = "2026-11") -> list[str]:
    y, m = map(int, end_ym.split("-"))
    out: list[str] = []
    for i in range(n - 1, -1, -1):
        total = y * 12 + (m - 1) - i
        yy, mm0 = divmod(total, 12)
        out.append(f"{yy:04d}-{mm0 + 1:02d}")
    return out


def classify_status(pdlvi: float, spi3: float, vhi: float) -> str:
    if pdlvi >= 0.78 or spi3 <= -2.1 or vhi < 26.0:
        return "ekstrem"
    if pdlvi >= 0.62 or spi3 <= -1.6 or vhi < 34.0:
        return "parah"
    if pdlvi >= 0.48 or spi3 <= -1.1 or vhi < 42.0:
        return "moderat"
    if pdlvi >= 0.34 or spi3 <= -0.6 or vhi < 50.0:
        return "waspada"
    return "normal"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    df = gpd.read_file(GDB_URI, layer=LAYER_NAME)
    if df.crs is not None and df.crs.to_epsg() != 4326:
        df = df.to_crs(epsg=4326)

    # Filter out non-administrative waterbodies/forests
    mask_non_admin = df["adm2_name"].astype(str).str.contains(r"Hutan|Wadung|Waduk|Danau", case=False, na=False)
    adm = df[~mask_non_admin].copy().reset_index(drop=True)
    if len(adm) != 514:
        raise RuntimeError(f"Expected 514 real Kabupaten/Kota, got {len(adm)}")

    # Ensure valid geometries before simplifying
    invalid_mask = ~adm.geometry.is_valid
    if invalid_mask.any():
        adm.loc[invalid_mask, "geometry"] = adm.loc[invalid_mask, "geometry"].buffer(0)

    is_pilot = adm["adm1_pcode"].astype(str).isin(["ID33", "ID34"])
    adm.loc[is_pilot, "geometry"] = adm.loc[is_pilot, "geometry"].simplify(0.0018, preserve_topology=True)
    adm.loc[~is_pilot, "geometry"] = adm.loc[~is_pilot, "geometry"].simplify(0.006, preserve_topology=True)
    adm = adm[~adm.geometry.is_empty].copy()

    months = generate_months(36, "2026-11")
    features: list[dict[str, Any]] = []
    regions_ts: dict[str, Any] = {}
    jateng_min_verts = 999999

    for idx, row in adm.iterrows():
        raw_pcode = str(row["adm2_pcode"]).strip()
        kode_bps = raw_pcode[2:] if raw_pcode.startswith("ID") else raw_pcode
        raw_name = str(row["adm2_name"]).strip()
        nama = raw_name if raw_name.lower().startswith("kota ") else f"Kab. {raw_name}"
        if kode_bps == "3308":
            nama = "Kab. Magelang (DAS Bompon)"
        provinsi = clean_provinsi(str(row["adm1_name"]))
        lon = float(row["center_lon"]) if row["center_lon"] is not None else float(row.geometry.centroid.x)
        lat = float(row["center_lat"]) if row["center_lat"] is not None else float(row.geometry.centroid.y)

        pilot_info = PILOT_META.get(kode_bps)
        if pilot_info:
            das = pilot_info["das"]
            slope = float(pilot_info["mean_slope_deg"])
            linked_field = pilot_info["linked_panen_field_id"]
        else:
            das = f"DAS {provinsi.split()[0]}"
            slope = round(2.5 + ((int(kode_bps) * 17) % 150) / 10.0, 1)
            linked_field = None

        geom_json = round_coords(row.geometry.__geo_interface__, 4)
        # Count vertices on Jateng/DIY polygons
        if kode_bps.startswith(("33", "34")):
            verts = sum(
                len(ring)
                for poly in (geom_json["coordinates"] if geom_json["type"] == "MultiPolygon" else [geom_json["coordinates"]])
                for ring in poly
            )
            jateng_min_verts = min(jateng_min_verts, verts)

        features.append(
            {
                "type": "Feature",
                "properties": {
                    "kode_bps": kode_bps,
                    "nama": nama,
                    "provinsi": provinsi,
                    "das": das,
                    "mean_slope_deg": slope,
                    "centroid": [round(lon, 4), round(lat, 4)],
                    "linked_panen_field_id": linked_field,
                },
                "geometry": geom_json,
            }
        )

        # Deterministic climate-zone series across 36 months
        zone = infer_climate_zone(lat, lon)
        seed = (int(kode_bps) % 97) / 97.0
        series: list[dict[str, Any]] = []
        for m_i, ym in enumerate(months):
            mo = int(ym.split("-")[1])
            phase = 0.0 if zone == "monsunal" else (1.7 if zone == "ekuatorial" else 3.1)
            seasonal = math.cos(((mo - 8.5 + phase) / 12.0) * 2.0 * math.pi)
            # Peak dry / El Nino pulse around early-mid 2024 (m_i 2..11) + moderate late-2026 pulse (m_i 31..35)
            enso_pulse = -1.05 * math.exp(-((m_i - 8) ** 2) / 18.0) - 0.55 * math.exp(-((m_i - 34) ** 2) / 10.0)
            if zone == "ekuatorial":
                enso_pulse *= 0.65

            spi3 = round(max(-2.6, min(2.0, -0.15 + 0.72 * seasonal + 0.85 * enso_pulse + (seed - 0.5) * 0.55)), 2)
            # SSMA & VHI lag rainfall anomalies cleanly
            ssma = round(max(-2.4, min(1.8, 0.78 * spi3 - 0.015 * slope + 0.12 * math.sin(m_i / 3.0 + seed))), 2)
            vhi = round(max(18.0, min(78.0, 51.0 + 11.5 * ssma - 0.25 * slope + (seed - 0.5) * 6.0)), 1)
            veg_stress = max(0.0, min(1.0, (100.0 - vhi) / 100.0))
            soil_stress = max(0.0, min(1.0, -ssma / 2.8))
            met_stress = max(0.0, min(1.0, -spi3 / 2.8))
            pdlvi = round(
                max(0.08, min(0.96, (0.35 * veg_stress + 0.40 * soil_stress + 0.25 * met_stress) * (1.0 + 0.014 * min(slope, 25.0)))),
                2,
            )
            series.append(
                {
                    "ym": ym,
                    "spi3": spi3,
                    "ssma": ssma,
                    "vhi": vhi,
                    "pdlvi": pdlvi,
                    "status": classify_status(pdlvi, spi3, vhi),
                }
            )

        last_pt = series[-1]
        reg_entry: dict[str, Any] = {
            "kode_bps": kode_bps,
            "nama": nama,
            "provinsi": provinsi,
            "das": das,
            "centroid": [round(lon, 4), round(lat, 4)],
            "mean_slope_deg": slope,
            "updated_at": "2026-11-24T00:00:00Z",
            "series": series,
            "executive_brief_id": (
                f"{nama} ({provinsi}, zona {zone}, lereng {slope}°) mencatat SPI-3 {last_pt['spi3']}, "
                f"SSMA {last_pt['ssma']}, VHI {last_pt['vhi']}, dan PDLVI {last_pt['pdlvi']} ({last_pt['status']})."
            ),
        }
        if linked_field:
            reg_entry["linked_panen_field_id"] = linked_field
        regions_ts[kode_bps] = reg_entry

    fc = {"type": "FeatureCollection", "features": features}
    ts_payload = {
        "is_simulated": True,
        "generated_at": "2026-11-24T00:00:00Z",
        "months": months,
        "regions": regions_ts,
    }

    OUT_GEOJSON.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    OUT_TS.write_text(json.dumps(ts_payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(
        f"BUILT features={len(features)} regions={len(regions_ts)} "
        f"jateng_min_verts={jateng_min_verts} "
        f"geojson_kb={OUT_GEOJSON.stat().st_size / 1024:.1f} "
        f"ts_kb={OUT_TS.stat().st_size / 1024:.1f}"
    )


if __name__ == "__main__":
    main()
