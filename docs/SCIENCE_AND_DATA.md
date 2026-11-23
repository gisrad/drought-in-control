# Metodologi Ilmiah, Kontrak Data & Sitasi — Drought in Control

## 1. Empat Indikator Kekeringan & Kerentanan Lahan

### A. Standardized Precipitation Index (SPI-3)
- **Sumber GEE**: `UCSB-CHG/CHIRPS/DAILY` (agregasi 3 bulanan).
- **Klasifikasi**: $SPI < -1.0$ moderat, $SPI < -1.5$ parah, $SPI < -2.0$ ekstrem.

### B. Vegetation Health Index (VHI)
- **Sumber GEE**: `MODIS/061/MOD13A2` (NDVI) dan `MODIS/061/MOD11A2` (LST).
- **Formulasi**:
  $$VCI = \frac{NDVI - NDVI_{\min}}{NDVI_{\max} - NDVI_{\min}} \times 100, \qquad TCI = \frac{LST_{\max} - LST}{LST_{\max} - LST_{\min}} \times 100$$
  $$VHI = \alpha \cdot VCI + (1 - \alpha) \cdot TCI \quad (\alpha = 0.5)$$
  Nilai $VHI < 40$ mengindikasikan stres vegetasi akibat kekeringan.

### C. Surface Soil Moisture Anomaly (SSMA)
- **Sumber GEE**: `ECMWF/ERA5_LAND/MONTHLY_AGGR` (`volumetric_soil_water_layer_1`) atau NASA SMAP.
- **Formulasi**: anomali terstandardisasi ($z$-score) terhadap klimatologi referensi (`2001–2020`):
  $$SSMA = \frac{SM_t - \mu_{SM}}{\sigma_{SM}}$$

### D. Post-Drought Land Vulnerability Index (PDLVI) — *Fitur Unggulan*
- **Konsep**: memetakan zona lahan yang paling rentan mengalami retakan tanah dan erosi kilat (*flash erosion*) ketika hujan pertama turun pascakekeringan.
- **Sumber Lereng ($S$)**: `USGS/SRTMGL1_003` / DEMNAS BIG 8 m (serta LiDAR DAS Bompon untuk demo mikro), dinormalisasi ke $[0, 1]$.
- **Formulasi Komposit $[0, 1]$**:
  $$PDLVI = w_1 \cdot D_{\text{norm}} + w_2 \cdot (1 - VHI_{\text{norm}}) + w_3 \cdot S_{\text{norm}}$$
  dengan $D_{\text{norm}}$ = tingkat keparahan defisit air (berbasis SPI/SSMA), $1 - VHI_{\text{norm}}$ = hilangnya kesehatan/tutupan vegetasi, dan bobot awal $w_1 = 0.35$, $w_2 = 0.40$, $w_3 = 0.25$ (dapat dikonfigurasi di `pipeline/config.py`).

---

## 2. Batch AI Executive Brief & Generator Sitasi APA Edisi ke-7

- **Batch Summarizer (`pipeline/ai_summarizer.py`)**: memakai SDK `google-genai` saat pipeline cron berjalan untuk menghasilkan 1 paragraf ringkasan Bahasa Indonesia formal dan ilmiah per kabupaten. Wajib melewati validator angka: tidak boleh mencantumkan angka yang bertentangan dengan JSON statistik zonal.
- **Generator Sitasi APA 7th (`citationGenerator.ts`)**: setiap ekspor *Policy Brief* (`.md` dan cetak PDF) menyertakan:
  1. Sitasi dataset/platform `Transbulent Research Group — Agri Transbulent (agri.transbulent.id/kekeringan)`.
  2. Referensi primer: McKee et al. (1993) untuk SPI, Kogan (1995) untuk VHI, Funk et al. (2015) untuk CHIRPS, serta Poggio et al. (2021) untuk SoilGrids bila menautkan profil tanah.

---

## 3. Cakupan Spasial Awal & Kontrak Data (`/v1/drought/jateng/...`)

Cakupan mock & produksi awal berfokus pada **Jawa Tengah** (Magelang/DAS Bompon, Wonogiri, Purworejo, Kebumen, Klaten, Demak, Grobogan, Brebes, Boyolali, Blora, Cilacap, Banyumas) serta perbatasan DAS D.I. Yogyakarta (Gunungkidul, Kulon Progo, Bantul, Sleman) agar keutuhan DAS Progo/Bogowonto/Opak terjaga.

```ts
export interface DroughtMonthlyPoint {
  ym: string;                 // "2024-09"
  spi3: number;
  ssma: number;
  vhi: number;
  pdlvi: number;
  status: "normal" | "waspada" | "moderat" | "parah" | "ekstrem";
}

export interface DroughtRegionTimeseries {
  kode_bps: string;
  nama: string;
  provinsi: "Jawa Tengah" | "D.I. Yogyakarta";
  centroid: [number, number];
  mean_slope_deg: number;
  updated_at: string;
  series: DroughtMonthlyPoint[];
  executive_brief_id: string;
  linked_panen_field_id?: string; // Opsional jembatan langsung ke /ulang/[lahan]/[musim]
}
```
