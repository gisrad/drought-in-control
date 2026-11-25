<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import type { DroughtDataset, DroughtIndexKey } from '../types/drought';
  import { CLIMATE_ZONE_META, getClimateZone, type BmkgClimateZone } from '../utils/climateZones';
  import {
    ASPECT_DIMS,
    METRIC_VISUALS,
    normalizeForShader,
    parsePinBin,
    REGION_PRESETS,
    smoothGridFrame,
    type AnchorCity,
    type AspectPreset,
    type ParsedPinBin,
    type PinGridJson,
    type ReliefLocale,
    type ReliefRegionId,
  } from '../utils/pinFieldConfig';
  import { PinFieldEngine } from '../utils/pinFieldEngine';
  import { renderReliefCompositeFrame } from '../utils/reliefHudRenderer';
  import { exportReliefPosterPng, exportReliefVideo } from '../utils/reliefExporter';

  const REGION_KEYS: ReliefRegionId[] = [
    'indonesia',
    'jawa',
    'jateng',
    'sumatera',
    'ntt_bali',
    'kalimantan',
    'sulawesi',
  ];
  const METRIC_KEYS: DroughtIndexKey[] = ['spi3', 'ssma', 'vhi', 'pdlvi'];

  let dataset: DroughtDataset | null = null;
  let activeGrid: PinGridJson | null = null;
  let customPinBin: ParsedPinBin | null = null;

  let regionId: ReliefRegionId = 'indonesia';
  let metric: DroughtIndexKey = 'spi3';
  let aspect: AspectPreset = 'auto';
  let locale: ReliefLocale = 'id';
  let climateFilter: 'all' | BmkgClimateZone = 'all';
  let smoothField = true;
  let studioOpen = false;
  let showSafeZone = true;
  let hookMode = false;
  let autoPan = true;
  let exportDurationSec = 24;
  let exportFps: 30 | 60 = 30;
  let customTitle = '';
  let customSubtitle = '';

  let playing = true;
  let speedMul = 1;
  let frameFloat = 0;
  let loading = true;
  let loadError = '';
  let statusNotice = '';
  let exporting = false;
  let exportPct = 0;
  let exportMsg = '';
  let exportAbort: AbortController | null = null;

  let timeLabels: string[] = [];
  let meanSeries: number[] = [];
  let shaderFrames: Float32Array[] = [];
  let rawFrames: Float32Array[] = [];
  let currentAnchors: AnchorCity[] = [];
  let currentSpacingKm = 14.5;
  let currentIsSimulated = true;
  let currentSourceLabel = '514 BPS Mock 36-Bln';
  let currentCadence: 'monthly' | 'annual_spi12' = 'monthly';

  let stageEl: HTMLDivElement;
  let compositeCanvas: HTMLCanvasElement;
  let engine: PinFieldEngine | null = null;
  let rafId = 0;
  let lastTickMs = 0;
  let dragging = false;
  let dragLastX = 0;
  let dragLastY = 0;

  let hoveredInfo: {
    nama: string;
    provinsi: string;
    val: string;
    zone: string;
  } | null = null;

  function getCanvasDims(): { w: number; h: number } {
    if (aspect !== 'auto') {
      return { w: ASPECT_DIMS[aspect].w, h: ASPECT_DIMS[aspect].h };
    }
    const rect = stageEl?.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(360, Math.round((rect?.width || window.innerWidth) * dpr));
    const h = Math.max(300, Math.round((rect?.height || window.innerHeight - 48) * dpr));
    return { w, h };
  }

  function effectivePoseAspect(): '16x9' | '9x16' | '4x5' {
    if (aspect === '16x9' || aspect === '9x16' || aspect === '4x5') return aspect;
    const rect = stageEl?.getBoundingClientRect();
    if (rect && rect.height > rect.width * 1.15) return '9x16';
    return '16x9';
  }

  function applyDefaultCamera() {
    if (!engine) return;
    const pose = REGION_PRESETS[regionId].poseByAspect[effectivePoseAspect()];
    engine.setCameraPose(pose);
  }

  function rebuildDataCube() {
    if (!engine) return;
    if (customPinBin) {
      const { meta, lons, lats, frames } = customPinBin;
      const presetCfg = REGION_PRESETS[regionId] || REGION_PRESETS.indonesia;
      engine.setGrid({
        lons,
        lats,
        stepDeg: meta.step_deg || 0.1,
        pinScale: presetCfg.pinScale,
        heightScale: presetCfg.heightScale,
      });
      engine.applyMetricSpec(meta.metric || 'spi3');
      metric = meta.metric || 'spi3';
      timeLabels = meta.time_labels;
      currentAnchors = meta.anchors || activeGrid?.anchors || [];
      currentSpacingKm = meta.spacing_km || 11.0;
      currentIsSimulated = Boolean(meta.is_simulated);
      currentSourceLabel = meta.source || 'CHIRPS v2.0';
      currentCadence = meta.cadence || 'annual_spi12';

      rawFrames = frames;
      shaderFrames = frames.map((fr) => {
        const norm = new Float32Array(fr.length);
        let sum = 0;
        for (let i = 0; i < fr.length; i++) {
          sum += fr[i];
          norm[i] = normalizeForShader(metric, fr[i]);
        }
        return norm;
      });
      meanSeries = frames.map((fr) => {
        let sum = 0;
        for (let i = 0; i < fr.length; i++) sum += fr[i];
        return fr.length ? sum / fr.length : 0;
      });
      engine.setMask(new Float32Array(lons.length).fill(1.0));
      frameFloat = Math.max(0, timeLabels.length - 1);
      return;
    }

    if (!activeGrid || !dataset) return;
    const grid = activeGrid;
    const presetCfg = REGION_PRESETS[regionId];
    engine.setGrid({
      lons: grid.lons,
      lats: grid.lats,
      stepDeg: grid.stepDeg,
      pinScale: presetCfg.pinScale,
      heightScale: presetCfg.heightScale,
    });
    engine.applyMetricSpec(metric);

    timeLabels = dataset.months;
    currentAnchors = grid.anchors;
    currentSpacingKm = grid.spacingKm;
    currentIsSimulated = Boolean(dataset.is_simulated);
    currentSourceLabel = dataset.is_simulated ? 'Simulasi 36 Bln' : 'R2 Satelit';
    currentCadence = 'monthly';

    const tCount = dataset.months.length;
    const pCount = grid.pinCount;
    const nextRaw: Float32Array[] = [];
    const nextShader: Float32Array[] = [];
    const nextMeans: number[] = [];

    for (let t = 0; t < tCount; t++) {
      let vals = new Float32Array(pCount);
      for (let i = 0; i < pCount; i++) {
        const kode = grid.codes[grid.regIdx[i]];
        const reg = dataset.regions[kode];
        vals[i] = reg?.series[t]?.[metric] ?? 0;
      }
      if (smoothField) {
        vals = smoothGridFrame(vals, grid.cols, grid.rows, 2);
      }
      let sum = 0;
      let activeSumCount = 0;
      const norm = new Float32Array(pCount);
      for (let i = 0; i < pCount; i++) {
        const v = vals[i];
        const kode = grid.codes[grid.regIdx[i]];
        if (climateFilter === 'all' || getClimateZone(kode) === climateFilter) {
          sum += v;
          activeSumCount++;
        }
        norm[i] = normalizeForShader(metric, v);
      }
      nextRaw.push(vals);
      nextShader.push(norm);
      nextMeans.push(activeSumCount > 0 ? sum / activeSumCount : 0);
    }

    rawFrames = nextRaw;
    shaderFrames = nextShader;
    meanSeries = nextMeans;
    updatePinMasks();

    if (frameFloat > Math.max(0, tCount - 1)) {
      frameFloat = Math.max(0, tCount - 1);
    }
  }

  function updatePinMasks() {
    if (!engine || !activeGrid || customPinBin) return;
    const n = activeGrid.pinCount;
    const mask = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const kode = activeGrid.codes[activeGrid.regIdx[i]];
      mask[i] = climateFilter === 'all' || getClimateZone(kode) === climateFilter ? 1.0 : 0.16;
    }
    engine.setMask(mask);
  }

  async function loadRegion(nextRegion: ReliefRegionId, resetCam = true) {
    regionId = nextRegion;
    customPinBin = null;
    loading = true;
    loadError = '';
    try {
      const res = await fetch(`/kekeringan/relief-data/grid-${nextRegion}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      activeGrid = (await res.json()) as PinGridJson;
      rebuildDataCube();
      if (resetCam) applyDefaultCamera();
      syncUrlParams();
    } catch (err) {
      loadError = `Gagal memuat grid ${nextRegion}: ${String(err)}`;
    } finally {
      loading = false;
    }
  }

  function selectMetric(nextMetric: DroughtIndexKey) {
    metric = nextMetric;
    customPinBin = null;
    rebuildDataCube();
    syncUrlParams();
  }

  function selectAspect(nextAspect: AspectPreset) {
    aspect = nextAspect;
    tick().then(() => {
      syncCanvasResolution();
      applyDefaultCamera();
      syncUrlParams();
    });
  }

  function syncCanvasResolution() {
    if (!engine || !compositeCanvas) return;
    const { w, h } = getCanvasDims();
    if (compositeCanvas.width !== w || compositeCanvas.height !== h) {
      compositeCanvas.width = w;
      compositeCanvas.height = h;
    }
    engine.resize(w, h);
  }

  function syncUrlParams() {
    if (typeof window === 'undefined') return;
    const u = new URL(window.location.href);
    u.searchParams.set('region', regionId);
    u.searchParams.set('idx', metric);
    if (aspect !== 'auto') u.searchParams.set('aspect', aspect);
    else u.searchParams.delete('aspect');
    if (climateFilter !== 'all') u.searchParams.set('zone', climateFilter);
    else u.searchParams.delete('zone');
    window.history.replaceState(null, '', u.toString());
  }

  function renderFrameNow() {
    if (!engine || !compositeCanvas || shaderFrames.length === 0) return;
    const ctx = compositeCanvas.getContext('2d');
    if (!ctx) return;

    const maxIdx = Math.max(0, shaderFrames.length - 1);
    const clamped = Math.max(0, Math.min(maxIdx, frameFloat));
    const i0 = Math.floor(clamped);
    const i1 = Math.min(maxIdx, i0 + 1);
    const blend = clamped - i0;

    if (autoPan && regionId === 'indonesia' && effectivePoseAspect() === '9x16' && !dragging && playing) {
      const u = maxIdx > 0 ? clamped / maxIdx : 0.5;
      const basePose = REGION_PRESETS.indonesia.poseByAspect['9x16'];
      engine.setCameraPose({ ...basePose, offsetX: -0.44 + u * 0.86 });
    }

    engine.setValues(shaderFrames[i0], shaderFrames[i1], blend);
    engine.render();

    const zoneBadge = climateFilter !== 'all' ? CLIMATE_ZONE_META[climateFilter].short.toUpperCase() : undefined;
    renderReliefCompositeFrame({
      ctx,
      width: compositeCanvas.width,
      height: compositeCanvas.height,
      engine,
      regionId,
      metric,
      locale,
      aspect,
      timeLabels,
      meanSeries,
      frameFloat: clamped,
      spacingKm: currentSpacingKm,
      isSimulated: currentIsSimulated,
      sourceLabel: currentSourceLabel,
      anchors: currentAnchors,
      cadence: currentCadence,
      customTitle,
      customSubtitle,
      showSafeZoneGuides: showSafeZone && studioOpen,
      climateZoneLabel: zoneBadge,
    });
  }

  function tickLoop(nowMs: number) {
    if (!lastTickMs) lastTickMs = nowMs;
    const dt = Math.min(0.1, (nowMs - lastTickMs) / 1000);
    lastTickMs = nowMs;

    if (playing && !exporting && shaderFrames.length > 1) {
      const rate = currentCadence === 'annual_spi12' ? 1.85 : 2.3;
      frameFloat += dt * rate * speedMul;
      if (frameFloat > shaderFrames.length - 1) {
        frameFloat = 0;
      }
    }
    if (!exporting) {
      renderFrameNow();
    }
    rafId = window.requestAnimationFrame(tickLoop);
  }

  function handlePointerDown(e: PointerEvent) {
    dragging = true;
    dragLastX = e.clientX;
    dragLastY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (dragging && engine) {
      const dx = e.clientX - dragLastX;
      const dy = e.clientY - dragLastY;
      dragLastX = e.clientX;
      dragLastY = e.clientY;
      engine.orbitBy(-dx * 0.0065, dy * 0.0055);
      return;
    }

    if (!engine || !compositeCanvas || !activeGrid || !dataset || customPinBin) {
      hoveredInfo = null;
      return;
    }
    const rect = compositeCanvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / Math.max(1, rect.width)) * compositeCanvas.width;
    const py = ((e.clientY - rect.top) / Math.max(1, rect.height)) * compositeCanvas.height;
    const hit = engine.pickPinAtCanvasPoint(px, py, compositeCanvas.width, compositeCanvas.height);
    if (!hit) {
      hoveredInfo = null;
      return;
    }
    const kode = activeGrid.codes[activeGrid.regIdx[hit.index]];
    const reg = dataset.regions[kode];
    const tIdx = Math.round(frameFloat);
    const val = rawFrames[tIdx]?.[hit.index] ?? 0;
    if (reg) {
      hoveredInfo = {
        nama: reg.nama,
        provinsi: reg.provinsi,
        val: `${METRIC_VISUALS[metric].unitLabel} ${val.toFixed(metric === 'vhi' ? 1 : 2)}`,
        zone: CLIMATE_ZONE_META[getClimateZone(kode)].short,
      };
    }
  }

  function handlePointerUp() {
    dragging = false;
  }

  function handleWheel(e: WheelEvent) {
    if (!engine) return;
    e.preventDefault();
    engine.zoomBy(e.deltaY > 0 ? 1.07 : 0.93);
  }

  async function runPosterExport() {
    if (!engine || shaderFrames.length === 0) return;
    const targetAspect: Exclude<AspectPreset, 'auto'> = aspect === 'auto' ? '16x9' : aspect;
    statusNotice = 'Merender poster 4K PNG...';
    try {
      await exportReliefPosterPng({
        engine,
        shaderFrames,
        regionId,
        metric,
        locale,
        aspect: targetAspect,
        timeLabels,
        meanSeries,
        spacingKm: currentSpacingKm,
        isSimulated: currentIsSimulated,
        sourceLabel: currentSourceLabel,
        anchors: currentAnchors,
        cadence: currentCadence,
        customTitle,
        customSubtitle,
        climateZoneLabel: climateFilter !== 'all' ? CLIMATE_ZONE_META[climateFilter].short.toUpperCase() : undefined,
        basePose: REGION_PRESETS[regionId].poseByAspect[targetAspect],
        frameFloat,
      });
      statusNotice = `Poster PNG (${ASPECT_DIMS[targetAspect].w * 2}×${ASPECT_DIMS[targetAspect].h * 2}) berhasil diunduh.`;
    } catch (err) {
      statusNotice = `Gagal ekspor PNG: ${String(err)}`;
    } finally {
      syncCanvasResolution();
    }
  }

  async function runVideoExport() {
    if (!engine || shaderFrames.length === 0 || exporting) return;
    const targetAspect: Exclude<AspectPreset, 'auto'> = aspect === 'auto' ? '16x9' : aspect;
    exporting = true;
    exportPct = 0;
    exportMsg = 'Menyiapkan encoder video...';
    exportAbort = new AbortController();
    const wasPlaying = playing;
    playing = false;

    try {
      const res = await exportReliefVideo({
        engine,
        shaderFrames,
        regionId,
        metric,
        locale,
        aspect: targetAspect,
        timeLabels,
        meanSeries,
        spacingKm: currentSpacingKm,
        isSimulated: currentIsSimulated,
        sourceLabel: currentSourceLabel,
        anchors: currentAnchors,
        cadence: currentCadence,
        customTitle,
        customSubtitle,
        climateZoneLabel: climateFilter !== 'all' ? CLIMATE_ZONE_META[climateFilter].short.toUpperCase() : undefined,
        basePose: REGION_PRESETS[regionId].poseByAspect[targetAspect],
        durationSec: exportDurationSec,
        fps: exportFps,
        hookMode,
        autoPan,
        signal: exportAbort.signal,
        onProgress: (pct, msg) => {
          exportPct = pct;
          exportMsg = msg;
        },
      });
      statusNotice =
        res.format === 'mp4'
          ? `Video .mp4 (${ASPECT_DIMS[targetAspect].label}) siap diposting!`
          : 'Browser tidak mendukung H.264 WebCodecs; fallback ke .webm berhasil diunduh.';
    } catch (err) {
      statusNotice = String(err);
    } finally {
      exporting = false;
      exportAbort = null;
      syncCanvasResolution();
      playing = wasPlaying;
    }
  }

  async function handlePinBinUpload(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const parsed = parsePinBin(buf);
      customPinBin = parsed;
      const rId = parsed.meta.region as ReliefRegionId;
      if (REGION_PRESETS[rId]) regionId = rId;
      rebuildDataCube();
      applyDefaultCamera();
      statusNotice = `Data satelit .pinbin dimuat (${parsed.meta.pin_count} pin, ${parsed.meta.time_count} periode · ${parsed.meta.source}).`;
    } catch (err) {
      statusNotice = `Berkas .pinbin tidak valid: ${String(err)}`;
    } finally {
      input.value = '';
    }
  }

  function resetToBaseline() {
    customPinBin = null;
    rebuildDataCube();
    applyDefaultCamera();
    statusNotice = 'Kembali ke seri baseline 514 kabupaten/kota.';
  }

  function copyReliefLink() {
    syncUrlParams();
    navigator.clipboard?.writeText(window.location.href).then(
      () => (statusNotice = 'Tautan 3D Relief disalin ke papan klip.'),
      () => (statusNotice = window.location.href)
    );
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  onMount(async () => {
    const qs = new URLSearchParams(window.location.search);
    const qReg = qs.get('region') as ReliefRegionId | null;
    if (qReg && REGION_PRESETS[qReg]) regionId = qReg;
    const qIdx = qs.get('idx') as DroughtIndexKey | null;
    if (qIdx && METRIC_KEYS.includes(qIdx)) metric = qIdx;
    const qAspect = qs.get('aspect') as AspectPreset | null;
    if (qAspect && (qAspect === 'auto' || qAspect === '16x9' || qAspect === '9x16' || qAspect === '4x5')) {
      aspect = qAspect;
    }
    const qZone = qs.get('zone');
    if (qZone === 'monsunal' || qZone === 'ekuatorial' || qZone === 'lokal') climateFilter = qZone;
    if (qs.get('studio') === '1') studioOpen = true;
    if (qs.get('safe') === '0') showSafeZone = false;

    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) playing = false;

    engine = new PinFieldEngine(1280, 720);
    syncCanvasResolution();

    try {
      let tsRes = await fetch('/api/v1/r2/v1/drought/idn/drought-36m-514.json');
      if (!tsRes.ok) {
        tsRes = await fetch('/kekeringan/mock-data/jateng-drought-36m.json');
      }
      dataset = (await tsRes.json()) as DroughtDataset;
      await loadRegion(regionId, true);

      const qMonth = qs.get('m');
      if (qMonth !== null && qMonth !== '' && Number.isFinite(Number(qMonth))) {
        frameFloat = Math.max(0, Math.min(Math.max(0, timeLabels.length - 1), Number(qMonth)));
        playing = false;
      } else {
        frameFloat = 0;
      }
    } catch (err) {
      loadError = `Gagal memuat dataset kekeringan: ${String(err)}`;
      loading = false;
    }

    const onResize = () => syncCanvasResolution();
    window.addEventListener('resize', onResize);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => syncCanvasResolution()) : null;
    if (ro && stageEl) ro.observe(stageEl);
    rafId = window.requestAnimationFrame(tickLoop);

    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  });

  onDestroy(() => {
    if (rafId) window.cancelAnimationFrame(rafId);
    exportAbort?.abort();
    engine?.dispose();
  });

  $: back2dUrl = `/kekeringan/?idx=${metric}`;
</script>

<div class="relief-shell">
  <!-- Minimalist Studio Topbar -->
  <header class="relief-topbar">
    <div class="relief-brand-group">
      <a href={back2dUrl} class="relief-back-btn">← Peta 2D</a>
      <span class="relief-brand-title">agri.transbulent.id <span class="mono-dim">/ relief</span></span>
    </div>

    <div class="relief-pill-strip" role="group" aria-label="Pilih wilayah">
      {#each REGION_KEYS as rk}
        <button
          type="button"
          class={regionId === rk ? 'r-pill active' : 'r-pill'}
          on:click={() => loadRegion(rk, true)}
        >
          {locale === 'en' ? REGION_PRESETS[rk].labelEn : REGION_PRESETS[rk].label}
        </button>
      {/each}
    </div>

    <div class="relief-right-tools">
      <div class="relief-pill-strip" role="group" aria-label="Pilih indeks">
        {#each METRIC_KEYS as mk}
          <button
            type="button"
            class={metric === mk ? 'r-pill active' : 'r-pill'}
            on:click={() => selectMetric(mk)}
          >
            {METRIC_VISUALS[mk].unitLabel}
          </button>
        {/each}
      </div>

      <button
        type="button"
        class="r-pill"
        on:click={() => (locale = locale === 'id' ? 'en' : 'id')}
        title="Ganti bahasa judul HUD"
      >
        {locale.toUpperCase()}
      </button>

      <button type="button" class="r-pill hide-sm" on:click={toggleFullscreen} title="Layar Penuh">
        ⛶
      </button>

      <button
        type="button"
        class={studioOpen ? 'r-cta active' : 'r-cta'}
        on:click={() => (studioOpen = !studioOpen)}
      >
        {studioOpen ? 'Tutup Studio' : 'Studio Ekspor'}
      </button>
    </div>
  </header>

  <!-- Main Stage + Optional Collapsible Creator Drawer -->
  <div class="relief-workspace">
    <main class="relief-stage" bind:this={stageEl}>
      {#if loading}
        <div class="relief-status-overlay">Memuat pin-field {REGION_PRESETS[regionId].label}...</div>
      {:else if loadError}
        <div class="relief-status-overlay error">{loadError}</div>
      {/if}

      <div
        class="canvas-frame"
        class:frame-16x9={aspect === '16x9'}
        class:frame-9x16={aspect === '9x16'}
        class:frame-4x5={aspect === '4x5'}
        class:frame-auto={aspect === 'auto'}
      >
        <canvas
          bind:this={compositeCanvas}
          class="relief-canvas"
          on:pointerdown={handlePointerDown}
          on:pointermove={handlePointerMove}
          on:pointerup={handlePointerUp}
          on:pointerleave={handlePointerUp}
          on:wheel={handleWheel}
        ></canvas>
      </div>

      {#if hoveredInfo}
        <div class="hover-chip">
          <strong>{hoveredInfo.nama}</strong>
          <span>{hoveredInfo.provinsi}</span>
          <span class="mono">{hoveredInfo.val}</span>
          <span class="mono-dim">{hoveredInfo.zone}</span>
        </div>
      {/if}

      <!-- Compact Playback Bar (Never recorded into exports) -->
      <div class="playback-dock">
        <button type="button" class="dock-btn primary" on:click={() => (playing = !playing)}>
          {playing ? 'Jeda' : 'Putar'}
        </button>
        <input
          type="range"
          min="0"
          max={Math.max(0, timeLabels.length - 1)}
          step="0.05"
          bind:value={frameFloat}
          aria-label="Timeline periode"
          class="dock-slider"
        />
        <span class="dock-ym">{timeLabels[Math.round(frameFloat)] || '—'}</span>
        <button
          type="button"
          class="dock-btn"
          on:click={() => (speedMul = speedMul === 1 ? 2 : speedMul === 2 ? 0.5 : 1)}
          title="Kecepatan putar"
        >
          {speedMul}×
        </button>
        <button type="button" class="dock-btn hide-sm" on:click={applyDefaultCamera}>
          Reset Kamera
        </button>
        <button type="button" class="dock-btn hide-sm" on:click={runPosterExport}>
          PNG 4K
        </button>
      </div>
    </main>

    {#if studioOpen}
      <aside class="creator-drawer" aria-label="Studio Ekspor Sosial Media">
        <div class="drawer-head">
          <div>
            <div class="mono-label">CREATOR STUDIO · IG / X / TIKTOK</div>
            <h2>Ekspor Video &amp; Poster</h2>
          </div>
          <button type="button" class="dock-btn" on:click={() => (studioOpen = false)}>✕</button>
        </div>

        <section class="drawer-sec">
          <div class="mono-label">INDIKATOR</div>
          <div class="grid-4">
            {#each METRIC_KEYS as mk}
              <button
                type="button"
                class={metric === mk ? 'd-opt on' : 'd-opt'}
                on:click={() => selectMetric(mk)}
              >
                {METRIC_VISUALS[mk].unitLabel}
              </button>
            {/each}
          </div>
          <div class="mono-label" style="margin-top: 6px;">RASIO BINGKAI</div>
          <div class="grid-2">
            <button type="button" class={aspect === 'auto' ? 'd-opt on' : 'd-opt'} on:click={() => selectAspect('auto')}>
              Web Penuh
            </button>
            <button type="button" class={aspect === '16x9' ? 'd-opt on' : 'd-opt'} on:click={() => selectAspect('16x9')}>
              16:9 · X / YT
            </button>
            <button type="button" class={aspect === '9x16' ? 'd-opt on' : 'd-opt'} on:click={() => selectAspect('9x16')}>
              9:16 · TikTok / Reels
            </button>
            <button type="button" class={aspect === '4x5' ? 'd-opt on' : 'd-opt'} on:click={() => selectAspect('4x5')}>
              4:5 · IG Feed
            </button>
          </div>
        </section>

        <section class="drawer-sec">
          <div class="mono-label">MODUS &amp; KALIBRASI</div>
          <label class="d-check">
            <input type="checkbox" bind:checked={smoothField} on:change={rebuildDataCube} />
            <span>Haluskan medan antar-pin (IDW)</span>
          </label>
          <label class="d-check">
            <input type="checkbox" bind:checked={hookMode} />
            <span>Hook 3 detik (buka dari puncak ekstrem)</span>
          </label>
          {#if regionId === 'indonesia' && (aspect === '9x16' || aspect === 'auto')}
            <label class="d-check">
              <input type="checkbox" bind:checked={autoPan} />
              <span>Pan kamera Nusantara (Barat → Timur)</span>
            </label>
          {/if}
          {#if aspect === '9x16'}
            <label class="d-check">
              <input type="checkbox" bind:checked={showSafeZone} />
              <span>Tampilkan panduan Safe-Zone TikTok/IG</span>
            </label>
          {/if}

          <div class="mono-label" style="margin-top: 8px;">SOROT ZONA IKLIM BMKG</div>
          <div class="grid-4">
            {#each ['all', 'monsunal', 'ekuatorial', 'lokal'] as z}
              <button
                type="button"
                class={climateFilter === z ? 'd-opt on' : 'd-opt'}
                on:click={() => {
                  climateFilter = z as any;
                  rebuildDataCube();
                  syncUrlParams();
                }}
              >
                {z === 'all' ? 'Semua' : z === 'monsunal' ? 'Monsun' : z === 'ekuatorial' ? 'Ekuator' : 'Lokal'}
              </button>
            {/each}
          </div>
        </section>

        <section class="drawer-sec">
          <div class="mono-label">TEKS JUDUL KUSTOM (OPSIONAL)</div>
          <input
            type="text"
            class="d-input"
            bind:value={customTitle}
            placeholder="Otomatis mengikuti wilayah & indikator..."
          />
          <input
            type="text"
            class="d-input"
            bind:value={customSubtitle}
            placeholder="Subjudul 1 baris..."
          />
        </section>

        <section class="drawer-sec">
          <div class="mono-label">DURASI &amp; FRAME RATE</div>
          <div class="grid-4">
            {#each [15, 24, 30] as d}
              <button
                type="button"
                class={exportDurationSec === d ? 'd-opt on' : 'd-opt'}
                on:click={() => (exportDurationSec = d)}
              >
                {d} dtk
              </button>
            {/each}
            <button
              type="button"
              class={exportFps === 60 ? 'd-opt on' : 'd-opt'}
              on:click={() => (exportFps = exportFps === 30 ? 60 : 30)}
            >
              {exportFps} fps
            </button>
          </div>

          {#if exporting}
            <div class="export-progress">
              <div class="progress-bar"><div class="progress-fill" style={`width:${exportPct}%`}></div></div>
              <div class="mono-small">{exportPct}% · {exportMsg}</div>
              <button type="button" class="d-opt" on:click={() => exportAbort?.abort()}>Batalkan Ekspor</button>
            </div>
          {:else}
            <button type="button" class="d-primary" on:click={runVideoExport}>
              Ekspor Video (.mp4)
            </button>
          {/if}

          <div class="grid-2" style="margin-top: 6px;">
            <button type="button" class="d-opt" on:click={runPosterExport}>Poster 4K (.png)</button>
            <button type="button" class="d-opt" on:click={copyReliefLink}>Salin Tautan</button>
          </div>
        </section>

        <section class="drawer-sec">
          <div class="mono-label">TRACK A · DATA SATELIT CHIRPS 45 TAHUN</div>
          <p class="d-note">
            Unggah berkas <code>.pinbin</code> hasil notebook Colab GEE (1981–2025) untuk beralih dari simulasi 514 kab/kota ke observasi satelit asli.
          </p>
          <div class="grid-2">
            <label class="d-opt" style="text-align: center;">
              Muat .pinbin
              <input type="file" accept=".pinbin" style="display: none;" on:change={handlePinBinUpload} />
            </label>
            {#if customPinBin}
              <button type="button" class="d-opt" on:click={resetToBaseline}>Reset Baseline</button>
            {:else}
              <a class="d-opt" style="text-align: center; text-decoration: none;" href="/kekeringan/">Buka Peta 2D</a>
            {/if}
          </div>
        </section>

        {#if statusNotice}
          <div class="d-status">{statusNotice}</div>
        {/if}
      </aside>
    {/if}
  </div>
</div>

<style>
  .relief-shell {
    height: 100dvh;
    width: 100vw;
    display: flex;
    flex-direction: column;
    background: #171A1F;
    color: #F5F7FA;
    overflow: hidden;
  }
  .relief-topbar {
    min-height: 46px;
    background: #121519;
    border-bottom: 1px solid #272B33;
    padding: 6px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    z-index: 20;
  }
  .relief-topbar::-webkit-scrollbar { display: none; }
  .relief-brand-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .relief-back-btn {
    color: #F5F7FA;
    text-decoration: none;
    border: 1px solid #383E4A;
    padding: 4px 9px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
  }
  .relief-back-btn:hover { background: #262B34; }
  .relief-brand-title {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .mono-dim {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #8C94A0;
  }
  .mono {
    font-family: 'IBM Plex Mono', monospace;
    font-variant-numeric: tabular-nums;
  }
  .relief-pill-strip {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  .relief-right-tools {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .r-pill, .r-cta {
    appearance: none;
    background: transparent;
    color: #A9B1BC;
    border: 1px solid #2C313B;
    padding: 4px 8px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10.5px;
    letter-spacing: 0.03em;
    cursor: pointer;
    white-space: nowrap;
  }
  .r-pill:hover { color: #F5F7FA; border-color: #555D6B; }
  .r-pill.active {
    background: #F5F7FA;
    color: #121519;
    border-color: #F5F7FA;
    font-weight: 500;
  }
  .r-cta {
    color: #F5F7FA;
    border-color: #6B7380;
    padding: 5px 10px;
  }
  .r-cta.active {
    background: #DF8821;
    border-color: #DF8821;
    color: #121519;
    font-weight: 600;
  }
  .relief-workspace {
    flex: 1;
    min-height: 0;
    display: flex;
    position: relative;
  }
  .relief-stage {
    flex: 1;
    min-width: 0;
    min-height: 0;
    position: relative;
    display: grid;
    place-items: center;
    padding: 10px 10px 64px;
    background: #13161B;
  }
  .canvas-frame {
    position: relative;
    background: #171A1F;
    overflow: hidden;
  }
  .canvas-frame.frame-auto {
    width: 100%;
    height: 100%;
  }
  .canvas-frame.frame-16x9 {
    aspect-ratio: 16 / 9;
    width: min(100%, calc((100dvh - 130px) * 16 / 9));
    max-height: 100%;
    border: 1px solid #2B303A;
  }
  .canvas-frame.frame-9x16 {
    aspect-ratio: 9 / 16;
    height: min(100%, calc(100dvh - 130px));
    max-width: 100%;
    border: 1px solid #2B303A;
  }
  .canvas-frame.frame-4x5 {
    aspect-ratio: 4 / 5;
    height: min(100%, calc(100dvh - 130px));
    max-width: 100%;
    border: 1px solid #2B303A;
  }
  .relief-canvas {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
    touch-action: none;
  }
  .relief-canvas:active { cursor: grabbing; }
  .relief-status-overlay {
    position: absolute;
    z-index: 15;
    padding: 10px 16px;
    background: rgba(18, 21, 25, 0.92);
    border: 1px solid #353B45;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
  }
  .relief-status-overlay.error { border-color: #C2410C; color: #F28B66; }
  .hover-chip {
    position: absolute;
    bottom: 66px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 12;
    pointer-events: none;
    background: rgba(18, 21, 25, 0.92);
    border: 1px solid #383E4A;
    padding: 5px 10px;
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 11.5px;
    white-space: nowrap;
  }
  .playback-dock {
    position: absolute;
    bottom: 14px;
    left: 50%;
    transform: translateX(-50%);
    width: min(640px, calc(100% - 24px));
    z-index: 14;
    background: rgba(18, 21, 25, 0.92);
    border: 1px solid #2F3540;
    padding: 7px 11px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dock-btn {
    appearance: none;
    background: transparent;
    color: #E5E7EB;
    border: 1px solid #383E4A;
    padding: 5px 9px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10.5px;
    cursor: pointer;
    white-space: nowrap;
  }
  .dock-btn:hover { border-color: #8C94A0; }
  .dock-btn.primary {
    background: #F5F7FA;
    color: #121519;
    border-color: #F5F7FA;
    font-weight: 600;
  }
  .dock-slider {
    flex: 1;
    min-width: 90px;
    accent-color: #DF8821;
    cursor: pointer;
  }
  .dock-ym {
    font-family: 'IBM Plex Mono', monospace;
    font-variant-numeric: tabular-nums;
    font-size: 11.5px;
    color: #F5F7FA;
    min-width: 56px;
    text-align: center;
  }
  .creator-drawer {
    width: min(350px, 100vw);
    background: #121519;
    border-left: 1px solid #272B33;
    padding: 14px;
    overflow-y: auto;
    display: grid;
    gap: 14px;
    align-content: start;
    z-index: 25;
  }
  .drawer-head {
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 8px;
    border-bottom: 1px solid #272B33;
    padding-bottom: 10px;
  }
  .drawer-head h2 {
    margin: 3px 0 0;
    font-size: 16px;
    font-weight: 600;
  }
  .mono-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.06em;
    color: #8C94A0;
    margin-bottom: 6px;
  }
  .drawer-sec {
    display: grid;
    gap: 6px;
    border-bottom: 1px solid #22262E;
    padding-bottom: 12px;
  }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
  .d-opt {
    appearance: none;
    background: #1A1E24;
    color: #C7CDD6;
    border: 1px solid #2F3540;
    padding: 7px 6px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10.5px;
    cursor: pointer;
  }
  .d-opt.on {
    background: #F5F7FA;
    color: #121519;
    border-color: #F5F7FA;
    font-weight: 600;
  }
  .d-primary {
    appearance: none;
    width: 100%;
    background: #DF8821;
    color: #121519;
    border: 1px solid #DF8821;
    padding: 10px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
  }
  .d-check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #D2D7DF;
    cursor: pointer;
  }
  .d-input {
    width: 100%;
    background: #1A1E24;
    color: #F5F7FA;
    border: 1px solid #2F3540;
    padding: 7px 9px;
    font-size: 12px;
    font-family: inherit;
  }
  .d-note {
    margin: 0;
    font-size: 11.5px;
    color: #9CA3AF;
    line-height: 1.45;
  }
  .d-status {
    padding: 8px 10px;
    background: #1A1E24;
    border: 1px solid #3A424E;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10.5px;
    color: #DFAC80;
  }
  .export-progress {
    display: grid;
    gap: 6px;
    padding: 8px;
    border: 1px solid #353B45;
    background: #171A1F;
  }
  .progress-bar { height: 6px; background: #262B33; width: 100%; }
  .progress-fill { height: 100%; background: #DF8821; transition: width 0.1s linear; }
  .mono-small { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: #C7CDD6; }

  @media (max-width: 820px) {
    .hide-sm { display: none !important; }
    .relief-topbar {
      flex-wrap: wrap;
      padding: 6px 10px;
      gap: 6px;
    }
    .relief-brand-group { order: 1; }
    .relief-right-tools {
      order: 2;
      margin-left: auto;
      gap: 5px;
    }
    .relief-right-tools .relief-pill-strip { display: none; }
    .relief-pill-strip {
      order: 3;
      width: 100%;
      overflow-x: auto;
      padding-top: 4px;
      border-top: 1px solid #232730;
    }
    .creator-drawer {
      position: fixed;
      right: 0;
      top: 46px;
      bottom: 0;
      width: min(340px, 100vw);
      box-shadow: -12px 0 32px rgba(0, 0, 0, 0.55);
    }
  }
</style>
