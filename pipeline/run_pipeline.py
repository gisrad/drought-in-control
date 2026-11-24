"""CLI entry point for drought-in-control pipeline (`--dry-run` safe for offline CI)."""

import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ai_summarizer import build_grounded_brief
from config import REGIONS
from gee_extractor import fetch_region_climate_series, generate_months
from indices import (
    classify_bmkg_climate_zone,
    classify_drought_status_by_zone,
    compute_pdlvi,
    compute_spi3_series,
    compute_ssma,
    compute_tci,
    compute_vci,
    compute_vhi,
)
from r2_uploader import upload_artifacts


def run(months_count: int = 36, dry_run: bool = False, out_dir: Path | None = None) -> dict[str, Any]:
    months = generate_months(months_count)
    raw = fetch_region_climate_series(months, dry_run=dry_run)
    now_iso = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    regions_out: dict[str, Any] = {}
    briefs_out: dict[str, Any] = {}

    for reg in REGIONS:
        kode = reg["kode_bps"]
        slope = float(reg["mean_slope_deg"])
        climate_zone = classify_bmkg_climate_zone(kode)
        climate = raw[kode]
        spi3_list = compute_spi3_series(climate["rain_mm"])

        ndvi_arr = climate["ndvi"]
        lst_arr = climate["lst_c"]
        sm_arr = climate["soil_moisture"]
        ndvi_min, ndvi_max = min(ndvi_arr), max(ndvi_arr)
        lst_min, lst_max = min(lst_arr), max(lst_arr)

        series = []
        for idx, ym in enumerate(months):
            vci = compute_vci(ndvi_arr[idx], ndvi_min, ndvi_max)
            tci = compute_tci(lst_arr[idx], lst_min, lst_max)
            vhi = compute_vhi(vci, tci)
            ssma = compute_ssma(sm_arr[idx], sm_arr)
            spi3 = spi3_list[idx]
            pdlvi = compute_pdlvi(vhi, ssma, spi3, slope)
            status = classify_drought_status_by_zone(pdlvi, vhi, spi3, climate_zone)
            series.append(
                {
                    "ym": ym,
                    "spi3": spi3,
                    "ssma": ssma,
                    "vhi": vhi,
                    "pdlvi": pdlvi,
                    "status": status,
                }
            )

        reg_payload = {
            **reg,
            "climate_zone": climate_zone,
            "updated_at": now_iso,
            "series": series,
            "executive_brief_id": f"brief-{kode}-{months[-1]}",
        }
        brief = build_grounded_brief(reg_payload, dry_run=dry_run)
        if not brief["validated"]:
            raise ValueError(f"Brief hallucination check failed for {kode}: {brief['ungrounded_tokens']}")
        regions_out[kode] = reg_payload
        briefs_out[kode] = brief

    dataset = {
        "is_simulated": dry_run,
        "generated_at": now_iso,
        "months": months,
        "regions": regions_out,
    }
    manifest = {
        "schema_version": "v1",
        "generated_at": now_iso,
        "is_simulated": dry_run,
        "region_count": len(regions_out),
        "latest_month": months[-1],
    }

    target_dir = out_dir or (Path(__file__).resolve().parent / "out")
    keys = upload_artifacts(
        {
            "jateng-drought-36m.json": dataset,
            "briefs.json": briefs_out,
            "manifest.json": manifest,
        },
        out_dir=target_dir,
        dry_run=dry_run,
    )
    return {"manifest": manifest, "keys": keys, "out_dir": str(target_dir)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Build & upload Central Java drought indicators.")
    parser.add_argument("--months", type=int, default=36)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--out-dir", type=Path, default=None)
    args = parser.parse_args()
    res = run(months_count=args.months, dry_run=args.dry_run, out_dir=args.out_dir)
    print(f"[drought-pipeline] OK dry_run={args.dry_run} regions={res['manifest']['region_count']} keys={len(res['keys'])}")


if __name__ == "__main__":
    main()
