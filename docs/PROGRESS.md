# Progres Pembangunan — Drought in Control

- [x] **D0** — Dokumentasi SSOT awal (`README`, `.gitignore`, `.env.example`, `docs/*`)
- [x] **D1** — Kerangka `web/` (Astro 5 + Svelte 5), `worker/`, & Mock Data Realistis Jateng/DIY (36 bulan)
- [x] **D2** — Peta MapLibre, *Floating Layer Switcher*, & *Propagation Scrubber*
- [x] **D3** — *Region Inspector Drawer*, Grafik `uPlot` 36 Bulan, & *One-Click Policy Brief* (APA 7th + `@media print`)
- [x] **D4** — Pipeline Python (`VCI`, `TCI`, `VHI`, `SSMA`, `SPI-3`, `PDLVI`), validator angka `validate_brief_numbers`, 6 unit tests PASS + `--dry-run`, seed R2 `v1/drought/jateng/*`, & GitHub Actions cron `.github/workflows/update-drought-data.yml`
- [x] **D5 & Rilis v0.8.0** — Profil wilayah publik `/wilayah/[kabupaten]` (`WilayahPublicView.svelte`, arsitektur siap skala 38 provinsi / 514 kab-kota), permalink berkeadaan, `?embed=1`, ekspor GeoJSON siap QGIS, `CITATION.cff`, `CHANGELOG.md`

## Catatan Build Final v0.8.0 (2026-11-24)

- `DroughtWorkbench.-2bw-63y.js = 326.94 kB` gzip (di bawah anggaran <= 350 kB).
- `drought-in-control-worker` Version `9e80a36b-762b-4fc7-8944-6df268f6c905` aktif melayani `/kekeringan/`, `/wilayah/`, `/wilayah/3312/` (HTTP `200`).
