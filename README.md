# Drought in Control — Kekeringan & Kerentanan Lahan (`PDLVI`)

**Observatorium *Static-First* untuk pemantauan kekeringan pertanian (`SPI-3`, `SSMA`, `VHI`) dan Kerentanan Lahan Pascakekeringan (`PDLVI`) di Jawa Tengah (+ kontinuitas DAS perbatasan D.I. Yogyakarta).**

`Drought in Control` merupakan **Pilar 2** dalam ekosistem terfederasi [`agri.transbulent.id`](https://agri.transbulent.id) (melayani rute `/kekeringan/*` dan `/wilayah/*` via Cloudflare Workers Service Binding `DROUGHT`), sekaligus dapat dijalankan mandiri secara lokal sebagai proyek *Swiss Style / Dieter Rams Functionalism*.

## Fitur Inti

- **4 Layer Indeks Geospasial**: `SPI-3` (CHIRPS), `SSMA` (ERA5-Land / SMAP), `VHI` (MODIS NDVI + LST), dan **`PDLVI`** (*Post-Drought Land Vulnerability Index* — mengidentifikasi zona paling rentan retakan tanah & erosi kilat saat hujan awal turun pascakekeringan).
- **Drought Propagation Scrubber (24–60 Bulan)**: tombol *Play/Pause* animasi bulanan + indikator *lag effect* perambatan dari defisit hujan $\rightarrow$ kekeringan tanah $\rightarrow$ stres vegetasi $\rightarrow$ kerentanan lahan.
- **Region Inspector Drawer & Grafik 5 Tahun**: 4 *KPI Cards* dengan delta bulan lalu, grafik multi-variabel **uPlot** + garis ambang batas, serta **AI Executive Brief** 1 paragraf (JSON statis tervalidasi angka).
- **One-Click Academic & Policy Brief**: unduh deret waktu (`.csv`, `.geojson`, `.json`), ekspor laporan (`.md` & **Cetak PDF** lewat `@media print`), serta generator **sitasi otomatis APA Edisi ke-7**.
- **Jembatan Lintas Pilar ke `Panen-ID`**: dari *Region Inspector* suatu kabupaten (misal Magelang/Bompon atau Wonogiri), pengguna dapat langsung membuka analisis *Musim Ulang* (`/ulang/...`) pada periode kemarau yang sama.

## Arsitektur *Static-First & Zero-Maintenance*

- **Frontend (`web/`)**: Astro 5 + Svelte 5 + MapLibre GL v5 + `pmtiles`/COG + **uPlot** (seragam dengan `agri.transbulent.id`).
- **Data Pipeline (`pipeline/`)**: Python 3.11+ + Google Earth Engine (`earthengine-api`) + `rasterio`/`rio-cogeo` + `google-genai` (batch Executive Brief tervalidasi) + `boto3` ke Cloudflare R2, dijalankan otomatis oleh GitHub Actions tiap **tanggal 1 dan 15 pukul 02:00 UTC**.

## Indeks Dokumentasi (`docs/`)

| Berkas | Isi |
| --- | --- |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Struktur repo, desain *Swiss Style / Dieter Rams*, Service Binding `DROUGHT`, `@media print`, & jembatan ke `panen-id` |
| [docs/SCIENCE_AND_DATA.md](./docs/SCIENCE_AND_DATA.md) | Formulasi `SPI-3`, `VHI`, `SSMA`, `PDLVI`, batch AI Brief, sitasi APA 7th, & kontrak R2/JSON |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Tahapan build mandiri D0–D5 |
| [docs/PROGRESS.md](./docs/PROGRESS.md) | Daftar periksa progres D0–D5 & rincian atomik D1 |
| [docs/HANDOFF.md](./docs/HANDOFF.md) | Titik serah-terima sesi agar pekerjaan bisa berhenti & lanjut kapan saja |
