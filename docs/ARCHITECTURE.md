# Architecture — Drought in Control (`PDLVI`)

## 1. Repository Layout

```text
drought-in-control/
├── .github/workflows/       # Scheduled satellite & climate ingestion
├── pipeline/                # Earth observation indices, summarization & object storage upload
├── scripts/                 # National COD-AB/BPS administrative boundary builder
├── web/                     # Astro 5 + Svelte 5 + MapLibre GL v5 + uPlot frontend
│   ├── public/mock-data/    # 514 Indonesian regencies/cities GeoJSON & 36-month series
│   └── src/                 # Map workbench, public regional view, citation & color scales
└── docs/                    # Architecture, scientific methodology & changelog
```

## 2. Interface & Cartographic Principles

- **Static-First Stack**: Built with **Astro 5 + Svelte 5 + MapLibre GL v5 + uPlot** to keep initial JavaScript lightweight while maintaining smooth desktop and mobile performance.
- **Isolated 3D Kinetic Pin-Field Route (`/kekeringan/relief/`)**: Dedicated Three.js `InstancedMesh` + custom GLSL bipolar shader (`pinFieldEngine.ts`) + Broadcast 2D HUD (`reliefHudRenderer.ts`) + deterministic WebCodecs `.mp4` / 4K `.png` exporter (`reliefExporter.ts`). `three` and `mp4-muxer` are strictly isolated to `/relief/` so the main `/kekeringan/` bundle pays zero overhead.
- **60 fps Vector Choropleth**: Applies MapLibre `match` paint expressions across all 514 polygons (`kode_bps`) so switching drought indices or animating 36 monthly frames updates GPU colors immediately without re-uploading GeoJSON geometry.
- **Visual System**: Clean paper-white canvas (`#FFFFFF` / `#FAFAFA`, `#000000` primary ink, `1px #E7E7E7` hairline grids, `0px` corners), `Overused Grotesk` sans-serif + `IBM Plex Mono` (`tabular-nums` for stable telemetry readouts), and colorblind-safe sequential/diverging drought ramps (`#334155` → `#E5DEC9` → `#D97706` → `#C2410C` → `#7C2D12`).
- **Print-Ready Briefs (`@media print`)**: Automatically hides interactive map chrome and navigation controls to produce clean PDF Policy Briefs complete with APA 7th citations.

## 3. Data Provenance & Security Hygiene

- All synthetic/offline baselines explicitly set `is_simulated: true` (`SIMULASI` badge in UI and metadata headers in CSV/GeoJSON/Markdown exports).
- Production object storage and Earth Engine credentials are injected exclusively via runtime environment variables and GitHub Secrets—zero secrets or internal infrastructure IDs are stored in source control.
