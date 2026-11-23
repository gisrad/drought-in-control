"""APA 7th policy brief generator + anti-hallucination quantitative number validator."""

import os
import re
from typing import Any


_NUM_RE = re.compile(r"(?<![A-Za-z0-9_])-?\d+(?:[.,]\d+)?(?![A-Za-z0-9_])")
_HYPHEN_CODE_RE = re.compile(r"\b(?:SPI|FAO)-\d+\b")
_YM_RE = re.compile(r"\b(20\d{2})-(\d{2})\b")


def extract_numbers(text: str) -> list[float]:
    normalized = _HYPHEN_CODE_RE.sub("", text)
    normalized = _YM_RE.sub(r"\1 \2", normalized)
    nums: list[float] = []
    for raw in _NUM_RE.findall(normalized):
        cleaned = raw.replace(",", ".")
        try:
            nums.append(float(cleaned))
        except ValueError:
            continue
    return nums


def validate_brief_numbers(
    brief_text: str,
    allowed_numbers: set[float],
    tol: float = 0.05,
) -> tuple[bool, list[str]]:
    """
    Verify every number mentioned in an AI policy brief matches a grounded pipeline metric
    within `tol` (ignoring benign structural counters like year/month codes or 36/3/12 if supplied).
    Returns (is_valid, ungrounded_tokens).
    """
    ungrounded: list[str] = []
    for val in extract_numbers(brief_text):
        if not any(abs(val - allowed) <= tol for allowed in allowed_numbers):
            ungrounded.append(str(val))
    return (len(ungrounded) == 0, ungrounded)


def build_grounded_brief(region_payload: dict[str, Any], dry_run: bool = True) -> dict[str, Any]:
    latest = region_payload["series"][-1]
    kode = region_payload["kode_bps"]
    nama = region_payload["nama"]
    slope = region_payload["mean_slope_deg"]
    ym = latest["ym"]
    pdlvi = latest["pdlvi"]
    vhi = latest["vhi"]
    ssma = latest["ssma"]
    spi3 = latest["spi3"]
    status = latest["status"]

    # Deterministic scientifically grounded Indonesian brief (zero fabricated statistics)
    brief = (
        f"Pada periode {ym}, {nama} (BPS {kode}, rata-rata lereng {slope} derajat) berada pada status {status} "
        f"dengan indeks PDLVI {pdlvi}, VHI {vhi}, anomali kelembapan tanah SSMA {ssma}, dan SPI-3 {spi3}. "
        f"Prioritaskan pemantauan ketersediaan air tanah lapisan atas serta penjadwalan irigasi hemat pada zona berlereng."
    )

    allowed = {
        float(kode),
        float(slope),
        float(pdlvi),
        float(vhi),
        float(ssma),
        float(spi3),
        float(ym.split("-")[0]),
        float(int(ym.split("-")[1])),
    }

    if not dry_run and os.environ.get("GEMINI_API_KEY"):
        # Optional live Gemini refinement strictly validated by validate_brief_numbers
        try:
            from google import genai  # type: ignore

            client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
            prompt = (
                "Ringkas kondisi kekeringan dalam 2 kalimat bahasa Indonesia baku menggunakan HANYA angka berikut "
                f"(tanpa menambah angka lain): periode={ym}, bps={kode}, lereng={slope}, status={status}, "
                f"PDLVI={pdlvi}, VHI={vhi}, SSMA={ssma}, SPI3={spi3}, wilayah={nama}."
            )
            resp = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
            candidate = (resp.text or "").strip()
            ok, _ = validate_brief_numbers(candidate, allowed)
            if ok and candidate:
                brief = candidate
        except Exception:
            pass

    ok, bad = validate_brief_numbers(brief, allowed)
    return {
        "brief_id": f"brief-{kode}-{ym}",
        "kode_bps": kode,
        "ym": ym,
        "status": status,
        "text_id": brief,
        "validated": ok,
        "ungrounded_tokens": bad,
    }
