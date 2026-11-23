# Handoff Sesi — Drought in Control (`gisrad/drought-in-control`)

- **Tanggal terakhir**: `2026-11-24`
- **Fase aktif**: `D1–D4 — SELESAI & SIAP PRODUKSI`
- **Langkah terakhir selesai**:
  - Membangun pipeline Python lengkap di `pipeline/` (`VCI`, `TCI`, `VHI`, `SSMA`, `SPI-3`, `PDLVI` berbobot `0.35/0.40/0.25` + faktor lereng), generator ringkasan dengan validator angka anti-halusinasi `validate_brief_numbers`, uploader R2 `boto3`, serta mode `--dry-run`.
  - Menambahkan `.github/workflows/update-drought-data.yml` (cron tgl 1 & 15 pukul 02:00 UTC + `workflow_dispatch`) dan memverifikasi `6/6` tes `unittest` + `--dry-run` exit 0.
- **Perintah sesi berikutnya**:
  - Tambahkan GitHub Secrets (`GEE_SERVICE_ACCOUNT`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `GEMINI_API_KEY`) di repo `gisrad/drought-in-control` untuk menyalakan run live GEE/R2, lalu kerjakan **D5**.
