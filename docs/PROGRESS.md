# Progres Pembangunan — Drought in Control

- [x] **D0** — Dokumentasi SSOT awal (`README`, `.gitignore`, `.env.example`, `docs/*`)
- [x] **D1** — Kerangka `web/` (Astro 5 + Svelte 5), `worker/`, & Mock Data Realistis Jateng/DIY (36 bulan)
- [x] **D2** — Peta MapLibre, *Floating Layer Switcher*, & *Propagation Scrubber*
- [x] **D3** — *Region Inspector Drawer*, Grafik `uPlot` 36 Bulan, & *One-Click Policy Brief* (APA 7th + `@media print`)
- [x] **D4** — Pipeline Python (`config.py`, `indices.py`, `gee_extractor.py`, `ai_summarizer.py`, `r2_uploader.py`, `run_pipeline.py`), validator angka anti-halusinasi (`validate_brief_numbers`), 6 unit tests PASS + `--dry-run`, & GitHub Actions cron `.github/workflows/update-drought-data.yml` (`0 2 1,15 * *`)
- [ ] **D5** — Halaman `/wilayah/[kabupaten]` & Playwright E2E lanjutan

## Catatan Build D1–D4 (2026-11-24)

- Build statis Astro 5 + Svelte 5 + MapLibre GL v5 + `uPlot` hijau (`DroughtWorkbench.js = 323.56 kB` gzip, di bawah anggaran <= 350 kB), live di `https://agri.transbulent.id/kekeringan/`.
- Suite `python -m unittest discover -s pipeline -p "test_*.py" -v` lolos 6/6 tes dan `python pipeline/run_pipeline.py --dry-run` menghasilkan 12 region + brief tervalidasi.
