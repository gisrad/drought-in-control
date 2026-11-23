# Handoff Sesi — Drought in Control (`gisrad/drought-in-control`)

- **Tanggal terakhir**: `2026-11-24`
- **Fase aktif**: `D1–D3 (Workbench Peta Kekeringan & PDLVI + Policy Brief APA 7th) — SELESAI & LIVE`
- **Langkah terakhir selesai**:
  - Membangun `web/` (Astro 5 + Svelte 5 + MapLibre GL v5 + `uPlot`) dengan 12 kabupaten/DAS Jawa Tengah + perbatasan DIY dan deret waktu 36 bulan (`SPI-3`, `SSMA`, `VHI`, `PDLVI`).
  - Mengintegrasikan *Floating Layer Switcher*, *Propagation Scrubber* (Play/Pause), *Region Inspector Drawer*, grafik `uPlot`, ekspor `.csv`/`.json`/`.md`, cetak PDF `@media print` dengan sitasi APA 7th, tombol lintas pilar ke `panen-id`, dan *TrialOverlay* 5 menit `overlay`.
  - Deploy ke `drought-in-control-worker` dan terhubung di `https://agri.transbulent.id/kekeringan/`.
- **Perintah sesi berikutnya**:
  - Baca `docs/HANDOFF.md` & `docs/PROGRESS.md`, lalu kerjakan **D4** (`pipeline/` Python GEE + Gemini Brief + R2 Uploader + GitHub Actions cron tgl 1 & 15).
- **Blocker / catatan**:
  - Frontend sudah 100% fungsional memakai `web/public/mock-data/` sambil menunggu kredensial GEE & R2 pada fase **D4**.
