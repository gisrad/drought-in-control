<script lang="ts">
  import type { DroughtDataset, DroughtRegionTimeseries } from '../types/drought';
  import { statusLabelId } from '../utils/colorScales';
  import { buildPolicyBriefMarkdown, regionSeriesToCsv, triggerDownload } from '../utils/citationGenerator';

  export let dataset: DroughtDataset;
  export let region: DroughtRegionTimeseries;
  export let activeYm: string;
  export let geojson: GeoJSON.FeatureCollection | null = null;
  export let onSelectRegion: (kodeBps: string) => void;

  $: latest = region.series[region.series.length - 1];
  $: minSpi = region.series.length ? Math.min(...region.series.map((s) => s.spi3)) : 0;
  $: maxPdlvi = region.series.length ? Math.max(...region.series.map((s) => s.pdlvi)) : 0;
  $: regionList = Object.values(dataset.regions).sort((a, b) => a.kode_bps.localeCompare(b.kode_bps));
  $: regionGroups = Array.from(
    regionList.reduce((acc, r) => {
      const list = acc.get(r.provinsi) || [];
      list.push(r);
      acc.set(r.provinsi, list);
      return acc;
    }, new Map<string, DroughtRegionTimeseries[]>()),
  ).sort((a, b) => a[0].localeCompare(b[0]));

  function downloadGeoJson() {
    const feat = geojson?.features.find((f) => String(f.properties?.kode_bps) === region.kode_bps);
    const fc = {
      type: 'FeatureCollection',
      metadata: {
        source: 'agri.transbulent.id/wilayah',
        attribution: 'Agri Transbulent / Transbulent Research Group',
        is_simulated: dataset.is_simulated,
        kode_bps: region.kode_bps,
        active_ym: activeYm,
      },
      features: feat
        ? [
            {
              ...feat,
              properties: {
                ...feat.properties,
                nama: region.nama,
                provinsi: region.provinsi,
                das: region.das,
                mean_slope_deg: region.mean_slope_deg,
                latest_ym: latest?.ym,
                latest_spi3: latest?.spi3,
                latest_ssma: latest?.ssma,
                latest_vhi: latest?.vhi,
                latest_pdlvi: latest?.pdlvi,
                latest_status: latest?.status,
                is_simulated: dataset.is_simulated,
              },
            },
          ]
        : [],
    };
    triggerDownload(`wilayah-${region.kode_bps}.geojson`, JSON.stringify(fc, null, 2), 'application/geo+json;charset=utf-8');
  }
</script>

