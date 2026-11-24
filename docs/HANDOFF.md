# Handoff Sesi — Drought in Control (`gisrad/drought-in-control`)

- **Tanggal terakhir**: `2026-11-24`
- **Fase aktif**: `v0.9.0 (Batas Administratif Riil 514 Kab/Kota SHP/COD-AB + 60fps Paint) — SELESAI & LIVE`
- **Langkah terakhir selesai**:
  - Mengganti 12 kotak persegi panjang placeholder dengan batas administratif kabupaten/kota riil se-Indonesia (`514` fitur, disederhanakan dari `idn_admin_boundaries.gdb.zip` / `idn_admin2` melalui `scripts/build_idn_admin_geojson.py`).
  - Mengoptimalkan `applyMapColors()` memakai MapLibre paint expression `['match', ['get', 'kode_bps'], ...]` (tanpa re-upload GeoJSON per frame scrubber), menambah tombol viewport `Jateng & DIY` / `Jawa` / `Indonesia (514)`, serta mengelompokkan pemilih `<select>` di `WilayahPublicView.svelte` per provinsi (`<optgroup>`).
  - Deploy `drought-in-control-worker` (`00be0507-ea24-4aff-9516-79dd41abc20a`) dan verifikasi live HTTPS `200` pada GeoJSON `514` fitur, JSON `514` wilayah, `/kekeringan/`, `/kekeringan/3306/`, dan `/wilayah/3312/`.
- **Ekspansi selanjutnya**:
  - Hubungkan cron GEE/R2 (`pipeline/run_pipeline.py`) dengan seluruh 514 kabupaten/kota saat GitHub Secrets tersedia.
