"""Configuration & reference metadata for Central Java + DIY boundary watersheds."""

import os
from typing import Any

W_VHI = 0.35
W_SSMA = 0.40
W_SPI3 = 0.25

R2_BUCKET = os.environ.get("R2_BUCKET", "agri-transbulent-data")
R2_ENDPOINT = os.environ.get("R2_ENDPOINT", "")
R2_PREFIX = os.environ.get("DROUGHT_R2_PREFIX", "v1/drought/jateng")

REGIONS: list[dict[str, Any]] = [
    {"kode_bps": "3312", "nama": "Kab. Wonogiri", "provinsi": "Jawa Tengah", "das": "Bengawan Solo Hulu", "centroid": [110.925, -7.815], "mean_slope_deg": 14.2, "linked_panen_field_id": None},
    {"kode_bps": "3310", "nama": "Kab. Klaten", "provinsi": "Jawa Tengah", "das": "Opak-Bengawan Solo", "centroid": [110.602, -7.705], "mean_slope_deg": 4.8, "linked_panen_field_id": "klaten-irigasi"},
    {"kode_bps": "3308", "nama": "Kab. Magelang", "provinsi": "Jawa Tengah", "das": "Progo / DAS Bompon", "centroid": [110.218, -7.479], "mean_slope_deg": 16.5, "linked_panen_field_id": "bompon-magelang"},
    {"kode_bps": "3311", "nama": "Kab. Sukoharjo", "provinsi": "Jawa Tengah", "das": "Bengawan Solo", "centroid": [110.835, -7.682], "mean_slope_deg": 3.5, "linked_panen_field_id": None},
    {"kode_bps": "3309", "nama": "Kab. Boyolali", "provinsi": "Jawa Tengah", "das": "Serang-Solo", "centroid": [110.595, -7.532], "mean_slope_deg": 9.4, "linked_panen_field_id": None},
    {"kode_bps": "3306", "nama": "Kab. Purworejo", "provinsi": "Jawa Tengah", "das": "Bogowonto", "centroid": [110.008, -7.712], "mean_slope_deg": 12.1, "linked_panen_field_id": None},
    {"kode_bps": "3305", "nama": "Kab. Kebumen", "provinsi": "Jawa Tengah", "das": "Luk Ulo", "centroid": [109.654, -7.671], "mean_slope_deg": 10.8, "linked_panen_field_id": None},
    {"kode_bps": "3304", "nama": "Kab. Banjarnegara", "provinsi": "Jawa Tengah", "das": "Serayu Hulu", "centroid": [109.696, -7.398], "mean_slope_deg": 18.7, "linked_panen_field_id": None},
    {"kode_bps": "3313", "nama": "Kab. Karanganyar", "provinsi": "Jawa Tengah", "das": "Bengawan Solo", "centroid": [110.952, -7.596], "mean_slope_deg": 13.4, "linked_panen_field_id": None},
    {"kode_bps": "3314", "nama": "Kab. Sragen", "provinsi": "Jawa Tengah", "das": "Bengawan Solo Hilir", "centroid": [111.022, -7.428], "mean_slope_deg": 4.2, "linked_panen_field_id": None},
    {"kode_bps": "3316", "nama": "Kab. Blora", "provinsi": "Jawa Tengah", "das": "Lusi-Randublatung", "centroid": [111.418, -6.968], "mean_slope_deg": 6.9, "linked_panen_field_id": None},
    {"kode_bps": "3404", "nama": "Kab. Sleman (Kontinuitas DAS)", "provinsi": "DI Yogyakarta", "das": "Progo-Opak Lintas Provinsi", "centroid": [110.355, -7.716], "mean_slope_deg": 8.6, "linked_panen_field_id": None},
]
