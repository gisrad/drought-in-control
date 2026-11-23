# Progres Pembangunan — Drought in Control

- [x] **D0** — Dokumentasi SSOT awal (`README`, `.gitignore`, `.env.example`, `docs/*`)
- [x] **D1** — Kerangka `web/` (Astro 5 + Svelte 5), `worker/`, & Mock Data Realistis Jateng/DIY (36 bulan)
- [x] **D2** — Peta MapLibre, *Floating Layer Switcher*, & *Propagation Scrubber*
- [x] **D3** — *Region Inspector Drawer*, Grafik `uPlot` 36 Bulan, & *One-Click Policy Brief* (APA 7th + `@media print`)
- [ ] **D4** — Pipeline Python GEE + Batch Gemini Brief + R2 Uploader + GitHub Actions Cron
- [ ] **D5** — Halaman `/wilayah/[kabupaten]` & Playwright E2E lanjutan

## Catatan Build D1–D3 (2026-11-24)

- Build statis Astro 5 + Svelte 5 + MapLibre GL v5 + `uPlot` hijau (`DroughtWorkbench.js = 323.56 kB` gzip, di bawah anggaran <= 350 kB).
- Ter-deploy privat (`workers_dev = false`) sebagai `drought-in-control-worker` dan terhubung ke `https://agri.transbulent.id/kekeringan/` via Cloudflare Service Binding `DROUGHT`.
