# Roadmap Build — Drought in Control (`D0–D5`)

Selaras dengan fase terpadu `F3`, `F4`, `F7a`, `F9`, dan `F10` pada dokumen payung `D:\transbulent.id\docs\agri\ROADMAP.md`.

| Fase | Sinkron Payung | Hasil Utama | Kriteria Selesai |
| --- | --- | --- | --- |
| **D0** | `F0` | Inisialisasi SSOT `drought-in-control` (`README`, `docs/*`, `.gitignore`, `.env.example`) | 8 berkas terdokumentasi dan ter-push ke `gisrad/drought-in-control` |
| **D1** | `F3` | Kerangka `web/` (Astro 5 + Svelte 5 + TypeScript) + `worker/` + dataset mock realistis 10–14 kabupaten/DAS Jateng & perbatasan DIY (24–60 bulan lengkap pola El Niño & *lag effect*) | Build hijau di `127.0.0.1:4328`; skema kontrak TypeScript tervalidasi |
| **D2** | `F4` | Peta MapLibre layar penuh (*choropleth* dinamis `SPI-3`, `SSMA`, `VHI`, `PDLVI`) + *Floating Layer Switcher* + legenda ramah buta warna + *Drought Propagation Scrubber* (Play/Pause + indikator *lag effect*) | Animasi 24–60 bulan mulus; skala warna sesuai *Swiss Style* |
| **D3** | `F4` | *Region Inspector Drawer* (4 KPI + delta, grafik `uPlot` 5 thn, *Executive Brief*, jembatan klik ke `panen-id`) + *One-Click Academic/Policy Brief* (unduh `.csv`/`.geojson`/`.md` + Cetak PDF `@media print` + sitasi APA 7th) | 100% fungsional secara lokal sebelum GEE/R2 terhubung; hasil cetak PDF bersih |
| **D4** | `F7a` | Pipeline Python (`pipeline/`): `gee_extractor.py`, `ai_summarizer.py`, `r2_uploader.py`, `run_pipeline.py` + GitHub Actions `.github/workflows/update-drought-data.yml` (tgl 1 & 15) | Skrip pipeline terverifikasi; frontend beralih mulus dari `mock-data` ke R2 |
| **D5** | `F9–F10` | Halaman `/wilayah/[kabupaten]` + deploy `drought-in-control-worker` (`workers_dev = false`) + Service Binding `DROUGHT` ke `agri-gateway` + Playwright E2E | Seluruh uji E2E hijau di `https://agri.transbulent.id/kekeringan` |