<section style="max-width: 1120px; width: 100%; margin: 0 auto; padding: 24px 18px; display: grid; gap: 18px;">
  <div style="border: 1px solid var(--border); padding: 14px 16px; background: var(--surface); display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
    <div>
      <div class="num" style="font-size: 10.5px; color: var(--ink-muted);">
        PROFIL WILAYAH PUBLIK · ARSITEKTUR SKALA NASIONAL 38 PROVINSI / 514 KABUPATEN-KOTA
      </div>
      <div style="font-size: 0.92rem; color: var(--ink-secondary); margin-top: 3px;">
        Batas administratif riil 514 kabupaten/kota se-Indonesia (COD-AB / BPS) dengan fokus kalibrasi awal di Jawa Tengah &amp; D.I. Yogyakarta.
      </div>
    </div>
    <select
      aria-label="Pilih kabupaten atau kota"
      value={region.kode_bps}
      on:change={(e) => onSelectRegion((e.currentTarget as HTMLSelectElement).value)}
      style="padding: 8px 10px; border: 1.5px solid var(--border-ink); background: var(--bg); color: var(--ink); font-family: inherit;"
    >
      {#each regionGroups as [prov, items]}
        <optgroup label={prov}>
          {#each items as r}
            <option value={r.kode_bps}>{r.kode_bps} — {r.nama}</option>
          {/each}
        </optgroup>
      {/each}
    </select>
  </div>

  <div style="border: 1px solid var(--border-ink); padding: 20px; background: var(--bg); display: grid; gap: 16px;">
    <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px; flex-wrap: wrap;">
      <div>
        <div class="num" style="font-size: 11px; color: var(--ink-muted);">
          BPS {region.kode_bps} · {region.provinsi} · DAS {region.das} · Lereng rata-rata {region.mean_slope_deg}°
        </div>
        <h1 style="margin: 4px 0 0; font-size: 1.7rem; font-weight: 600;">{region.nama}</h1>
      </div>
      {#if latest}
        <span class={`pill-badge ${latest.status === 'parah' || latest.status === 'ekstrem' || latest.status === 'AWAS' ? 'pill-warn' : 'pill-sim'}`}>
          STATUS {statusLabelId(latest.status)} ({latest.ym})
        </span>
      {/if}
    </div>

    {#if latest}
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1px; background: var(--border); border: 1px solid var(--border);">
        <div style="background: var(--bg); padding: 12px;">
          <div class="num" style="font-size: 10px; color: var(--ink-muted);">SPI-3 TERKINI (MIN 36 BLN)</div>
          <div class="num" style="font-size: 1.5rem; font-weight: 600;">{latest.spi3}</div>
          <div class="num" style="font-size: 11px; color: var(--ink-muted);">Min: {minSpi}</div>
        </div>
        <div style="background: var(--bg); padding: 12px;">
          <div class="num" style="font-size: 10px; color: var(--ink-muted);">SSMA KELEMBAPAN TANAH</div>
          <div class="num" style="font-size: 1.5rem; font-weight: 600;">{latest.ssma}</div>
          <div class="num" style="font-size: 11px; color: var(--ink-muted);">Anomali standar ERA5</div>
        </div>
        <div style="background: var(--bg); padding: 12px;">
          <div class="num" style="font-size: 10px; color: var(--ink-muted);">VHI KESEHATAN VEGETASI</div>
          <div class="num" style="font-size: 1.5rem; font-weight: 600;">{latest.vhi}</div>
          <div class="num" style="font-size: 11px; color: var(--ink-muted);">Ambang stres &lt; 40</div>
        </div>
        <div style="background: var(--bg); padding: 12px;">
          <div class="num" style="font-size: 10px; color: var(--ink-muted);">PDLVI KERENTANAN (PUNCAK)</div>
          <div class="num" style="font-size: 1.5rem; font-weight: 600;">{latest.pdlvi}</div>
          <div class="num" style="font-size: 11px; color: var(--ink-muted);">Puncak 36 bln: {maxPdlvi}</div>
        </div>
      </div>
    {/if}

    <div style="border: 1px solid var(--border); padding: 12px; background: var(--surface);">
      <div class="num" style="font-size: 10.5px; color: var(--ink-muted); margin-bottom: 4px;">
        KONTEKS ENSO / IOD &amp; RINGKASAN ANALISIS WILAYAH
      </div>
      <p style="margin: 0; font-size: 0.94rem; color: var(--ink-secondary);">{region.executive_brief_id}</p>
    </div>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
      <a href={`/kekeringan/${region.kode_bps}/`} class="btn-primary">Buka Peta Interaktif Wilayah Ini →</a>
      {#if region.linked_panen_field_id}
        <a href={`/ulang/${region.linked_panen_field_id}/mt2-2025/`} class="btn-outline">Buka Musim Ulang →</a>
      {/if}
      <button type="button" class="btn-subtle" on:click={() => triggerDownload(`drought-${region.kode_bps}.csv`, regionSeriesToCsv(region, dataset.is_simulated), 'text/csv;charset=utf-8')}>
        Unduh CSV
      </button>
      <button type="button" class="btn-subtle" on:click={downloadGeoJson}>Unduh GeoJSON (QGIS)</button>
      <button type="button" class="btn-subtle" on:click={() => triggerDownload(`policy-brief-${region.kode_bps}-${activeYm}.md`, buildPolicyBriefMarkdown(region, activeYm, dataset.is_simulated), 'text/markdown;charset=utf-8')}>
        Brief (.md)
      </button>
      <button type="button" class="btn-subtle" on:click={() => window.print()}>Cetak PDF (APA 7)</button>
    </div>
  </div>
</section>
