# Progres Pembangunan — Drought in Control

- [x] **D0** — Dokumentasi SSOT awal (`README`, `.gitignore`, `.env.example`, `docs/*`)
- [x] **D1** — Kerangka `web/` (Astro 5 + Svelte 5), `worker/`, & Dataset Nasional 36 Bulan (`514` Kab/Kota)
- [x] **D2** — Peta MapLibre berbatas administratif riil SHP/COD-AB (`514` Kab/Kota se-Indonesia, paint expression 60 fps), pemilih viewport `Jateng & DIY` / `Jawa` / `Indonesia (514)`, & *Propagation Scrubber*
- [x] **D3** — *Region Inspector Drawer*, Grafik `uPlot` 36 Bulan, & *One-Click Policy Brief* (APA 7th + `@media print`)
- [x] **D4** — Pipeline Python (`VCI`, `TCI`, `VHI`, `SSMA`, `SPI-3`, `PDLVI`), validator angka `validate_brief_numbers`, 6 unit tests PASS + `--dry-run`, seed R2 `v1/drought/jateng/*`, & GitHub Actions cron `.github/workflows/update-drought-data.yml`
- [x] **D5 & Rilis v0.9.0** — Profil wilayah publik `/wilayah/[kabupaten]` (`WilayahPublicView.svelte`, dropdown `<optgroup>` 38 provinsi / 514 kab-kota), permalink berkeadaan, `?embed=1`, ekspor GeoJSON siap QGIS, `CITATION.cff`, `CHANGELOG.md`

## Catatan Build Terakhir (2026-11-24)

- Skrip `scripts/build_idn_admin_geojson.py` mengekstrak seluruh `514` kabupaten/kota riil dari `idn_admin_boundaries.gdb.zip` (`idn_admin2`, `EPSG:4326`) dengan simplifikasi topologi (`0.0018` Jateng/DIY, `0.006` provinsi lain; Magelang `147` simpul, Wonogiri `240` simpul, Purworejo `125` simpul). Ukuran `jateng-regions.geojson = 495.4 KB` gzip, `jateng-drought-36m.json = 186.8 KB` gzip.
- `DroughtWorkbench.DIMGAjiO.js = 327.41 kB` gzip (<= 350 kB); `drought-in-control-worker` Version `00be0507-ea24-4aff-9516-79dd41abc20a` live di `https://agri.transbulent.id/kekeringan/` dan `/wilayah/`.
