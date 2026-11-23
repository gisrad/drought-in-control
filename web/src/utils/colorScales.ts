import type { DroughtIndexKey, DroughtMonthlyPoint, DroughtStatus } from '../types/drought';

export const INDEX_META: Record<
  DroughtIndexKey,
  { label: string; unit: string; short: string; desc: string; stops: [string, string][] }
> = {
  spi3: {
    label: 'SPI-3 (Curah Hujan)',
    short: 'SPI-3',
    unit: 'z-score',
    desc: 'Standardized Precipitation Index 3-bulanan dari CHIRPS Daily.',
    stops: [
      ['> -0.5', '#334155'],
      ['-0.5 s.d -1.0', '#E5DEC9'],
      ['-1.0 s.d -1.5', '#D97706'],
      ['-1.5 s.d -2.0', '#C2410C'],
      ['< -2.0', '#7C2D12'],
    ],
  },
  ssma: {
    label: 'SSMA (Kelembapan Tanah)',
    short: 'SSMA',
    unit: 'z-score',
    desc: 'Surface Soil Moisture Anomaly lapisan 0–7 cm (ERA5-Land / SMAP).',
    stops: [
      ['> -0.3', '#334155'],
      ['-0.3 s.d -0.8', '#E5DEC9'],
      ['-0.8 s.d -1.3', '#D97706'],
      ['-1.3 s.d -1.8', '#C2410C'],
      ['< -1.8', '#7C2D12'],
    ],
  },
  vhi: {
    label: 'VHI (Kesehatan Vegetasi)',
    short: 'VHI',
    unit: '0–100',
    desc: 'Vegetation Health Index komposit VCI + TCI MODIS (< 40 = stres vegetasi).',
    stops: [
      ['> 55', '#334155'],
      ['45–55', '#E5DEC9'],
      ['38–45', '#D97706'],
      ['30–38', '#C2410C'],
      ['< 30', '#7C2D12'],
    ],
  },
  pdlvi: {
    label: 'PDLVI (Kerentanan Pascakekeringan)',
    short: 'PDLVI',
    unit: '0–1',
    desc: 'Post-Drought Land Vulnerability Index: risiko retak tanah & erosi kilat saat hujan awal.',
    stops: [
      ['< 0.25', '#334155'],
      ['0.25–0.45', '#E5DEC9'],
      ['0.45–0.60', '#D97706'],
      ['0.60–0.75', '#C2410C'],
      ['>= 0.75', '#7C2D12'],
    ],
  },
};

export function colorForValue(key: DroughtIndexKey, pt: DroughtMonthlyPoint | undefined): string {
  if (!pt) return '#E5DEC9';
  if (key === 'spi3') {
    if (pt.spi3 <= -2.0) return '#7C2D12';
    if (pt.spi3 <= -1.5) return '#C2410C';
    if (pt.spi3 <= -1.0) return '#D97706';
    if (pt.spi3 <= -0.5) return '#E5DEC9';
    return '#334155';
  }
  if (key === 'ssma') {
    if (pt.ssma <= -1.8) return '#7C2D12';
    if (pt.ssma <= -1.3) return '#C2410C';
    if (pt.ssma <= -0.8) return '#D97706';
    if (pt.ssma <= -0.3) return '#E5DEC9';
    return '#334155';
  }
  if (key === 'vhi') {
    if (pt.vhi < 30) return '#7C2D12';
    if (pt.vhi < 38) return '#C2410C';
    if (pt.vhi < 45) return '#D97706';
    if (pt.vhi < 55) return '#E5DEC9';
    return '#334155';
  }
  if (pt.pdlvi >= 0.75) return '#7C2D12';
  if (pt.pdlvi >= 0.60) return '#C2410C';
  if (pt.pdlvi >= 0.45) return '#D97706';
  if (pt.pdlvi >= 0.25) return '#E5DEC9';
  return '#334155';
}

export function statusLabelId(status: DroughtStatus): string {
  const map: Record<DroughtStatus, string> = {
    normal: 'Normal',
    waspada: 'Waspada',
    moderat: 'Kekeringan Moderat',
    parah: 'Kekeringan Parah',
    ekstrem: 'Kekeringan Ekstrem',
  };
  return map[status];
}
