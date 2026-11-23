import type { DroughtRegionTimeseries } from '../types/drought';
import { statusLabelId } from './colorScales';

export function buildApaCitations(year = 2026): string[] {
  return [
    `Transbulent Research Group. (${year}). Drought in Control — Soil-Landscape Drought & Post-Drought Land Vulnerability Index (PDLVI) Jawa Tengah. Agri Transbulent. https://agri.transbulent.id/kekeringan/`,
    'Funk, C., Peterson, P., Landsfeld, M., Pedreros, D., Verdin, J., Shukla, S., Husak, G., Rowland, J., Harrison, L., Hoell, A., & Michaelsen, J. (2015). The climate hazards infrared precipitation with stations—a new environmental record for monitoring extremes. Scientific Data, 2, 150066.',
    'Kogan, F. N. (1995). Application of vegetation index and brightness temperature for drought detection. Advances in Space Research, 15(11), 91–100.',
    'McKee, T. B., Doesken, N. J., & Kleist, J. (1993). The relationship of drought frequency and duration to time scales. Proceedings of the 8th Conference on Applied Climatology, 179–184.',
    'Poggio, L., de Sousa, L. M., Batjes, N. H., Heuvelink, G. B. M., Kempen, B., Ribeiro, E., & Rossiter, D. (2021). SoilGrids 2.0: Producing soil information for the globe with quantified spatial uncertainty. Soil, 7(1), 217–240.',
  ];
}

export function regionSeriesToCsv(region: DroughtRegionTimeseries, isSimulated: boolean): string {
  const header = [
    '# sumber=agri.transbulent.id/kekeringan',
    `# wilayah=${region.nama} (BPS ${region.kode_bps}, ${region.provinsi}, DAS ${region.das})`,
    `# status_data=${isSimulated ? 'SIMULASI' : 'OBSERVASI'}`,
    'ym,spi3,ssma,vhi,pdlvi,status',
  ];
  const rows = region.series.map((s) => `${s.ym},${s.spi3},${s.ssma},${s.vhi},${s.pdlvi},${s.status}`);
  return [...header, ...rows].join('\n') + '\n';
}

export function buildPolicyBriefMarkdown(
  region: DroughtRegionTimeseries,
  activeYm: string,
  isSimulated: boolean
): string {
  const idx = region.series.findIndex((p) => p.ym === activeYm);
  const pt = idx >= 0 ? region.series[idx] : region.series[region.series.length - 1];
  const citations = buildApaCitations().map((c, i) => `${i + 1}. ${c}`).join('\n');

  return [
    `# Policy Brief Kekeringan & Kerentanan Lahan — ${region.nama}`,
    '',
    `- **Kode BPS / Wilayah:** ${region.kode_bps} · ${region.provinsi} (DAS ${region.das})`,
    `- **Sentroid:** ${region.centroid[1].toFixed(3)} LS, ${region.centroid[0].toFixed(3)} BT · Lereng rata-rata: ${region.mean_slope_deg}°`,
    `- **Bulan Evaluasi:** ${pt.ym} · **Status:** ${statusLabelId(pt.status)}`,
    `- **Status Dataset:** ${isSimulated ? 'SIMULASI (Mock Realistis D1–D3)' : 'Data Satelit Terverifikasi'}`,
    '',
    '## Ringkasan Indikator Utama',
    '',
    `| Indikator | Nilai (${pt.ym}) | Keterangan |`,
    `| --- | --- | --- |`,
    `| **SPI-3** | ${pt.spi3} | Defisit hujan 3-bulanan (CHIRPS) |`,
    `| **SSMA** | ${pt.ssma} | Anomali kelembapan tanah permukaan |`,
    `| **VHI** | ${pt.vhi} | Kesehatan vegetasi (< 40 = stres) |`,
    `| **PDLVI** | ${pt.pdlvi} | Kerentanan erosi pascakekeringan [0–1] |`,
    '',
    '## Analisis Ringkas Wilayah',
    '',
    region.executive_brief_id,
    '',
    '## Referensi Ilmiah (APA Edisi ke-7)',
    '',
    citations,
    '',
  ].join('\n');
}

export function triggerDownload(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
