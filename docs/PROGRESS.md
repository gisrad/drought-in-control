# Build Progress — Drought in Control

- [x] **Web Observatory (`/kekeringan/`)**: Astro 5 + Svelte 5 + MapLibre GL v5 + `uPlot` (`DroughtWorkbench` bundle `<= 331 kB` gzip).
- [x] **Real Administrative Boundaries**: Simplified topology-valid GeoJSON covering **514 Indonesian regencies & cities** (`1704.8 KB` raw / `495.4 KB` gzip) paired with 36-month multi-index time series (`186.8 KB` gzip).
- [x] **60 fps Interaction & Discovery**: GPU `match` paint expressions, live search & fly-to across all 514 regencies, hover readout pill, viewport switcher (`Jateng & DIY`, `Jawa`, `Indonesia (514)`), and 4-language UI switcher (`ID | EN | JA | ZH`).
- [x] **Public Regional Profiles (`/wilayah/`)**: BPS-grouped directory, national summary KPIs, clickable Top 10 PDLVI hotspot ranking, and province-level aggregation table.
- [x] **Reporting & Exports**: One-click CSV, JSON, Markdown brief, QGIS-ready GeoJSON with provenance metadata, APA 7th PDF print view, stateful permalinks, and embed mode.
- [x] **Python Pipeline (`pipeline/`)**: Verified `unittest` suite (6/6 passing) and reproducible offline `--dry-run` generation of regional indicators and grounded briefs.
