# Changelog — Drought in Control (`gisrad/drought-in-control`)

## [2.1.0] - 2026-11-25

### Added
- **3D Kinetic Bipolar Pin-Field Observatory (`/kekeringan/relief/`)**: Isolated WebGL2 Three.js `InstancedMesh` + custom GLSL shader (`pinFieldEngine.ts`) rendering up to 9,084 land-masked 3D pins across 7 archipelagic presets (`Indonesia`, `Jawa & Bali`, `Jateng & DIY`, `Sumatera`, `Bali & NTT`, `Kalimantan`, `Sulawesi`) with true bipolar rising/sinking geometry (`SPI-3`, `SSMA`, `VHI`) and unipolar `PDLVI` hazard spires.
- **Broadcast HUD & Creator Export Studio (`reliefHudRenderer.ts`, `reliefExporter.ts`)**: Synchronized `tabular-nums` timestamp, 3D-projected collision-culled city anchors, bipolar sparkline, `16:9` / `9:16` (TikTok/Reels Safe-Zone + diagonal Java framing) / `4:5` aspect presets, 3-second viral peak hook option, deterministic WebCodecs + `mp4-muxer` `.mp4` export, and 4K `.png` poster export.
- **Track A `PIN1` Int8 Binary Cube Pipeline**: Added `scripts/build_pin_grids.py`, `pipeline/export_chirps_pin_grid.py`, `pipeline/test_pin_grid.py`, and `notebooks/drought_chirps_45y_relief.ipynb` (45-year CHIRPS v2.0 extraction with 180s auto-off).

## [2.0.0] - 2026-11-24

### Added
- **Propagation Lag-AI & AR(1) 3-Month Forecast (`droughtAi.ts`)**: Automated cross-correlation lag detection (`SPI-3 → SSMA → VHI → PDLVI`), autoregressive 1-step-ahead recursive 3-month projections with 90% confidence intervals, and BMKG-zone calibrated `P(AWAS)` exceedance probability.
- **Grounded AI Policy Copilot (`POST /api/v1/ai/brief`)**: Edge policy synthesis backed by numeric anti-hallucination verification (`validateGroundedNumbers`) and 3 zone-tailored adaptation recommendations.

## [1.4.0] - 2026-11-24

### Added
- **BMKG 3-Zone Multi-Climate Calibration**: Added `classify_bmkg_climate_zone()` and `classify_drought_status_by_zone()` (`Monsunal`, `Ekuatorial`, `Lokal`) in `pipeline/indices.py` and wired per-regency `climate_zone` into `pipeline/run_pipeline.py`.
- **Interactive Zone Discovery**: Added `climateZones.ts`, a 4-button BMKG climate zone filter (`?zone=`) with permalink sync in `DroughtWorkbench.svelte`, calibration badges in the Region Inspector Drawer, and a national 3-zone aggregation summary in `WilayahPublicView.svelte`.
- **Aldrian & Susanto (2003) Citations & D1 Shortlinks**: Updated CSV headers, Markdown Policy Briefs, and APA 7th references with BMKG climate zone metadata, plus upgraded *Copy Permalink* to create Cloudflare D1 `/s/<slug>` shortlinks.

## [0.9.0] - 2026-11-24

### Added
- **National 514-Regency Boundaries**: Replaced initial pilot placeholders with real COD-AB/BPS administrative boundaries across all 514 Indonesian regencies and cities, powered by 60 fps GPU paint expressions.
- **Public Regional Profiles (`/wilayah/`)**: Added national summary metrics, clickable Top 10 PDLVI hotspot ranking, and 38-province aggregation tables.
- **Discovery & UX**: Added live 514-regency search fly-to, real-time hover telemetry, viewport presets (`Jateng & DIY`, `Jawa`, `Indonesia (514)`), and 4-language UI (`ID | EN | JA | ZH`).

## [0.8.0] - 2026-11-24

### Added
- **Sharing & QGIS Exports**: Added stateful permalinks, borderless embed mode, and QGIS-ready GeoJSON exports with clear data provenance tags.
- **Reproducible Climate Pipeline (`pipeline/`)**: Implemented `VCI`, `TCI`, `VHI`, `SSMA`, `SPI-3`, and `PDLVI` calculation engine, automated quantitative brief verification, offline `--dry-run` mode, and unit test suite.

## [0.1.0] - 2026-11-24
- Initial static-first observatory release with Astro 5, Svelte 5, MapLibre GL v5, `uPlot`, Propagation Scrubber, Region Inspector, and APA 7th print Policy Briefs.
