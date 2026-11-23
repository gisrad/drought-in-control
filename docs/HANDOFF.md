# Handoff Sesi — Drought in Control (`gisrad/drought-in-control`)

- **Tanggal terakhir**: `2026-11-24`
- **Fase aktif**: `v0.8.0 (D0–D5) — SELESAI & LIVE`
- **Langkah terakhir selesai**:
  - Menambahkan `WilayahPublicView.svelte` untuk rute publik `/wilayah/` dan `/wilayah/[kabupaten]`, permalink berkeadaan (`?kode=&idx=&m=`), mode `?embed=1`, ekspor GeoJSON siap QGIS, serta `CITATION.cff` & `CHANGELOG.md`.
  - Mengisi R2 bucket `agri-transbulent-data` (`v1/drought/jateng/{manifest,jateng-drought-36m,briefs}.json`) dan memverifikasi live HTTPS `200` pada `/kekeringan/`, `/wilayah/`, `/wilayah/3312/`.
- **Ekspansi selanjutnya**:
  - Tambahkan GitHub Secrets (`GEE_SERVICE_ACCOUNT`, `R2_*`, `GEMINI_API_KEY`) untuk cron otomatis serta perluasan `REGIONS` + partisi R2 ke seluruh 38 provinsi Indonesia (kalibrasi zona monsunal, ekuatorial, lokal BMKG).
