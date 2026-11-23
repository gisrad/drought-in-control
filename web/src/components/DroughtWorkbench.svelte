<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import uPlot from 'uplot';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import 'uplot/dist/uPlot.min.css';
  import type { DroughtDataset, DroughtIndexKey, DroughtRegionTimeseries } from '../types/drought';
  import { INDEX_META, colorForValue, statusLabelId } from '../utils/colorScales';
  import {
    buildApaCitations,
    buildPolicyBriefMarkdown,
    regionSeriesToCsv,
    triggerDownload,
  } from '../utils/citationGenerator';
  import TrialOverlay from './TrialOverlay.svelte';

  let dataset: DroughtDataset | null = null;
  let geojson: GeoJSON.FeatureCollection | null = null;
  let activeIndex: DroughtIndexKey = 'pdlvi';
  let monthIdx = 35;
  let playing = false;
  let playTimer: number | null = null;
  let selectedKode = '3312';
  let drawerOpen = true;
  let theme: 'kertas' | 'malam' = 'kertas';

  let remainingSec = 300;
  let authenticated = false;
  let userEmail = '';
  let wallActive = false;

  let mapContainer: HTMLDivElement;
  let map: maplibregl.Map | null = null;
  let chartContainer: HTMLDivElement;
  let chartInstance: uPlot | null = null;

  $: months = dataset?.months || [];
  $: activeYm = months[monthIdx] || '2026-11';
  $: selectedRegion = dataset?.regions[selectedKode] || null;
  $: activePt = selectedRegion?.series[monthIdx];
  $: prevPt = monthIdx > 0 ? selectedRegion?.series[monthIdx - 1] : undefined;

  function formatMmSs(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function toggleTheme() {
    theme = theme === 'kertas' ? 'malam' : 'kertas';
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('agri_theme', theme);
  }

  function applyMapColors() {
    if (!map || !geojson || !dataset) return;
    const enriched: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: geojson.features.map((f) => {
        const kode = String(f.properties?.kode_bps || '');
        const pt = dataset?.regions[kode]?.series[monthIdx];
        return {
          ...f,
          properties: {
            ...f.properties,
            fillColor: colorForValue(activeIndex, pt),
            isSelected: kode === selectedKode ? 1 : 0,
          },
        };
      }),
    };
    const src = map.getSource('jateng-regions') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(enriched);
  }

  function renderChart() {
    if (!chartContainer || !selectedRegion) return;
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    const xs = selectedRegion.series.map((_p, i) => i);
    const spi = selectedRegion.series.map((p) => p.spi3);
    const vhiScaled = selectedRegion.series.map((p) => Number(((p.vhi - 50) / 20).toFixed(2)));
    const labels = selectedRegion.series.map((p) => p.ym);

    chartInstance = new uPlot(
      {
        width: Math.max(280, chartContainer.clientWidth || 320),
        height: 170,
        cursor: { drag: { x: false, y: false } },
        scales: { x: { time: false }, y: { range: [-2.6, 2.2] } },
        axes: [
          {
            stroke: '#6B6B73',
            font: '10px IBM Plex Mono, monospace',
            values: (_u, vals) => vals.map((v) => labels[Math.round(v)] || ''),
          },
          { stroke: '#6B6B73', font: '10px IBM Plex Mono, monospace', size: 34 },
        ],
        series: [
          {},
          { label: 'SPI-3', stroke: '#B83B14', width: 2 },
          { label: 'VHI (norm)', stroke: '#12703B', width: 1.7, dash: [4, 3] },
        ],
      },
      [xs, spi, vhiScaled],
      chartContainer
    );
  }

  $: if (map && dataset && geojson) {
    activeIndex;
    monthIdx;
    selectedKode;
    applyMapColors();
  }

  $: if (selectedRegion && drawerOpen && chartContainer) {
    tick().then(renderChart);
  }

  function togglePlay() {
    if (playing) {
      if (playTimer) window.clearInterval(playTimer);
      playTimer = null;
      playing = false;
      return;
    }
    playing = true;
    playTimer = window.setInterval(() => {
      monthIdx = monthIdx >= months.length - 1 ? 0 : monthIdx + 1;
    }, 450);
  }

  onMount(async () => {
    const savedTheme = window.localStorage.getItem('agri_theme');
    if (savedTheme === 'kertas' || savedTheme === 'malam') {
      theme = savedTheme;
      document.documentElement.setAttribute('data-theme', theme);
    }

    const parts = window.location.pathname.replace(/\/+$/, '').split('/');
    const lastSeg = parts[parts.length - 1];
    if (/^\d{4}$/.test(lastSeg)) selectedKode = lastSeg;

    const [gjRes, tsRes] = await Promise.all([
      fetch('/kekeringan/mock-data/jateng-regions.geojson'),
      fetch('/kekeringan/mock-data/jateng-drought-36m.json'),
    ]);
    geojson = await gjRes.json();
    dataset = await tsRes.json();
    monthIdx = (dataset?.months.length || 36) - 1;
    if (dataset && !dataset.regions[selectedKode]) selectedKode = '3312';

    await tick();

    map = new maplibregl.Map({
      container: mapContainer,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [110.25, -7.52],
      zoom: 8.1,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      if (!map || !geojson) return;
      map.addSource('jateng-regions', { type: 'geojson', data: geojson });
      map.addLayer({
        id: 'jateng-fill',
        type: 'fill',
        source: 'jateng-regions',
        paint: {
          'fill-color': ['coalesce', ['get', 'fillColor'], '#E5DEC9'],
          'fill-opacity': 0.72,
        },
      });
      map.addLayer({
        id: 'jateng-line',
        type: 'line',
        source: 'jateng-regions',
        paint: {
          'line-color': ['case', ['==', ['get', 'isSelected'], 1], '#000000', '#52525B'],
          'line-width': ['case', ['==', ['get', 'isSelected'], 1], 2.4, 0.9],
        },
      });

      applyMapColors();

      map.on('click', 'jateng-fill', (e) => {
        const kode = e.features?.[0]?.properties?.kode_bps;
        if (kode && dataset?.regions[String(kode)]) {
          selectedKode = String(kode);
          drawerOpen = true;
        }
      });
      map.on('mouseenter', 'jateng-fill', () => {
        if (map) map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'jateng-fill', () => {
        if (map) map.getCanvas().style.cursor = '';
      });
    });
  });

  onDestroy(() => {
    if (playTimer) window.clearInterval(playTimer);
    if (chartInstance) chartInstance.destroy();
    if (map) map.remove();
  });

  function deltaStr(cur?: number, prev?: number, digits = 2): string {
    if (cur === undefined || prev === undefined) return '—';
    const d = cur - prev;
    return `${d >= 0 ? '+' : ''}${d.toFixed(digits)}`;
  }
</script>

<div style="min-height: 100vh; display: flex; flex-direction: column;">
  <div class="agri-spectrum-banner no-print">
    JAWA TENGAH &amp; PERBATASAN DAS DIY · SPI-3 · SSMA · VHI · PDLVI · {dataset?.is_simulated ? 'SIMULASI MOCK D1–D3' : 'DATA SATELIT'}
  </div>

  <header class="topbar no-print">
    <div class="topbar-inner">
      <a href="/" class="brand-link">
        <span class="brand-box">AG</span>
        <span>agri.transbulent.id</span>
      </a>

      <nav class="hnav" aria-label="Navigasi">
        <a href="/">Beranda</a>
        <a href="/ulang/bompon-magelang/mt2-2025/">Musim Ulang</a>
        <a href="/kekeringan/" class="on">Kekeringan</a>
        <a href="/metode/">Metode</a>
        <a href="/lobby/">Lobby</a>
      </nav>

      <div style="display: flex; align-items: center; gap: 8px; margin-left: auto;">
        <span class="pill-badge pill-sim">SIMULASI · JATENG</span>
        {#if authenticated}
          <span class="live-badge"><span class="live-dot"></span><span>{userEmail}</span></span>
        {:else}
          <a href="/lobby/" class="live-badge">
            <span class={`live-dot ${remainingSec <= 60 ? 'is-warn' : ''}`}></span>
            <span>Pratinjau</span>
            <b>{formatMmSs(remainingSec)}</b>
          </a>
        {/if}
        <button type="button" class="btn-subtle" on:click={toggleTheme}>
          {theme === 'kertas' ? 'Malam' : 'Putih'}
        </button>
      </div>
    </div>
  </header>

  <main class="no-print" style="position: relative; flex: 1; min-height: 620px; display: grid; grid-template-columns: 1fr auto;">
    <!-- Peta Layar Penuh -->
    <div style="position: relative; min-height: 620px;">
      <div bind:this={mapContainer} style="position: absolute; inset: 0;"></div>

      <!-- Floating Layer Switcher -->
      <aside style="position: absolute; top: 14px; left: 14px; z-index: 10; background: var(--dock-bg); border: 1.5px solid var(--border-ink); padding: 12px; width: min(330px, calc(100vw - 28px));">
        <div class="num" style="font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-muted); margin-bottom: 8px;">
          PILIH INDEKS KEKERINGAN
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          {#each (['spi3', 'ssma', 'vhi', 'pdlvi'] as DroughtIndexKey[]) as k}
            <button
              type="button"
              class={activeIndex === k ? 'btn-primary' : 'btn-subtle'}
              style="padding: 8px 6px; font-size: 10.5px;"
              on:click={() => (activeIndex = k)}
            >
              {INDEX_META[k].short}
            </button>
          {/each}
        </div>
        <p style="margin: 10px 0 8px; font-size: 12px; color: var(--ink-secondary);">{INDEX_META[activeIndex].desc}</p>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 2px;">
          {#each INDEX_META[activeIndex].stops as [lbl, col]}
            <div>
              <div style={`height: 8px; background: ${col};`}></div>
              <div class="num" style="font-size: 9px; color: var(--ink-muted); margin-top: 3px;">{lbl}</div>
            </div>
          {/each}
        </div>
      </aside>

      <!-- Drought Propagation Scrubber -->
      <section style="position: absolute; bottom: 16px; left: 14px; right: 56px; max-width: 720px; z-index: 10; background: var(--dock-bg); border: 1.5px solid var(--border-ink); padding: 12px 14px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <button type="button" class="btn-primary" style="padding: 7px 12px;" on:click={togglePlay}>
            {playing ? 'Jeda' : 'Putar 36 Bln'}
          </button>
          <input
            type="range"
            min="0"
            max={Math.max(0, months.length - 1)}
            bind:value={monthIdx}
            aria-label="Timeline bulan kekeringan"
            style="flex: 1; accent-color: #000000;"
          />
          <strong class="num" style="font-size: 13px;">{activeYm}</strong>
        </div>
        <div class="num" style="margin-top: 7px; font-size: 10px; color: var(--ink-muted); display: flex; gap: 10px; flex-wrap: wrap;">
          <span>RANTAI PROPAGASI:</span>
          <span>1. Defisit Hujan (SPI-3) →</span>
          <span>2. Tanah Kering (SSMA, +1 bln) →</span>
          <span>3. Stres Vegetasi (VHI, +2 bln) →</span>
          <span>4. Erosi Pascakekeringan (PDLVI)</span>
        </div>
      </section>
    </div>

    <!-- Region Inspector Drawer -->
    {#if drawerOpen && selectedRegion && activePt}
      <aside style="width: min(410px, 100vw); background: var(--bg); border-left: 1px solid var(--border-ink); padding: 18px; overflow-y: auto; max-height: calc(100vh - 90px); display: grid; gap: 14px; align-content: start;">
        <div style="display: flex; justify-content: space-between; align-items: start; gap: 8px;">
          <div>
            <div class="num" style="font-size: 10.5px; color: var(--ink-muted);">
              BPS {selectedRegion.kode_bps} · {selectedRegion.provinsi} · DAS {selectedRegion.das}
            </div>
            <h1 style="margin: 3px 0 0; font-size: 1.3rem; font-weight: 600;">{selectedRegion.nama}</h1>
          </div>
          <button type="button" class="btn-subtle" on:click={() => (drawerOpen = false)}>Tutup</button>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <span class={`pill-badge ${activePt.status === 'parah' || activePt.status === 'ekstrem' ? 'pill-warn' : 'pill-sim'}`}>
            {statusLabelId(activePt.status)} ({activeYm})
          </span>
          <span class="num" style="font-size: 11px; color: var(--ink-muted);">
            Lereng {selectedRegion.mean_slope_deg}°
          </span>
        </div>

        <!-- 4 KPI Cards (Hairline Matrix 1px) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--border); border: 1px solid var(--border);">
          <div style="background: var(--bg); padding: 10px;">
            <div class="num" style="font-size: 10px; color: var(--ink-muted);">SPI-3</div>
            <div class="num" style="font-size: 1.35rem; font-weight: 600;">{activePt.spi3}</div>
            <div class="num" style="font-size: 10px; color: var(--ink-secondary);">Δ {deltaStr(activePt.spi3, prevPt?.spi3)}</div>
          </div>
          <div style="background: var(--bg); padding: 10px;">
            <div class="num" style="font-size: 10px; color: var(--ink-muted);">SSMA</div>
            <div class="num" style="font-size: 1.35rem; font-weight: 600;">{activePt.ssma}</div>
            <div class="num" style="font-size: 10px; color: var(--ink-secondary);">Δ {deltaStr(activePt.ssma, prevPt?.ssma)}</div>
          </div>
          <div style="background: var(--bg); padding: 10px;">
            <div class="num" style="font-size: 10px; color: var(--ink-muted);">VHI</div>
            <div class="num" style="font-size: 1.35rem; font-weight: 600;">{activePt.vhi}</div>
            <div class="num" style="font-size: 10px; color: var(--ink-secondary);">Δ {deltaStr(activePt.vhi, prevPt?.vhi, 1)}</div>
          </div>
          <div style="background: var(--bg); padding: 10px;">
            <div class="num" style="font-size: 10px; color: var(--ink-muted);">PDLVI</div>
            <div class="num" style="font-size: 1.35rem; font-weight: 600;">{activePt.pdlvi}</div>
            <div class="num" style="font-size: 10px; color: var(--ink-secondary);">Δ {deltaStr(activePt.pdlvi, prevPt?.pdlvi)}</div>
          </div>
        </div>

        <!-- Grafik uPlot -->
        <div style="border: 1px solid var(--border); padding: 10px; background: var(--surface);">
          <div class="num" style="font-size: 10px; color: var(--ink-muted); margin-bottom: 6px;">
            DERET WAKTU 36 BULAN · SPI-3 (MERAH) VS VHI TERNORMALISASI (HIJAU)
          </div>
          <div bind:this={chartContainer}></div>
        </div>

        <!-- Executive Brief -->
        <div style="border-top: 1px solid var(--border); padding-top: 10px;">
          <div class="num" style="font-size: 10px; color: var(--ink-muted); margin-bottom: 5px;">RINGKASAN ANALISIS WILAYAH</div>
          <p style="margin: 0; font-size: 0.88rem; color: var(--ink-secondary);">{selectedRegion.executive_brief_id}</p>
        </div>

        <!-- Jembatan Lintas Pilar ke Panen-ID -->
        {#if selectedRegion.linked_panen_field_id}
          <a href={`/ulang/${selectedRegion.linked_panen_field_id}/mt2-2025/`} class="btn-primary">
            Buka Musim Ulang Lahan di Wilayah Ini →
          </a>
        {/if}

        <!-- One-Click Academic & Policy Brief -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; border-top: 1px solid var(--border); padding-top: 12px;">
          <button
            type="button"
            class="btn-outline"
            on:click={() => triggerDownload(`drought-${selectedRegion.kode_bps}.csv`, regionSeriesToCsv(selectedRegion, true), 'text/csv;charset=utf-8')}
          >
            Unduh CSV
          </button>
          <button
            type="button"
            class="btn-outline"
            on:click={() => triggerDownload(`drought-${selectedRegion.kode_bps}.json`, JSON.stringify(selectedRegion, null, 2), 'application/json')}
          >
            Unduh JSON
          </button>
          <button
            type="button"
            class="btn-outline"
            on:click={() => triggerDownload(`policy-brief-${selectedRegion.kode_bps}-${activeYm}.md`, buildPolicyBriefMarkdown(selectedRegion, activeYm, true), 'text/markdown;charset=utf-8')}
          >
            Brief (.md)
          </button>
          <button type="button" class="btn-primary" on:click={() => window.print()}>
            Cetak PDF (APA 7)
          </button>
        </div>
      </aside>
    {:else if !drawerOpen}
      <button
        type="button"
        class="btn-primary"
        style="position: absolute; top: 14px; right: 14px; z-index: 15;"
        on:click={() => (drawerOpen = true)}
      >
        Buka Inspektor Wilayah
      </button>
    {/if}
  </main>

  <!-- Dokumen Cetak PDF (Hanya aktif pada @media print) -->
  {#if selectedRegion && activePt}
    <section class="print-report" style="display: none;">
      <h1>Policy Brief Kekeringan &amp; Kerentanan Lahan — {selectedRegion.nama}</h1>
      <p>Kode BPS {selectedRegion.kode_bps} · {selectedRegion.provinsi} · DAS {selectedRegion.das} · Bulan {activeYm} · Status: {statusLabelId(activePt.status)} (SIMULASI D1–D3)</p>
      <p>SPI-3: {activePt.spi3} | SSMA: {activePt.ssma} | VHI: {activePt.vhi} | PDLVI: {activePt.pdlvi}</p>
      <h2>Ringkasan Analisis</h2>
      <p>{selectedRegion.executive_brief_id}</p>
      <h2>Referensi (APA Edisi ke-7)</h2>
      <ol>
        {#each buildApaCitations() as cit}
          <li>{cit}</li>
        {/each}
      </ol>
    </section>
  {/if}

  <TrialOverlay bind:remainingSec bind:authenticated bind:userEmail bind:wallActive />
</div>
