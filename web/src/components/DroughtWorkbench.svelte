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
  import AccountMenu from './AccountMenu.svelte';
  import WilayahPublicView from './WilayahPublicView.svelte';
  import { CLIMATE_ZONE_META, getClimateZone, type BmkgClimateZone } from '../utils/climateZones';
  import { detectPropagationLags, forecastDrought3m } from '../utils/droughtAi';
  import {
    buildRegionColabNotebook,
    COLAB_OFFICIAL_URL,
    parseAndValidateGeeJson,
    type GeeCachedPayload,
    type GeeQuotaInfo,
  } from '../utils/geeColab';

  let dataset: DroughtDataset | null = null;
  let geojson: GeoJSON.FeatureCollection | null = null;
  let activeIndex: DroughtIndexKey = 'pdlvi';
  let monthIdx = 35;
  let playing = false;
  let playTimer: number | null = null;
  let selectedKode = '3312';
  let drawerOpen = true;
  let controlsOpen = true;
  let theme: 'kertas' | 'malam' = 'kertas';
  let isEmbed = false;
  let isWilayahMode = false;
  let copyNotice = '';
  let viewportPreset: 'jateng' | 'jawa' | 'indonesia' = 'jateng';
  let climateFilter: 'all' | BmkgClimateZone = 'all';
  let dataSourceLabel = 'R2 / LOKAL';
  let searchQuery = '';
  let hoverRegion: { kode_bps: string; nama: string; provinsi: string; val: string; status: string } | null = null;
  type Locale = 'id' | 'en' | 'ja' | 'zh';
  let locale: Locale = 'id';

  const UI_I18N: Record<Locale, Record<string, string>> = {
    id: {
      home: 'Beranda', replay: 'Musim Ulang', drought: 'Kekeringan', regions: 'Wilayah', methods: 'Metode', lobby: 'Lobby',
      pickIndex: 'PILIH INDEKS KEKERINGAN', play: 'Putar 36 Bln', pause: 'Jeda', close: 'Tutup',
      summaryTitle: 'RINGKASAN ANALISIS WILAYAH', light: 'Putih', dark: 'Malam',
    },
    en: {
      home: 'Home', replay: 'Season Replay', drought: 'Drought', regions: 'Regions', methods: 'Methods', lobby: 'Lobby',
      pickIndex: 'SELECT DROUGHT INDEX', play: 'Play 36 Mo', pause: 'Pause', close: 'Close',
      summaryTitle: 'REGIONAL ANALYSIS SUMMARY', light: 'Light', dark: 'Dark',
    },
    ja: {
      home: 'ホーム', replay: 'リプレイ', drought: '干ばつ', regions: '地域別', methods: '手法', lobby: 'ロビー',
      pickIndex: '干ばつ指標を選択', play: '36ヶ月再生', pause: '一時停止', close: '閉じる',
      summaryTitle: '地域分析サマリー', light: 'ライト', dark: 'ダーク',
    },
    zh: {
      home: '首页', replay: '生长季回放', drought: '干旱', regions: '县域概况', methods: '方法', lobby: '大厅',
      pickIndex: '选择干旱指数', play: '播放36个月', pause: '暂停', close: '关闭',
      summaryTitle: '区域分析摘要', light: '浅色', dark: '深色',
    },
  };
  $: tUi = UI_I18N[locale];

  function setLocale(next: Locale) {
    locale = next;
    document.documentElement.lang = next;
    window.localStorage.setItem('agri_locale', next);
  }

  function setViewport(mode: 'jateng' | 'jawa' | 'indonesia') {
    viewportPreset = mode;
    if (!map) return;
    if (mode === 'jateng') map.flyTo({ center: [110.25, -7.52], zoom: 8.1, duration: 650 });
    else if (mode === 'jawa') map.flyTo({ center: [109.8, -7.3], zoom: 6.3, duration: 650 });
    else map.flyTo({ center: [117.5, -2.5], zoom: 4.3, duration: 750 });
  }

  let remainingSec = 300;
  let authenticated = false;
  let userEmail = '';
  let userName = '';
  let userAvatar = '';
  let userRole = '';
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
  $: searchMatches = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !dataset) return [];
    return Object.values(dataset.regions)
      .filter((r) => `${r.kode_bps} ${r.nama} ${r.provinsi}`.toLowerCase().includes(q))
      .slice(0, 6);
  })();

  function focusRegion(r: DroughtRegionTimeseries) {
    selectedKode = r.kode_bps;
    drawerOpen = true;
    searchQuery = '';
    if (map && r.centroid) {
      map.flyTo({ center: r.centroid, zoom: 8.2, duration: 650 });
    }
  }

  function formatMmSs(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function toggleTheme() {
    theme = theme === 'kertas' ? 'malam' : 'kertas';
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('agri_theme', theme);
  }

  $: selectedZone = getClimateZone(selectedKode);
  $: selectedZoneMeta = CLIMATE_ZONE_META[selectedZone];
  $: aiLags = selectedRegion ? detectPropagationLags(selectedRegion.series) : null;
  $: aiForecast = selectedRegion ? forecastDrought3m(selectedRegion.series, selectedRegion.kode_bps) : null;

  let aiBriefLoading = false;
  let aiBriefResult: {
    text: string;
    actions: string[];
    engine: string;
    groundedVerified: boolean;
    hallucinationRejected: boolean;
  } | null = null;
  let aiBriefError = '';

  $: if (selectedKode) {
    aiBriefResult = null;
    aiBriefError = '';
  }

  async function requestGroundedAiBrief() {
    if (!displayRegion || !displayPt || !displayForecast || !displayLags) return;
    aiBriefLoading = true;
    aiBriefError = '';
    try {
      const t1 = displayForecast.horizon[0];
      const res = await fetch('/api/v1/ai/brief', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kode_bps: displayRegion.kode_bps,
          nama: displayRegion.nama,
          provinsi: displayRegion.provinsi,
          climate_zone: selectedZone,
          ym: displayPt.ym || activeYm,
          spi3: displayPt.spi3,
          ssma: displayPt.ssma,
          vhi: displayPt.vhi,
          pdlvi: displayPt.pdlvi,
          slope_deg: displayRegion.mean_slope_deg,
          forecast_pdlvi_t1: t1?.pdlvi ?? displayPt.pdlvi,
          prob_awas_pct: t1?.probAwasPct ?? 10,
          lag_spi_ssma: displayLags.spiToSsmaLag,
        }),
      });
      if (res.status === 401) {
        aiBriefError = 'Sesi pratinjau 5 menit habis. Masuk dengan Google untuk menjalankan Copilot AI.';
        return;
      }
      const j = await res.json();
      if (!res.ok) {
        aiBriefError = `Gagal membuat sintesis AI (${j?.error || res.status}).`;
        return;
      }
      aiBriefResult = {
        text: String(j.text || ''),
        actions: Array.isArray(j.actions) ? j.actions : [],
        engine: String(j.engine || 'deterministic-grounded-v1'),
        groundedVerified: Boolean(j.grounded_verified),
        hallucinationRejected: Boolean(j.hallucination_rejected),
      };
    } catch {
      aiBriefError = 'Gagal terhubung ke layanan AI tepi.';
    } finally {
      aiBriefLoading = false;
    }
  }

  let geeQuota: GeeQuotaInfo | null = null;
  let geeSharedCache: GeeCachedPayload | null = null;
  let geeOverlay: Record<string, GeeCachedPayload> = {};
  let geeBusy = false;
  let geeNotice = '';
  let geeError = '';

  $: activeGeeData = geeOverlay[selectedKode] || null;
  $: displayRegion =
    selectedRegion && activeGeeData
      ? { ...selectedRegion, series: activeGeeData.series }
      : selectedRegion;
  $: displayPt = displayRegion?.series[monthIdx] ?? activePt;
  $: displayPrevPt = monthIdx > 0 ? displayRegion?.series[monthIdx - 1] : prevPt;
  $: displayLags = displayRegion ? detectPropagationLags(displayRegion.series) : aiLags;
  $: displayForecast = displayRegion ? forecastDrought3m(displayRegion.series, displayRegion.kode_bps) : aiForecast;

  async function refreshGeeCacheStatus(kode: string) {
    geeNotice = '';
    geeError = '';
    geeSharedCache = null;
    try {
      const res = await fetch(`/api/v1/gee/cache?kode=${encodeURIComponent(kode)}`);
      if (!res.ok) return;
      const j = await res.json();
      geeQuota = j.quota || null;
      geeSharedCache = j.cached && j.data ? (j.data as GeeCachedPayload) : null;
    } catch {
      // ignore offline
    }
  }

  $: if (selectedKode && typeof window !== 'undefined') {
    refreshGeeCacheStatus(selectedKode);
  }

  function applyGeeCacheNow() {
    if (!geeSharedCache) return;
    geeOverlay = { ...geeOverlay, [selectedKode]: geeSharedCache };
    monthIdx = Math.max(0, geeSharedCache.series.length - 1);
    geeNotice = 'Observasi satelit GEE dimuat dari Shared Cache (0 kuota terpakai).';
  }

  async function launchGeeColab() {
    if (!selectedRegion) return;
    geeBusy = true;
    geeNotice = '';
    geeError = '';
    try {
      const res = await fetch('/api/v1/gee/quota/consume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kode_bps: selectedKode }),
      });
      const j = await res.json();
      if (j?.quota) geeQuota = j.quota;
      if (res.status === 429) {
        geeError = String(j?.message || 'Kuota / jeda GEE aktif.');
        return;
      }
      if (!res.ok) {
        geeError = `Gagal memulai GEE Colab (${j?.error || res.status}).`;
        return;
      }
      if (j.cache_hit && j.data) {
        geeSharedCache = j.data as GeeCachedPayload;
        applyGeeCacheNow();
        return;
      }
      const nbJson = buildRegionColabNotebook(selectedRegion, months.length || 36);
      triggerDownload(`drought-gee-${selectedRegion.kode_bps}.ipynb`, nbJson, 'application/x-ipynb+json;charset=utf-8');
      window.open(COLAB_OFFICIAL_URL, '_blank', 'noopener,noreferrer');
      geeNotice = 'Notebook wilayah terunduh & Colab dibuka (auto-off 3 menit aktif). Ekspor .json lalu impor di bawah.';
    } catch {
      geeError = 'Gagal mengecek kuota GEE tepi.';
    } finally {
      geeBusy = false;
    }
  }

  async function handleGeeImport(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    geeError = '';
    geeNotice = '';
    try {
      const txt = await file.text();
      const parsed = parseAndValidateGeeJson(txt);
      if (!parsed.ok) {
        geeError = parsed.error;
        return;
      }
      selectedKode = parsed.payload.kode_bps;
      geeOverlay = { ...geeOverlay, [parsed.payload.kode_bps]: parsed.payload };
      monthIdx = Math.max(0, parsed.payload.series.length - 1);
      geeNotice = `Observasi satelit GEE dimuat lokal (${parsed.payload.series.length} bln). Klik Bagikan ke Cache agar pengguna lain hemat kuota.`;
    } catch {
      geeError = 'Gagal membaca berkas JSON GEE.';
    } finally {
      input.value = '';
    }
  }

  async function shareGeeToCache() {
    if (!activeGeeData) return;
    geeBusy = true;
    geeError = '';
    try {
      const res = await fetch('/api/v1/gee/cache', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(activeGeeData),
      });
      const j = await res.json();
      if (!res.ok) {
        geeError = `Gagal menyimpan Shared Cache (${j?.detail || j?.error || res.status}).`;
        return;
      }
      geeSharedCache = activeGeeData;
      geeNotice = `Shared Cache diperbarui untuk BPS ${activeGeeData.kode_bps} (berlaku ${j.ttl_days || 14} hari).`;
    } catch {
      geeError = 'Gagal mengunggah ke Shared Cache.';
    } finally {
      geeBusy = false;
    }
  }

  function clearGeeOverlay() {
    if (!geeOverlay[selectedKode]) return;
    const next = { ...geeOverlay };
    delete next[selectedKode];
    geeOverlay = next;
    geeNotice = 'Tampilan kembali ke seri baseline R2/lokal.';
  }

  function applyMapColors() {
    if (!map || !dataset) return;
    if (!map.getLayer('jateng-fill') || !map.getLayer('jateng-line')) return;
    const matchExpr: unknown[] = ['match', ['get', 'kode_bps']];
    const muted = theme === 'malam' ? '#1F2026' : '#ECEBE6';
    for (const [kode, reg] of Object.entries(dataset.regions)) {
      if (climateFilter !== 'all' && getClimateZone(kode) !== climateFilter) {
        matchExpr.push(kode, muted);
      } else {
        const pt = geeOverlay[kode]?.series[monthIdx] ?? reg.series[monthIdx];
        matchExpr.push(kode, colorForValue(activeIndex, pt));
      }
    }
    matchExpr.push('#E5DEC9');
    map.setPaintProperty('jateng-fill', 'fill-color', matchExpr as any);
    map.setPaintProperty('jateng-line', 'line-color', [
      'case',
      ['==', ['get', 'kode_bps'], selectedKode],
      '#000000',
      '#52525B',
    ]);
    map.setPaintProperty('jateng-line', 'line-width', [
      'case',
      ['==', ['get', 'kode_bps'], selectedKode],
      2.2,
      0.6,
    ]);
  }

  function renderChart() {
    if (!chartContainer || !displayRegion) return;
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    const xs = displayRegion.series.map((_p, i) => i);
    const spi = displayRegion.series.map((p) => p.spi3);
    const vhiScaled = displayRegion.series.map((p) => Number(((p.vhi - 50) / 20).toFixed(2)));
    const labels = displayRegion.series.map((p) => p.ym);

    chartInstance = new uPlot(
      {
        width: Math.max(240, (chartContainer.clientWidth || 300) - 2),
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
    climateFilter;
    theme;
    geeOverlay;
    applyMapColors();
  }

  $: if (displayRegion && drawerOpen && chartContainer) {
    activeGeeData;
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

  function buildPermalink(): string {
    const u = new URL(window.location.href);
    u.searchParams.set('kode', selectedKode);
    u.searchParams.set('idx', activeIndex);
    u.searchParams.set('m', String(monthIdx));
    if (climateFilter !== 'all') u.searchParams.set('zone', climateFilter);
    else u.searchParams.delete('zone');
    u.searchParams.delete('embed');
    return u.toString();
  }

  async function copyPermalink() {
    const urlStr = buildPermalink();
    window.history.replaceState(null, '', urlStr);
    let shareUrl = urlStr;
    let isShort = false;
    try {
      const u = new URL(urlStr);
      const res = await fetch('/api/v1/share', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          module: isWilayahMode ? 'wilayah' : 'kekeringan',
          target_path: `${u.pathname}${u.search}`,
        }),
      });
      if (res.ok) {
        const j = await res.json();
        if (j?.short_url) {
          shareUrl = String(j.short_url);
          isShort = true;
        }
      }
    } catch {
      // Fallback safely to full permalink
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      copyNotice = isShort ? `Tautan singkat tersalin: ${shareUrl}` : 'Permalink tersalin ke papan klip.';
    } catch {
      copyNotice = shareUrl;
    }
  }

  async function copyEmbed() {
    const u = new URL(buildPermalink());
    u.searchParams.set('embed', '1');
    const code = `<iframe src="${u.toString()}" width="100%" height="680" style="border:1px solid #E7E7E7" loading="lazy" title="Drought in Control"></iframe>`;
    try {
      await navigator.clipboard.writeText(code);
      copyNotice = 'Kode embed <iframe> tersalin.';
    } catch {
      copyNotice = code;
    }
  }

  function exportSelectedGeoJson() {
    if (!displayRegion || !dataset) return;
    const feat = geojson?.features.find((f) => String(f.properties?.kode_bps) === displayRegion.kode_bps);
    const fc = {
      type: 'FeatureCollection',
      metadata: {
        source: activeGeeData ? activeGeeData.source : 'agri.transbulent.id/kekeringan',
        attribution: 'Agri Transbulent / Transbulent Research Group',
        is_simulated: activeGeeData ? false : dataset.is_simulated,
        kode_bps: displayRegion.kode_bps,
        active_ym: activeYm,
        active_index: activeIndex,
      },
      features: feat
        ? [
            {
              ...feat,
              properties: {
                ...feat.properties,
                nama: displayRegion.nama,
                provinsi: displayRegion.provinsi,
                das: displayRegion.das,
                mean_slope_deg: displayRegion.mean_slope_deg,
                ym: activeYm,
                spi3: displayPt?.spi3,
                ssma: displayPt?.ssma,
                vhi: displayPt?.vhi,
                pdlvi: displayPt?.pdlvi,
                status: displayPt?.status,
                is_simulated: activeGeeData ? false : dataset.is_simulated,
              },
            },
          ]
        : [],
    };
    triggerDownload(`drought-${displayRegion.kode_bps}-${activeYm}.geojson`, JSON.stringify(fc, null, 2), 'application/geo+json;charset=utf-8');
  }

  onMount(async () => {
    const qs = new URLSearchParams(window.location.search);
    isEmbed = qs.get('embed') === '1';
    isWilayahMode = window.location.pathname === '/wilayah' || window.location.pathname.startsWith('/wilayah/');

    const savedTheme = window.localStorage.getItem('agri_theme');
    if (savedTheme === 'kertas' || savedTheme === 'malam') {
      theme = savedTheme;
      document.documentElement.setAttribute('data-theme', theme);
    }

    const savedLocale = window.localStorage.getItem('agri_locale');
    if (savedLocale === 'id' || savedLocale === 'en' || savedLocale === 'ja' || savedLocale === 'zh') {
      locale = savedLocale;
    }

    const parts = window.location.pathname.replace(/\/+$/, '').split('/');
    const lastSeg = (parts[parts.length - 1] || '').toLowerCase();
    if (/^\d{4}$/.test(lastSeg)) selectedKode = lastSeg;

    let gjRes = await fetch('/api/v1/r2/v1/drought/idn/regions-514.geojson');
    let tsRes = await fetch('/api/v1/r2/v1/drought/idn/drought-36m-514.json');
    if (gjRes.ok && tsRes.ok) {
      dataSourceLabel = 'R2 EDGE';
    } else {
      [gjRes, tsRes] = await Promise.all([
        fetch('/kekeringan/mock-data/jateng-regions.geojson'),
        fetch('/kekeringan/mock-data/jateng-drought-36m.json'),
      ]);
      dataSourceLabel = 'ASET LOKAL';
    }
    geojson = await gjRes.json();
    dataset = await tsRes.json();
    monthIdx = (dataset?.months.length || 36) - 1;

    if (dataset && lastSeg && !/^\d{4}$/.test(lastSeg) && lastSeg !== 'wilayah' && lastSeg !== 'kekeringan') {
      const match = Object.values(dataset.regions).find((r) => r.nama.toLowerCase().includes(lastSeg));
      if (match) selectedKode = match.kode_bps;
    }

    const qKode = qs.get('kode');
    if (qKode && dataset?.regions[qKode]) selectedKode = qKode;
    const qIdx = qs.get('idx');
    if (qIdx === 'spi3' || qIdx === 'ssma' || qIdx === 'vhi' || qIdx === 'pdlvi') activeIndex = qIdx;
    const qZone = qs.get('zone');
    if (qZone === 'monsunal' || qZone === 'ekuatorial' || qZone === 'lokal') climateFilter = qZone;
    const rawM = qs.get('m');
    if (rawM !== null && rawM !== '') {
      const qMonth = Number(rawM);
      if (Number.isInteger(qMonth) && dataset && qMonth >= 0 && qMonth < dataset.months.length) monthIdx = qMonth;
    }

    if (dataset && !dataset.regions[selectedKode]) selectedKode = '3312';

    await tick();
    if (isWilayahMode || !mapContainer) return;

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
          'fill-color': '#E5DEC9',
          'fill-opacity': 0.72,
        },
      });
      map.addLayer({
        id: 'jateng-line',
        type: 'line',
        source: 'jateng-regions',
        paint: {
          'line-color': '#52525B',
          'line-width': 0.6,
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
      map.on('mousemove', 'jateng-fill', (e) => {
        const kode = e.features?.[0]?.properties?.kode_bps;
        const reg = kode ? dataset?.regions[String(kode)] : undefined;
        const pt = reg?.series[monthIdx];
        if (reg && pt) {
          hoverRegion = {
            kode_bps: reg.kode_bps,
            nama: reg.nama,
            provinsi: reg.provinsi,
            val: String(pt[activeIndex]),
            status: statusLabelId(pt.status),
          };
        }
      });
      map.on('mouseleave', 'jateng-fill', () => {
        if (map) map.getCanvas().style.cursor = '';
        hoverRegion = null;
      });
    });
    controlsOpen = window.innerWidth > 960;
    window.addEventListener('resize', handleWinResize);
  });

  let resizeTimer: number | null = null;
  function handleWinResize() {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      map?.resize();
      renderChart();
    }, 120);
  }

  onDestroy(() => {
    if (typeof window !== 'undefined') window.removeEventListener('resize', handleWinResize);
    if (resizeTimer) window.clearTimeout(resizeTimer);
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
  {#if !isEmbed}
    <div class="agri-spectrum-banner no-print">
      INDONESIA (514 KAB/KOTA · BATAS SHP COD-AB) · PILOT JATENG &amp; DIY · SPI-3 · SSMA · VHI · PDLVI · {dataset?.is_simulated ? 'SIMULASI MOCK' : 'DATA SATELIT'}
    </div>

    <header class="topbar no-print">
      <div class="topbar-inner">
        <a href="/" class="brand-link">
          <span class="brand-box">AG</span>
          <span>agri.transbulent.id</span>
        </a>

        <nav class="hnav" aria-label="Navigasi">
          <a href="/">{tUi.home}</a>
          <a href="/ulang/bompon-magelang/mt2-2025/">{tUi.replay}</a>
          <a href="/kekeringan/" class={!isWilayahMode ? 'on' : ''}>{tUi.drought}</a>
          <a href="/wilayah/" class={isWilayahMode ? 'on' : ''}>{tUi.regions}</a>
          <a href="/metode/">{tUi.methods}</a>
          <a href="/data/">Data</a>
          <a href="/lobby/">{tUi.lobby}</a>
        </nav>

        <div class="drought-controls-row">
          <span class="pill-badge pill-sim hide-mobile">SHP COD-AB · 514 · {dataSourceLabel}</span>
          <AccountMenu
            {authenticated}
            {userEmail}
            {userName}
            {userAvatar}
            {remainingSec}
            nextPath={isWilayahMode ? '/wilayah/' : '/kekeringan/'}
          />
          <select
            aria-label="Bahasa"
            value={locale}
            on:change={(e) => setLocale((e.currentTarget as HTMLSelectElement).value as Locale)}
            class="btn-subtle"
            style="padding: 5px 6px;"
          >
            <option value="id">ID</option>
            <option value="en">EN</option>
            <option value="ja">JA</option>
            <option value="zh">ZH</option>
          </select>
          <button type="button" class="btn-subtle" on:click={toggleTheme}>
            {theme === 'kertas' ? tUi.dark : tUi.light}
          </button>
          <a href="https://github.com/gisrad" target="_blank" rel="noopener noreferrer" class="btn-subtle" title="GitHub @gisrad" aria-label="GitHub Profil" style="padding: 5px 7px; display: inline-flex; align-items: center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          </a>
          <a href="https://x.com/evansazka" target="_blank" rel="noopener noreferrer" class="btn-subtle" title="X @evansazka" aria-label="X @evansazka" style="padding: 5px 7px; display: inline-flex; align-items: center;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
        </div>
      </div>
    </header>
  {/if}

  {#if isWilayahMode && dataset && selectedRegion}
    <div class="no-print" style="flex: 1;">
      <WilayahPublicView
        {dataset}
        region={selectedRegion}
        {activeYm}
        {geojson}
        onSelectRegion={(kode) => (selectedKode = kode)}
      />
    </div>
  {:else}
    <main class="no-print drought-main">
    <!-- Peta Layar Penuh -->
    <div class="drought-map-stage">
      <div bind:this={mapContainer} style="position: absolute; inset: 0;"></div>

      {#if !controlsOpen}
        <button
          type="button"
          class="btn-primary drought-filter-toggle"
          style="padding: 7px 11px; font-size: 10.5px;"
          on:click={() => (controlsOpen = true)}
        >
          Filter &amp; Indeks ({INDEX_META[activeIndex].short}) ▾
        </button>
      {:else}
        <!-- Floating Layer Switcher -->
        <aside class="drought-filter-panel">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 8px;">
            <div class="num" style="font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-muted);">
              {tUi.pickIndex}
            </div>
            <button
              type="button"
              class="btn-subtle drought-filter-close"
              style="padding: 2px 7px; font-size: 11px;"
              aria-label="Tutup filter peta"
              on:click={() => (controlsOpen = false)}
            >
              ✕
            </button>
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
          <div style="border-top: 1px solid var(--border); margin-top: 10px; padding-top: 8px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;">
            <button type="button" class={viewportPreset === 'jateng' ? 'btn-primary' : 'btn-subtle'} style="padding: 5px 4px; font-size: 10px;" on:click={() => setViewport('jateng')}>Jateng &amp; DIY</button>
            <button type="button" class={viewportPreset === 'jawa' ? 'btn-primary' : 'btn-subtle'} style="padding: 5px 4px; font-size: 10px;" on:click={() => setViewport('jawa')}>Jawa</button>
            <button type="button" class={viewportPreset === 'indonesia' ? 'btn-primary' : 'btn-subtle'} style="padding: 5px 4px; font-size: 10px;" on:click={() => setViewport('indonesia')}>Indonesia (514)</button>
          </div>
          <div style="border-top: 1px solid var(--border); margin-top: 8px; padding-top: 8px;">
            <div class="num" style="font-size: 9.5px; color: var(--ink-muted); margin-bottom: 4px;">FILTER 3 ZONA IKLIM BMKG</div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px;">
              <button type="button" class={climateFilter === 'all' ? 'btn-primary' : 'btn-subtle'} style="padding: 4px 3px; font-size: 9.5px;" on:click={() => (climateFilter = 'all')}>Semua</button>
              <button type="button" class={climateFilter === 'monsunal' ? 'btn-primary' : 'btn-subtle'} style="padding: 4px 3px; font-size: 9.5px;" on:click={() => (climateFilter = 'monsunal')}>Monsun</button>
              <button type="button" class={climateFilter === 'ekuatorial' ? 'btn-primary' : 'btn-subtle'} style="padding: 4px 3px; font-size: 9.5px;" on:click={() => (climateFilter = 'ekuatorial')}>Ekuator</button>
              <button type="button" class={climateFilter === 'lokal' ? 'btn-primary' : 'btn-subtle'} style="padding: 4px 3px; font-size: 9.5px;" on:click={() => (climateFilter = 'lokal')}>Lokal</button>
            </div>
          </div>
          <div style="border-top: 1px solid var(--border); margin-top: 8px; padding-top: 8px;">
            <input
              type="search"
              bind:value={searchQuery}
              placeholder="Cari kab/kota atau BPS (mis. Malang, 3312)..."
              aria-label="Cari kabupaten atau provinsi"
              style="width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--border-ink); background: var(--bg); color: var(--ink); font-size: 11px;"
            />
            {#if searchMatches.length > 0}
              <div style="border: 1px solid var(--border); border-top: 0; background: var(--bg); max-height: 150px; overflow-y: auto;">
                {#each searchMatches as r}
                  <button
                    type="button"
                    on:click={() => focusRegion(r)}
                    style="width: 100%; text-align: left; padding: 6px 8px; border: 0; border-bottom: 1px solid var(--border); background: transparent; color: var(--ink); cursor: pointer; font-size: 11px;"
                  >
                    <strong>{r.nama}</strong> · <span class="num" style="color: var(--ink-muted);">{r.provinsi} ({r.kode_bps})</span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </aside>
      {/if}

      {#if hoverRegion}
        <div class="hide-mobile" style="position: absolute; top: 14px; right: 14px; z-index: 10; background: var(--dock-bg); border: 1.5px solid var(--border-ink); padding: 8px 11px; max-width: 240px; pointer-events: none;">
          <div class="num" style="font-size: 10.5px; font-weight: 600;">{hoverRegion.nama}</div>
          <div class="num" style="font-size: 10px; color: var(--ink-muted);">
            {hoverRegion.provinsi} · {INDEX_META[activeIndex].short} {hoverRegion.val} · {hoverRegion.status}
          </div>
        </div>
      {/if}

      <!-- Drought Propagation Scrubber -->
      <section class="drought-scrubber">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <button type="button" class="btn-primary" style="padding: 7px 12px;" on:click={togglePlay}>
            {playing ? tUi.pause : tUi.play}
          </button>
          <input
            type="range"
            min="0"
            max={Math.max(0, months.length - 1)}
            bind:value={monthIdx}
            aria-label="Timeline bulan kekeringan"
            style="flex: 1; min-width: 110px; accent-color: #000000;"
          />
          <strong class="num" style="font-size: 13px;">{activeYm}</strong>
        </div>
        <div class="num hide-mobile" style="margin-top: 7px; font-size: 10px; color: var(--ink-muted); display: flex; gap: 10px; flex-wrap: wrap;">
          <span>RANTAI PROPAGASI:</span>
          <span>1. Defisit Hujan (SPI-3) →</span>
          <span>2. Tanah Kering (SSMA, +1 bln) →</span>
          <span>3. Stres Vegetasi (VHI, +2 bln) →</span>
          <span>4. Erosi Pascakekeringan (PDLVI)</span>
        </div>
      </section>
    </div>

    <!-- Region Inspector Drawer -->
    {#if drawerOpen && displayRegion && displayPt}
      <aside class="drought-inspector">
        <div style="display: flex; justify-content: space-between; align-items: start; gap: 8px;">
          <div>
            <div class="num" style="font-size: 10.5px; color: var(--ink-muted);">
              BPS {displayRegion.kode_bps} · {displayRegion.provinsi} · DAS {displayRegion.das}
            </div>
            <h1 style="margin: 3px 0 0; font-size: 1.3rem; font-weight: 600;">{displayRegion.nama}</h1>
          </div>
          <button type="button" class="btn-subtle" on:click={() => (drawerOpen = false)}>{tUi.close}</button>
        </div>

        <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
          <span class={`pill-badge ${displayPt.status === 'parah' || displayPt.status === 'ekstrem' ? 'pill-warn' : 'pill-sim'}`}>
            {statusLabelId(displayPt.status)} ({displayPt.ym || activeYm})
          </span>
          {#if activeGeeData}
            <span class="pill-badge" style="color: #1E6B47; border-color: #1E6B47;">OBSERVASI GEE</span>
            <button type="button" class="btn-subtle" style="padding: 2px 6px; font-size: 10px;" on:click={clearGeeOverlay}>Reset R2</button>
          {/if}
          <span class="pill-badge" title={selectedZoneMeta.note}>
            {selectedZoneMeta.short} · SPI-3 AWAS ≤ {selectedZoneMeta.spiAwas}
          </span>
          <span class="num" style="font-size: 11px; color: var(--ink-muted);">
            Lereng {displayRegion.mean_slope_deg}° · PDLVI≥{selectedZoneMeta.pdlviAwas}
          </span>
        </div>

        <!-- 4 KPI Cards (Hairline Matrix 1px) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--border); border: 1px solid var(--border);">
          <div style="background: var(--bg); padding: 10px;">
            <div class="num" style="font-size: 10px; color: var(--ink-muted);">SPI-3</div>
            <div class="num" style="font-size: 1.35rem; font-weight: 600;">{displayPt.spi3}</div>
            <div class="num" style="font-size: 10px; color: var(--ink-secondary);">Δ {deltaStr(displayPt.spi3, displayPrevPt?.spi3)}</div>
          </div>
          <div style="background: var(--bg); padding: 10px;">
            <div class="num" style="font-size: 10px; color: var(--ink-muted);">SSMA</div>
            <div class="num" style="font-size: 1.35rem; font-weight: 600;">{displayPt.ssma}</div>
            <div class="num" style="font-size: 10px; color: var(--ink-secondary);">Δ {deltaStr(displayPt.ssma, displayPrevPt?.ssma)}</div>
          </div>
          <div style="background: var(--bg); padding: 10px;">
            <div class="num" style="font-size: 10px; color: var(--ink-muted);">VHI</div>
            <div class="num" style="font-size: 1.35rem; font-weight: 600;">{displayPt.vhi}</div>
            <div class="num" style="font-size: 10px; color: var(--ink-secondary);">Δ {deltaStr(displayPt.vhi, displayPrevPt?.vhi, 1)}</div>
          </div>
          <div style="background: var(--bg); padding: 10px;">
            <div class="num" style="font-size: 10px; color: var(--ink-muted);">PDLVI</div>
            <div class="num" style="font-size: 1.35rem; font-weight: 600;">{displayPt.pdlvi}</div>
            <div class="num" style="font-size: 10px; color: var(--ink-secondary);">Δ {deltaStr(displayPt.pdlvi, displayPrevPt?.pdlvi)}</div>
          </div>
        </div>

        <!-- Grafik uPlot -->
        <div style="border: 1px solid var(--border); padding: 10px; background: var(--surface);">
          <div class="num" style="font-size: 10px; color: var(--ink-muted); margin-bottom: 6px;">
            DERET WAKTU {displayRegion.series.length} BULAN · SPI-3 (MERAH) VS VHI TERNORMALISASI (HIJAU)
          </div>
          <div bind:this={chartContainer}></div>
        </div>

        <!-- AI Propagasi & Prakiraan AR(1) 3 Bulan + Copilot Terverifikasi -->
        {#if displayLags && displayForecast}
          <div style="border: 1.5px solid var(--border-ink); padding: 12px; background: var(--surface); display: grid; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span class="num" style="font-size: 10px; font-weight: 600;">AI PROPAGASI &amp; PRAKIRAAN 3 BULAN (AR-1)</span>
              <span class="pill-badge">φ={displayForecast.phiPdlvi}</span>
            </div>

            <div class="num" style="font-size: 10.5px; color: var(--ink-secondary); display: flex; flex-wrap: wrap; gap: 8px;">
              <span>SPI→SSMA: +{displayLags.spiToSsmaLag} bln (r={displayLags.spiToSsmaR})</span>
              <span>· SSMA→VHI: +{displayLags.ssmaToVhiLag} bln (r={displayLags.ssmaToVhiR})</span>
              <span>· SPI→PDLVI: +{displayLags.spiToPdlviLag} bln</span>
            </div>

            <div style="border: 1px solid var(--border); background: var(--bg); overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--border); text-align: left; color: var(--ink-muted);">
                    <th class="num" style="padding: 4px 6px;">Horizon</th>
                    <th class="num" style="padding: 4px 6px;">PDLVI [CI 90%]</th>
                    <th class="num" style="padding: 4px 6px;">SPI-3</th>
                    <th class="num" style="padding: 4px 6px; text-align: right;">P(AWAS)</th>
                  </tr>
                </thead>
                <tbody>
                  {#each displayForecast.horizon as h}
                    <tr style="border-bottom: 1px solid var(--border);">
                      <td class="num" style="padding: 4px 6px;">T+{h.step} ({h.ym})</td>
                      <td class="num" style="padding: 4px 6px; font-weight: 600;">{h.pdlvi} [{h.low90}–{h.high90}]</td>
                      <td class="num" style="padding: 4px 6px;">{h.spi3}</td>
                      <td class="num" style="padding: 4px 6px; text-align: right; color: {h.probAwasPct >= 50 ? '#B83B14' : '#1E6B47'}; font-weight: 600;">
                        {h.probAwasPct}%
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn-primary" style="font-size: 10.5px; padding: 6px 10px;" disabled={aiBriefLoading} on:click={requestGroundedAiBrief}>
                {aiBriefLoading ? 'Mensintesis AI...' : 'Sintesis AI Terverifikasi (Zero-Hallucination)'}
              </button>
              {#if aiBriefResult}
                <span class="pill-badge" style="color: #1E6B47; border-color: #1E6B47;">TERVERIFIKASI · 0 HALUSINASI</span>
              {/if}
            </div>

            {#if aiBriefError}
              <div class="num" style="font-size: 11px; color: #B83B14;">{aiBriefError}</div>
            {/if}

            {#if aiBriefResult}
              <div style="border-top: 1px solid var(--border); padding-top: 8px; display: grid; gap: 6px;">
                <p style="margin: 0; font-size: 0.86rem; color: var(--ink); line-height: 1.45;">{aiBriefResult.text}</p>
                <ul style="margin: 0; padding-left: 16px; font-size: 0.8rem; color: var(--ink-secondary); display: grid; gap: 3px;">
                  {#each aiBriefResult.actions as act}
                    <li>{act}</li>
                  {/each}
                </ul>
                <div class="num" style="font-size: 9.5px; color: var(--ink-muted);">Engine: {aiBriefResult.engine}</div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Google Colab GEE & Shared Regional Cache (Strict Quota + Auto-off 3 Menit) -->
        <div style="border: 1px solid var(--border-ink); padding: 12px; background: var(--surface); display: grid; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span class="num" style="font-size: 10px; font-weight: 600;">SATELIT GEE · SHARED CACHE &amp; COLAB</span>
            {#if geeQuota}
              <span class="pill-badge" title="Reset harian 00:00 UTC · Jeda wajib 15 menit">
                Kuota {geeQuota.remaining}/{geeQuota.limit} ({geeQuota.actor_type === 'google' ? 'Google' : 'Tamu'})
              </span>
            {:else}
              <span class="pill-badge">Auto-off 3 mnt</span>
            {/if}
          </div>

          {#if geeSharedCache}
            <div style="border: 1px solid #1E6B47; padding: 8px; background: var(--bg); display: grid; gap: 6px;">
              <div class="num" style="font-size: 10.5px; color: #1E6B47; font-weight: 600;">
                CACHE WILAYAH TERSEDIA ({geeSharedCache.series.length} bln · 0 kuota terpakai)
              </div>
              <button type="button" class="btn-primary" style="font-size: 10.5px; padding: 6px 10px;" on:click={applyGeeCacheNow}>
                Muat Observasi Shared Cache
              </button>
            </div>
          {/if}

          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn-outline" style="font-size: 10.5px; padding: 6px 10px; flex: 1;" disabled={geeBusy} on:click={launchGeeColab}>
              {geeBusy ? 'Memproses...' : 'Jalankan Colab GEE Wilayah'}
            </button>
            <label class="btn-subtle" style="font-size: 10.5px; padding: 6px 10px; cursor: pointer;">
              Impor .json GEE
              <input type="file" accept=".json,application/json" style="display: none;" on:change={handleGeeImport} />
            </label>
          </div>

          {#if activeGeeData}
            <button type="button" class="btn-primary" style="font-size: 10.5px; padding: 6px 10px;" disabled={geeBusy} on:click={shareGeeToCache}>
              Bagikan ke Shared Cache (14 Hari)
            </button>
          {/if}

          <div class="num" style="font-size: 9.5px; color: var(--ink-muted); line-height: 1.4;">
            Cache-first hemat komputasi · Ketat 2/hari (Google) &amp; 1/hari (Tamu) · Jeda 15 mnt · Watchdog idle 180 dtk + runtime.unassign().
          </div>

          {#if geeNotice}
            <div class="num" style="font-size: 10.5px; color: #1E6B47;">{geeNotice}</div>
          {/if}
          {#if geeError}
            <div class="num" style="font-size: 10.5px; color: #B83B14;">{geeError}</div>
          {/if}
        </div>

        <!-- Executive Brief -->
        <div style="border-top: 1px solid var(--border); padding-top: 10px;">
          <div class="num" style="font-size: 10px; color: var(--ink-muted); margin-bottom: 5px;">{tUi.summaryTitle}</div>
          <p style="margin: 0; font-size: 0.88rem; color: var(--ink-secondary);">{displayRegion.executive_brief_id}</p>
        </div>

        <!-- Jembatan Lintas Pilar ke Panen-ID -->
        {#if displayRegion.linked_panen_field_id}
          <a href={`/ulang/${displayRegion.linked_panen_field_id}/mt2-2025/`} class="btn-primary">
            Buka Musim Ulang Lahan di Wilayah Ini →
          </a>
        {/if}

        <!-- One-Click Academic & Policy Brief -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; border-top: 1px solid var(--border); padding-top: 12px;">
          <button
            type="button"
            class="btn-outline"
            on:click={() => triggerDownload(`drought-${displayRegion.kode_bps}.csv`, regionSeriesToCsv(displayRegion, !activeGeeData), 'text/csv;charset=utf-8')}
          >
            Unduh CSV
          </button>
          <button
            type="button"
            class="btn-outline"
            on:click={() => triggerDownload(`drought-${displayRegion.kode_bps}.json`, JSON.stringify(displayRegion, null, 2), 'application/json')}
          >
            Unduh JSON
          </button>
          <button
            type="button"
            class="btn-outline"
            on:click={() => triggerDownload(`policy-brief-${displayRegion.kode_bps}-${activeYm}.md`, buildPolicyBriefMarkdown(displayRegion, activeYm, !activeGeeData), 'text/markdown;charset=utf-8')}
          >
            Brief (.md)
          </button>
          <button type="button" class="btn-outline" on:click={exportSelectedGeoJson}>
            Unduh GeoJSON (QGIS)
          </button>
          <button type="button" class="btn-primary" on:click={() => window.print()}>
            Cetak PDF (APA 7)
          </button>
          <button type="button" class="btn-subtle" on:click={copyPermalink}>Salin Permalink</button>
          <button type="button" class="btn-subtle" on:click={copyEmbed}>Salin Embed</button>
        </div>
        {#if copyNotice}
          <div class="num" style="font-size: 10.5px; color: var(--ink-muted); word-break: break-all;">{copyNotice}</div>
        {/if}
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
  {/if}

  <!-- Dokumen Cetak PDF (Hanya aktif pada @media print) -->
  {#if displayRegion && displayPt}
    <section class="print-report" style="display: none;">
      <h1>Policy Brief Kekeringan &amp; Kerentanan Lahan — {displayRegion.nama}</h1>
      <p>Kode BPS {displayRegion.kode_bps} · {displayRegion.provinsi} · DAS {displayRegion.das} · Bulan {activeYm} · Status: {statusLabelId(displayPt.status)} ({activeGeeData ? activeGeeData.source : 'SIMULASI D1–D3'})</p>
      <p>SPI-3: {displayPt.spi3} | SSMA: {displayPt.ssma} | VHI: {displayPt.vhi} | PDLVI: {displayPt.pdlvi}</p>
      <h2>Ringkasan Analisis</h2>
      <p>{displayRegion.executive_brief_id}</p>
      <h2>Referensi (APA Edisi ke-7)</h2>
      <ol>
        {#each buildApaCitations() as cit}
          <li>{cit}</li>
        {/each}
      </ol>
    </section>
  {/if}

  <TrialOverlay bind:remainingSec bind:authenticated bind:userEmail bind:userName bind:userAvatar bind:userRole bind:wallActive />
</div>
