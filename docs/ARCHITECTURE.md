# Arsitektur — Drought in Control (`PDLVI`)

## 1. Struktur Direktori Repositori

```text
drought-in-control/
├── .github/
│   └── workflows/
│       └── update-drought-data.yml  # Cron tgl 1 & 15 pukul 02:00 UTC + workflow_dispatch
├── web/                             # Astro 5 + Svelte 5 + MapLibre GL v5 + uPlot
│   ├── public/mock-data/            # GeoJSON & deret waktu realistis 24–60 bln (Jateng + perbatasan DIY)
│   ├── src/pages/                   # /kekeringan, /kekeringan/[wilayah], /wilayah/[kabupaten]
│   └── src/components/              # DroughtMap, LayerSwitcher, PropagationScrubber, RegionDrawer, BriefExporter
├── pipeline/
│   ├── config.py                    # Daftar kabupaten/DAS Jateng+DIY, bobot PDLVI, bucket R2
│   ├── gee_extractor.py             # SPI-3, VHI, SSMA, PDLVI -> COG + JSON statistik zonal
│   ├── ai_summarizer.py             # Batch Gemini API + validator angka anti-halusinasi
│   ├── r2_uploader.py               # Upload aset ke Cloudflare R2 via boto3
│   ├── run_pipeline.py              # Entrypoint utama pipeline
│   └── requirements.txt
├── worker/                          # drought-in-control-worker (Service Binding DROUGHT, workers_dev = false)
├── docs/                            # SSOT lokal drought-in-control
├── .env.example
└── .gitignore
```

## 2. Penyatuan Stack & Desain *Swiss Style / Dieter Rams*

- **Stack UI Seragam**: mengadopsi **Astro 5 + Svelte 5 + MapLibre GL v5 + uPlot** agar menyatu mulus dengan `agri.transbulent.id` dan `panen-id` tanpa duplikasi library peta/grafik.
- **Tema Default**: **Kertas Beras (Terang)** (`#F3EEE2` / `#FAF8F3`, tinta `#1C1A16`, garis rambut `1px solid #DCD5C7`, basemap monokromatik terang) — dengan dukungan mode gelap *Malam Sawah* (`#13110E`).
- **Skala Warna Data (Ramah Buta Warna)**:
  - Normal/Basah ke Kekeringan Ekstrem / PDLVI Tinggi: Slate Blue `#334155` $\rightarrow$ Neutral Sand `#E5DEC9` $\rightarrow$ Ochre `#D97706` $\rightarrow$ Terracotta `#C2410C` $\rightarrow$ Deep Rust `#7C2D12`.
- **Tipografi**: `Newsreader` (judul editorial), `Schibsted Grotesk` (UI), `IBM Plex Mono` (`tabular-nums` agar angka KPI tidak melompat saat *scrubber* digeser).
- **Cetak Policy Brief (`@media print`)**: menyembunyikan kanvas peta, Dok Melayang, dan kontrol interaktif, menyisakan ringkasan statistik, grafik deret waktu, narasi anomali, metodologi ringkas, dan blok sitasi APA 7th siap cetak PDF.

## 3. Integrasi Service Binding (`DROUGHT`) & Jembatan Lintas Pilar

- Worker `drought-in-control-worker` menyetel `workers_dev = false` dan `preview_urls = false`; trafik produksi dilayani oleh `agri-gateway` pada `/kekeringan/*` dan `/wilayah/*`.
- **Jembatan Lintas Pilar**: setiap wilayah yang memiliki lahan demo atau dataset di `panen-id` (seperti Kabupaten Magelang / DAS Bompon & sawah irigasi Jateng) menampilkan tombol langsung **"Buka Musim Ulang di Wilayah Ini →"** menuju `/ulang/[lahan]/[musim]`.
- **100% Fungsional Lokal dengan Mock Data**: aplikasi wajib berjalan penuh di `http://127.0.0.1:4328` memakai `web/public/mock-data/` sebelum kredensial GEE atau R2 terpasang.
