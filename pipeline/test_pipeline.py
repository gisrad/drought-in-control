"""Unit tests for drought-in-control pipeline (`python -m unittest`)."""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ai_summarizer import validate_brief_numbers
from indices import (
    classify_bmkg_climate_zone,
    classify_drought_status,
    classify_drought_status_by_zone,
    compute_pdlvi,
    compute_spi3_series,
    compute_ssma,
    compute_tci,
    compute_vci,
    compute_vhi,
)
from run_pipeline import run


class DroughtPipelineTests(unittest.TestCase):
    def test_vci_tci_vhi_bounds(self) -> None:
        self.assertAlmostEqual(compute_vci(0.8, 0.2, 0.8), 100.0)
        self.assertAlmostEqual(compute_tci(38.0, 26.0, 38.0), 0.0)
        vhi = compute_vhi(40.0, 20.0)
        self.assertAlmostEqual(vhi, 30.0)

    def test_pdlvi_increases_with_slope_and_deficit(self) -> None:
        flat = compute_pdlvi(vhi=30.0, ssma=-1.8, spi3=-1.6, mean_slope_deg=2.0)
        steep = compute_pdlvi(vhi=30.0, ssma=-1.8, spi3=-1.6, mean_slope_deg=20.0)
        self.assertGreater(steep, flat)
        self.assertLessEqual(steep, 1.0)

    def test_classify_statuses(self) -> None:
        self.assertEqual(classify_drought_status(0.72, 22.0, -2.1), "AWAS")
        self.assertEqual(classify_drought_status(0.55, 34.0, -1.6), "SIAGA")
        self.assertEqual(classify_drought_status(0.36, 44.0, -1.1), "WASPADA")
        self.assertEqual(classify_drought_status(0.18, 65.0, 0.2), "NORMAL")

    def test_ssma_and_spi3(self) -> None:
        hist = [0.20, 0.25, 0.30, 0.35, 0.40]
        self.assertLess(compute_ssma(0.18, hist), -1.0)
        spi = compute_spi3_series([300.0, 280.0, 250.0, 40.0, 25.0, 15.0])
        self.assertEqual(len(spi), 6)
        self.assertLess(spi[-1], spi[2])

    def test_validate_brief_numbers_rejects_hallucinations(self) -> None:
        allowed = {3312.0, 14.2, 0.642, 31.5, -1.4, -1.7, 2026.0, 10.0}
        good = "Kabupaten 3312 lereng 14.2 mencatat PDLVI 0.642, VHI 31.5, SSMA -1.4, SPI3 -1.7 pada 2026-10."
        bad = "Kabupaten 3312 kehilangan panen 98.7 persen dengan kerugian 450 miliar."
        ok_good, errs_good = validate_brief_numbers(good, allowed)
        ok_bad, errs_bad = validate_brief_numbers(bad, allowed)
        self.assertTrue(ok_good, f"Unexpected errors: {errs_good}")
        self.assertFalse(ok_bad)
        self.assertIn("98.7", errs_bad)
        self.assertIn("450.0", errs_bad)

    def test_dry_run_pipeline(self) -> None:
        import json

        with tempfile.TemporaryDirectory() as tmp:
            res = run(months_count=36, dry_run=True, out_dir=Path(tmp))
            self.assertEqual(res["manifest"]["region_count"], 12)
            out_json = Path(tmp) / "jateng-drought-36m.json"
            self.assertTrue(out_json.exists())
            self.assertTrue((Path(tmp) / "briefs.json").exists())
            data = json.loads(out_json.read_text(encoding="utf-8"))
            self.assertEqual(data["regions"]["3312"]["climate_zone"], "monsunal")

    def test_bmkg_climate_zone_mapping(self) -> None:
        self.assertEqual(classify_bmkg_climate_zone("3312"), "monsunal")
        self.assertEqual(classify_bmkg_climate_zone("1401"), "ekuatorial")
        self.assertEqual(classify_bmkg_climate_zone("6101"), "ekuatorial")
        self.assertEqual(classify_bmkg_climate_zone("8101"), "lokal")
        self.assertEqual(classify_bmkg_climate_zone("9101"), "lokal")

    def test_zone_calibrated_thresholds(self) -> None:
        self.assertEqual(classify_drought_status_by_zone(0.63, 29.0, -1.80, "ekuatorial"), "AWAS")
        self.assertEqual(classify_drought_status_by_zone(0.63, 29.0, -1.80, "monsunal"), "SIAGA")


if __name__ == "__main__":
    unittest.main()
