# Progres Pembangunan — Drought in Control

- [x] **D0** — Dokumentasi SSOT awal (`README`, `.gitignore`, `.env.example`, `docs/*`)
- [ ] **D1** — Kerangka `web/` (Astro 5 + Svelte 5), `worker/`, & Mock Data Realistis Jateng/DIY (24–60 bulan)
- [ ] **D2** — Peta MapLibre, *Floating Layer Switcher*, & *Propagation Scrubber*
- [ ] **D3** — *Region Inspector Drawer*, Grafik `uPlot` 5 Tahun, & *One-Click Policy Brief* (APA 7th + `@media print`)
- [ ] **D4** — Pipeline Python GEE + Batch Gemini Brief + R2 Uploader + GitHub Actions Cron
- [ ] **D5** — Halaman `/wilayah/[kabupaten]`, Service Binding `DROUGHT`, & Playwright E2E

## Sub-Checklist Atomik D1

- [ ] Inisialisasi `web/` (Astro 5 + Svelte 5 + TypeScript + `maplibre-gl` v5 + `uplot`)
- [ ] Sinkronkan token *Kertas Beras* & *Malam Sawah*, font self-hosted, dan skala warna ramah buta warna sesuai `D:\transbulent.id\docs\agri\DESIGN_SYSTEM.md`
- [ ] Buat `src/types/drought.ts` dan `src/utils/citationGenerator.ts` (APA 7th)
- [ ] Buat `web/public/mock-data/` mencakup 12 kabupaten/DAS Jateng & perbatasan DIY (Magelang/Bompon, Wonogiri, Purworejo, Kebumen, Klaten, Demak, Grobogan, Brebes, Gunungkidul, Kulon Progo, Bantul, Sleman) dengan 36 bulan deret waktu (termasuk anomali El Niño & efek *lag* SPI -> SSMA -> VHI -> PDLVI)
- [ ] Buat `worker/` (`drought-in-control-worker`, `workers_dev = false`, `preview_urls = false`) dan verifikasi `npm run build` hijau
