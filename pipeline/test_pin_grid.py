"""Unit tests for PIN1 quantized binary cube encoding/decoding."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parent
ROOT_DIR = PIPELINE_DIR.parent
if str(PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPELINE_DIR))

from export_chirps_pin_grid import (  # noqa: E402
    NODATA_I8,
    build_dry_run_pinbin,
    dequantize_value,
    pack_pinbin,
    quantize_value,
    unpack_pinbin,
)


class PinGridBinaryTests(unittest.TestCase):
    def test_quantize_round_trip_precision(self) -> None:
        smin, smax = -3.0, 3.0
        for raw in [-3.0, -2.14, -1.05, 0.0, 0.72, 1.88, 3.0]:
            q = quantize_value(raw, smin, smax)
            self.assertNotEqual(q, NODATA_I8)
            restored = dequantize_value(q, smin, smax)
            self.assertIsNotNone(restored)
            assert restored is not None
            self.assertLessEqual(abs(restored - raw), 0.025)

    def test_nodata_handling(self) -> None:
        self.assertEqual(quantize_value(None, -3.0, 3.0), NODATA_I8)
        self.assertIsNone(dequantize_value(NODATA_I8, -3.0, 3.0))

    def test_pack_unpack_cube_integrity(self) -> None:
        meta = {
            "region": "jateng",
            "metric": "spi3",
            "source": "TEST",
            "is_simulated": False,
            "time_labels": ["2024", "2025"],
            "scale_min": -3.0,
            "scale_max": 3.0,
        }
        lons = [110.21, 110.92, 111.41]
        lats = [-7.48, -7.81, -6.97]
        frames = [
            [-1.50, 0.00, 1.25],
            [None, 2.40, -2.85],
        ]
        blob = pack_pinbin(meta, lons, lats, frames)
        self.assertTrue(blob.startswith(b"PIN1"))
        out_meta, out_lons, out_lats, out_frames = unpack_pinbin(blob)
        self.assertEqual(out_meta["pin_count"], 3)
        self.assertEqual(out_meta["time_count"], 2)
        self.assertEqual(out_meta["time_labels"], ["2024", "2025"])
        for a, b in zip(lons, out_lons):
            self.assertAlmostEqual(a, b, places=4)
        for a, b in zip(lats, out_lats):
            self.assertAlmostEqual(a, b, places=4)
        self.assertIsNone(out_frames[1][0])
        assert out_frames[0][0] is not None
        self.assertLessEqual(abs(out_frames[0][0] - (-1.50)), 0.025)

    def test_dry_run_pinbin_if_grid_exists(self) -> None:
        grid_path = ROOT_DIR / "web" / "public" / "relief-data" / "grid-jateng.json"
        ds_path = ROOT_DIR / "web" / "public" / "mock-data" / "jateng-drought-36m.json"
        if not grid_path.exists():
            self.skipTest("grid-jateng.json not yet built")
        blob = build_dry_run_pinbin(grid_path, ds_path, metric="spi3")
        meta, lons, _lats, frames = unpack_pinbin(blob)
        self.assertTrue(meta["is_simulated"])
        self.assertGreater(len(lons), 1000)
        self.assertEqual(len(frames), 36)
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "test.pinbin"
            p.write_bytes(blob)
            self.assertGreater(p.stat().st_size, 10000)


if __name__ == "__main__":
    unittest.main()
