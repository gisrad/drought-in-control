# Changelog — Drought in Control (`gisrad/drought-in-control`)

## [0.8.0] - 2026-11-24

### Ditambahkan
- **D5 (`/wilayah/[kabupaten]`)**: `WilayahPublicView.svelte` dengan profil ringkas per kode BPS 4-digit, konteks ENSO/IOD, statistik 36 bulan, jembatan peta interaktif, dan kerangka siap skala 38 provinsi Indonesia.
- **D4b (Berbagi & Ekspor QGIS)**: Permalink berkeadaan (`?kode=...&idx=...&m=...`), mode embed `?embed=1`, dan tombol `Unduh GeoJSON (QGIS)` dengan atribut lengkap + penanda `SIMULASI`.
- **D4 (`pipeline/`)**: Ekstraktor CHIRPS/MODIS/ERA5/SRTM + perhitungan `SPI-3`, `SSMA`, `VHI`, `PDLVI`, validator angka anti-halusinasi `validate_brief_numbers`, uploader R2 `boto3`, mode `--dry-run`, 6 unit test, dan workflow cron GitHub Actions tgl 1 & 15.

## [0.1.0] - 2026-11-24
- **D0–D3**: Fondasi Astro 5 + Svelte 5 + MapLibre GL v5 + `uPlot`, *Propagation Scrubber* 36 bulan, *Region Inspector Drawer*, dan Policy Brief APA 7th (`@media print`).
