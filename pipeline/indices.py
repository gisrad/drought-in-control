"""Drought & soil-landscape propagation indices (VHI, SSMA, SPI-3, PDLVI)."""

import math
from statistics import mean, pstdev
from typing import Sequence

from config import W_SPI3, W_SSMA, W_VHI


def compute_vci(ndvi: float, ndvi_min: float, ndvi_max: float) -> float:
    denom = max(ndvi_max - ndvi_min, 1e-6)
    val = ((ndvi - ndvi_min) / denom) * 100.0
    return max(0.0, min(100.0, val))


def compute_tci(lst_c: float, lst_min: float, lst_max: float) -> float:
    denom = max(lst_max - lst_min, 1e-6)
    val = ((lst_max - lst_c) / denom) * 100.0
    return max(0.0, min(100.0, val))


def compute_vhi(vci: float, tci: float, alpha: float = 0.5) -> float:
    val = alpha * vci + (1.0 - alpha) * tci
    return round(max(0.0, min(100.0, val)), 2)


def compute_ssma(sm: float, hist_series: Sequence[float]) -> float:
    if not hist_series:
        return 0.0
    mu = mean(hist_series)
    sd = pstdev(hist_series)
    if sd < 1e-6:
        return 0.0
    z = (sm - mu) / sd
    return round(max(-3.5, min(3.5, z)), 3)


def compute_spi3_series(monthly_rain_mm: Sequence[float]) -> list[float]:
    """Compute rolling 3-month Standardized Precipitation Index using log-transformed anomalies."""
    n = len(monthly_rain_mm)
    if n == 0:
        return []
    roll3: list[float] = []
    for i in range(n):
        start = max(0, i - 2)
        s = sum(max(0.0, monthly_rain_mm[j]) for j in range(start, i + 1))
        roll3.append(math.log1p(s))
    mu = mean(roll3)
    sd = pstdev(roll3)
    if sd < 1e-6:
        return [0.0 for _ in roll3]
    return [round(max(-3.5, min(3.5, (v - mu) / sd)), 3) for v in roll3]


def compute_pdlvi(vhi: float, ssma: float, spi3: float, mean_slope_deg: float) -> float:
    """
    Pedogeomorphic Drought-Landscape Vulnerability Index (0..1 scale):
    0.35 * vegetation stress + 0.40 * soil-moisture deficit + 0.25 * meteorological deficit,
    amplified up to +45% on steep upland slopes (>0..30 deg).
    """
    veg_stress = max(0.0, min(1.0, (100.0 - vhi) / 100.0))
    soil_stress = max(0.0, min(1.0, -ssma / 3.0))
    met_stress = max(0.0, min(1.0, -spi3 / 3.0))
    base = W_VHI * veg_stress + W_SSMA * soil_stress + W_SPI3 * met_stress
    slope_factor = 1.0 + 0.015 * max(0.0, min(30.0, mean_slope_deg))
    return round(max(0.0, min(1.0, base * slope_factor)), 3)


def classify_drought_status(pdlvi: float, vhi: float, spi3: float) -> str:
    return classify_drought_status_by_zone(pdlvi, vhi, spi3, "monsunal")


EKUATORIAL_PROVS = {"11", "12", "13", "14", "15", "16", "17", "19", "21", "61", "62", "63", "64", "65"}
LOKAL_PROVS = {"71", "72", "75", "81", "82", "91", "92", "93", "94", "95", "96"}

BMKG_ZONE_THRESHOLDS: dict[str, dict[str, tuple[float, float, float]]] = {
    "monsunal": {"AWAS": (0.68, 25.0, -2.0), "SIAGA": (0.50, 35.0, -1.5), "WASPADA": (0.34, 45.0, -1.0)},
    "ekuatorial": {"AWAS": (0.62, 28.0, -1.75), "SIAGA": (0.45, 38.0, -1.25), "WASPADA": (0.30, 48.0, -0.85)},
    "lokal": {"AWAS": (0.65, 26.0, -1.85), "SIAGA": (0.48, 36.0, -1.35), "WASPADA": (0.32, 46.0, -0.90)},
}


def classify_bmkg_climate_zone(kode_bps: str) -> str:
    prov = str(kode_bps or "")[:2]
    if prov in EKUATORIAL_PROVS:
        return "ekuatorial"
    if prov in LOKAL_PROVS:
        return "lokal"
    return "monsunal"


def classify_drought_status_by_zone(pdlvi: float, vhi: float, spi3: float, climate_zone: str = "monsunal") -> str:
    thresholds = BMKG_ZONE_THRESHOLDS.get(climate_zone, BMKG_ZONE_THRESHOLDS["monsunal"])
    for label in ("AWAS", "SIAGA", "WASPADA"):
        p_lim, v_lim, s_lim = thresholds[label]
        if pdlvi >= p_lim or vhi < v_lim or spi3 <= s_lim:
            return label
    return "NORMAL"
