# Changelog — Drought in Control (`gisrad/drought-in-control`)

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
