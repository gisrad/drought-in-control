import type { DroughtIndexKey } from '../types/drought';

export type ReliefRegionId =
  | 'indonesia'
  | 'jawa'
  | 'jateng'
  | 'sumatera'
  | 'ntt_bali'
  | 'kalimantan'
  | 'sulawesi';

export type AspectPreset = 'auto' | '16x9' | '9x16' | '4x5';
export type ReliefLocale = 'id' | 'en';

export interface AnchorCity {
  name: string;
  lon: number;
  lat: number;
}

export interface PinGridJson {
  id: ReliefRegionId;
  label: string;
  labelEn: string;
  stepDeg: number;
  spacingKm: number;
  bbox: [number, number, number, number];
  pinCount: number;
  codes: string[];
  lons: number[];
  lats: number[];
  regIdx: number[];
  cols: number[];
  rows: number[];
  anchors: AnchorCity[];
}

export interface CameraPose {
  yawDeg: number;
  pitchDeg: number;
  distance: number;
  offsetX?: number;
  offsetZ?: number;
}

export interface RegionPresetConfig {
  id: ReliefRegionId;
  label: string;
  labelEn: string;
  poseByAspect: Record<'16x9' | '9x16' | '4x5', CameraPose>;
  pinScale: number;
  heightScale: number;
}

export const ASPECT_DIMS: Record<Exclude<AspectPreset, 'auto'>, { w: number; h: number; label: string }> = {
  '16x9': { w: 1920, h: 1080, label: '16:9 · X / YouTube' },
  '9x16': { w: 1080, h: 1920, label: '9:16 · TikTok / Reels' },
  '4x5': { w: 1080, h: 1350, label: '4:5 · IG Carousel' },
};

export const REGION_PRESETS: Record<ReliefRegionId, RegionPresetConfig> = {
  indonesia: {
    id: 'indonesia',
    label: 'Indonesia',
    labelEn: 'Indonesia',
    poseByAspect: {
      '16x9': { yawDeg: -4, pitchDeg: 42, distance: 3.15 },
      '9x16': { yawDeg: -14, pitchDeg: 46, distance: 2.35 },
      '4x5': { yawDeg: -8, pitchDeg: 45, distance: 3.15 },
    },
    pinScale: 0.58,
    heightScale: 0.24,
  },
  jawa: {
    id: 'jawa',
    label: 'Jawa & Bali',
    labelEn: 'Java & Bali',
    poseByAspect: {
      '16x9': { yawDeg: -8, pitchDeg: 40, distance: 3.35 },
      '9x16': { yawDeg: -50, pitchDeg: 40, distance: 3.62, offsetX: -0.02, offsetZ: 0.03 },
      '4x5': { yawDeg: -34, pitchDeg: 40, distance: 3.05 },
    },
    pinScale: 0.58,
    heightScale: 0.27,
  },
  jateng: {
    id: 'jateng',
    label: 'Jateng & DIY',
    labelEn: 'Central Java & DIY',
    poseByAspect: {
      '16x9': { yawDeg: -6, pitchDeg: 42, distance: 3.25 },
      '9x16': { yawDeg: -42, pitchDeg: 40, distance: 3.45 },
      '4x5': { yawDeg: -18, pitchDeg: 42, distance: 3.15 },
    },
    pinScale: 0.58,
    heightScale: 0.28,
  },
  sumatera: {
    id: 'sumatera',
    label: 'Sumatera',
    labelEn: 'Sumatra',
    poseByAspect: {
      '16x9': { yawDeg: 18, pitchDeg: 42, distance: 3.45 },
      '9x16': { yawDeg: 20, pitchDeg: 42, distance: 3.72 },
      '4x5': { yawDeg: 18, pitchDeg: 42, distance: 3.25 },
    },
    pinScale: 0.58,
    heightScale: 0.26,
  },
  ntt_bali: {
    id: 'ntt_bali',
    label: 'Bali & NTT',
    labelEn: 'Bali & Nusa Tenggara',
    poseByAspect: {
      '16x9': { yawDeg: -6, pitchDeg: 42, distance: 3.35 },
      '9x16': { yawDeg: -54, pitchDeg: 38, distance: 2.65 },
      '4x5': { yawDeg: -34, pitchDeg: 40, distance: 3.05 },
    },
    pinScale: 0.62,
    heightScale: 0.28,
  },
  kalimantan: {
    id: 'kalimantan',
    label: 'Kalimantan',
    labelEn: 'Kalimantan',
    poseByAspect: {
      '16x9': { yawDeg: -8, pitchDeg: 42, distance: 3.4 },
      '9x16': { yawDeg: -10, pitchDeg: 44, distance: 3.2 },
      '4x5': { yawDeg: -8, pitchDeg: 43, distance: 3.3 },
    },
    pinScale: 0.58,
    heightScale: 0.26,
  },
  sulawesi: {
    id: 'sulawesi',
    label: 'Sulawesi',
    labelEn: 'Sulawesi',
    poseByAspect: {
      '16x9': { yawDeg: -12, pitchDeg: 42, distance: 3.4 },
      '9x16': { yawDeg: -14, pitchDeg: 44, distance: 3.05 },
      '4x5': { yawDeg: -12, pitchDeg: 43, distance: 3.2 },
    },
    pinScale: 0.58,
    heightScale: 0.26,
  },
};

export interface RampStop {
  t: number; // 0..1 normalized along the ramp
  val: number; // physical domain value
  hex: string;
}

export interface MetricVisualSpec {
  key: DroughtIndexKey;
  mode: 'bipolar' | 'unipolar';
  minVal: number;
  maxVal: number;
  centerVal: number;
  stops: RampStop[];
  legendTicks: [string, string, string];
  unitLabel: string;
}

export const METRIC_VISUALS: Record<DroughtIndexKey, MetricVisualSpec> = {
  spi3: {
    key: 'spi3',
    mode: 'bipolar',
    minVal: -2.5,
    maxVal: 2.5,
    centerVal: 0.0,
    stops: [
      { t: 0.0, val: -2.5, hex: '#943B18' },
      { t: 0.22, val: -1.4, hex: '#C76B37' },
      { t: 0.40, val: -0.5, hex: '#DFAC80' },
      { t: 0.50, val: 0.0, hex: '#D8DCE0' },
      { t: 0.62, val: 0.6, hex: '#88C1D8' },
      { t: 0.80, val: 1.5, hex: '#3F94BA' },
      { t: 1.0, val: 2.5, hex: '#1E668E' },
    ],
    legendTicks: ['Kering -2.5', 'Normal 0', 'Basah +2.5'],
    unitLabel: 'SPI-3',
  },
  ssma: {
    key: 'ssma',
    mode: 'bipolar',
    minVal: -2.5,
    maxVal: 2.5,
    centerVal: 0.0,
    stops: [
      { t: 0.0, val: -2.5, hex: '#943B18' },
      { t: 0.22, val: -1.4, hex: '#C76B37' },
      { t: 0.40, val: -0.5, hex: '#DFAC80' },
      { t: 0.50, val: 0.0, hex: '#D8DCE0' },
      { t: 0.62, val: 0.6, hex: '#88C1D8' },
      { t: 0.80, val: 1.5, hex: '#3F94BA' },
      { t: 1.0, val: 2.5, hex: '#1E668E' },
    ],
    legendTicks: ['Defisit -2.5', 'Normal 0', 'Jenuh +2.5'],
    unitLabel: 'SSMA',
  },
  vhi: {
    key: 'vhi',
    mode: 'bipolar',
    minVal: 20,
    maxVal: 80,
    centerVal: 50,
    stops: [
      { t: 0.0, val: 20, hex: '#943B18' },
      { t: 0.25, val: 35, hex: '#CA753A' },
      { t: 0.50, val: 50, hex: '#D9DCD6' },
      { t: 0.75, val: 65, hex: '#63AB80' },
      { t: 1.0, val: 80, hex: '#287750' },
    ],
    legendTicks: ['Stres 20', 'Netral 50', 'Subur 80'],
    unitLabel: 'VHI',
  },
  pdlvi: {
    key: 'pdlvi',
    mode: 'unipolar',
    minVal: 0.0,
    maxVal: 1.0,
    centerVal: 0.0,
    stops: [
      { t: 0.0, val: 0.0, hex: '#435262' },
      { t: 0.28, val: 0.28, hex: '#D9CEB4' },
      { t: 0.50, val: 0.50, hex: '#DE8821' },
      { t: 0.72, val: 0.72, hex: '#C2410C' },
      { t: 1.0, val: 1.0, hex: '#7C1E12' },
    ],
    legendTicks: ['Aman 0.0', 'Siaga 0.5', 'Kritis 1.0'],
    unitLabel: 'PDLVI',
  },
};

export function hexToRgbNorm(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function sampleRampHex(spec: MetricVisualSpec, rawVal: number): string {
  const t = Math.max(0, Math.min(1, (rawVal - spec.minVal) / Math.max(spec.maxVal - spec.minVal, 1e-6)));
  const stops = spec.stops;
  if (t <= stops[0].t) return stops[0].hex;
  if (t >= stops[stops.length - 1].t) return stops[stops.length - 1].hex;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (t >= a.t && t <= b.t) {
      const f = (t - a.t) / Math.max(b.t - a.t, 1e-6);
      const ca = hexToRgbNorm(a.hex);
      const cb = hexToRgbNorm(b.hex);
      const r = Math.round((ca[0] + (cb[0] - ca[0]) * f) * 255);
      const g = Math.round((ca[1] + (cb[1] - ca[1]) * f) * 255);
      const bl = Math.round((ca[2] + (cb[2] - ca[2]) * f) * 255);
      return `rgb(${r}, ${g}, ${bl})`;
    }
  }
  return stops[stops.length - 1].hex;
}

/** Normalize raw metric value to [-1..+1] (bipolar) or [0..1] (unipolar) for the GPU vertex shader. */
export function normalizeForShader(metric: DroughtIndexKey, rawVal: number): number {
  const spec = METRIC_VISUALS[metric];
  if (spec.mode === 'unipolar') {
    return Math.max(0, Math.min(1, (rawVal - spec.minVal) / Math.max(spec.maxVal - spec.minVal, 1e-6)));
  }
  const half = (spec.maxVal - spec.minVal) * 0.5;
  return Math.max(-1, Math.min(1, (rawVal - spec.centerVal) / Math.max(half, 1e-6)));
}

export function buildEditorialTitle(
  regionId: ReliefRegionId,
  metric: DroughtIndexKey,
  timeCount: number,
  spacingKm: number,
  locale: ReliefLocale,
  cadence: 'monthly' | 'annual_spi12' = 'monthly'
): { title: string; subtitle: string } {
  const regLabel = locale === 'en' ? REGION_PRESETS[regionId].labelEn : REGION_PRESETS[regionId].label;
  const spanLabel =
    cadence === 'annual_spi12'
      ? locale === 'en'
        ? `${timeCount} years`
        : `${timeCount} tahun`
      : locale === 'en'
        ? `${timeCount} months`
        : `${timeCount} bulan`;

  if (metric === 'pdlvi') {
    return locale === 'en'
      ? {
          title: `Post-drought land vulnerability across ${regLabel}`,
          subtitle: `Spires rise where water deficit meets steep slopes · PDLVI every ${spacingKm} km (${spanLabel})`,
        }
      : {
          title: `Kerentanan lahan pascakekeringan di ${regLabel}`,
          subtitle: `Pilar menjulang saat defisit air bertemu lereng curam · PDLVI tiap ${spacingKm} km (${spanLabel})`,
        };
  }
  if (metric === 'ssma') {
    return locale === 'en'
      ? {
          title: `Soil moisture dynamics across ${regLabel}`,
          subtitle: `Pins rise in wet soil and sink in dry seasons · SSMA every ${spacingKm} km (${spanLabel})`,
        }
      : {
          title: `Dinamika lengas tanah di ${regLabel}`,
          subtitle: `Pin naik saat tanah jenuh dan tenggelam saat kering · SSMA tiap ${spacingKm} km (${spanLabel})`,
        };
  }
  if (metric === 'vhi') {
    return locale === 'en'
      ? {
          title: `Vegetation canopy health across ${regLabel}`,
          subtitle: `Pins rise in lush canopy and sink under heat stress · VHI every ${spacingKm} km (${spanLabel})`,
        }
      : {
          title: `Kesehatan tajuk vegetasi di ${regLabel}`,
          subtitle: `Pin naik saat tajuk subur dan tenggelam saat cekaman · VHI tiap ${spacingKm} km (${spanLabel})`,
        };
  }
  return locale === 'en'
    ? {
        title: `${spanLabel} of rain across ${regLabel}`,
        subtitle: `Pins rise in wet periods and sink in dry ones · SPI-3 every ${spacingKm} km`,
      }
    : {
        title: `${spanLabel} anomali hujan di ${regLabel}`,
        subtitle: `Pin naik saat basah dan tenggelam saat kering · SPI-3 tiap ${spacingKm} km`,
      };
}

export function describeMeanStatus(
  metric: DroughtIndexKey,
  val: number,
  locale: ReliefLocale
): { text: string; metricStr: string } {
  if (metric === 'pdlvi') {
    const metricStr = `PDLVI ${val.toFixed(2)}`;
    if (locale === 'en') {
      if (val >= 0.75) return { text: 'critical vulnerability', metricStr };
      if (val >= 0.60) return { text: 'high vulnerability', metricStr };
      if (val >= 0.45) return { text: 'moderate vulnerability', metricStr };
      if (val >= 0.28) return { text: 'elevated watch', metricStr };
      return { text: 'low vulnerability', metricStr };
    }
    if (val >= 0.75) return { text: 'kerentanan kritis', metricStr };
    if (val >= 0.60) return { text: 'kerentanan tinggi', metricStr };
    if (val >= 0.45) return { text: 'kerentanan sedang', metricStr };
    if (val >= 0.28) return { text: 'waspada lereng', metricStr };
    return { text: 'kerentanan rendah', metricStr };
  }

  if (metric === 'vhi') {
    const metricStr = `VHI ${val.toFixed(1)}`;
    if (locale === 'en') {
      if (val < 30) return { text: 'severe canopy stress', metricStr };
      if (val < 40) return { text: 'moderate stress', metricStr };
      if (val < 46) return { text: 'mildly stressed', metricStr };
      if (val <= 56) return { text: 'near normal', metricStr };
      return { text: 'healthy canopy', metricStr };
    }
    if (val < 30) return { text: 'cekaman tajuk parah', metricStr };
    if (val < 40) return { text: 'cekaman moderat', metricStr };
    if (val < 46) return { text: 'agak tercekam', metricStr };
    if (val <= 56) return { text: 'mendekati normal', metricStr };
    return { text: 'tajuk subur', metricStr };
  }

  const label = metric === 'ssma' ? 'SSMA' : 'SPI';
  const sign = val >= 0 ? '+' : '';
  const metricStr = `${label} ${sign}${val.toFixed(2)}`;
  if (locale === 'en') {
    if (val <= -2.0) return { text: 'extremely dry', metricStr };
    if (val <= -1.5) return { text: 'severely dry', metricStr };
    if (val <= -1.0) return { text: 'moderately dry', metricStr };
    if (val <= -0.4) return { text: 'mildly dry', metricStr };
    if (val < 0.4) return { text: 'near normal', metricStr };
    if (val < 1.0) return { text: 'mildly wet', metricStr };
    if (val < 1.5) return { text: 'moderately wet', metricStr };
    return { text: 'very wet', metricStr };
  }
  if (val <= -2.0) return { text: 'kering ekstrem', metricStr };
  if (val <= -1.5) return { text: 'kering parah', metricStr };
  if (val <= -1.0) return { text: 'kering moderat', metricStr };
  if (val <= -0.4) return { text: 'agak kering', metricStr };
  if (val < 0.4) return { text: 'mendekati normal', metricStr };
  if (val < 1.0) return { text: 'agak basah', metricStr };
  if (val < 1.5) return { text: 'basah moderat', metricStr };
  return { text: 'sangat basah', metricStr };
}

/** O(N) spatial smoothing across integer grid coordinates (col, row) for continuous relief fields. */
export function smoothGridFrame(
  values: Float32Array,
  cols: number[],
  rows: number[],
  passes: number
): Float32Array {
  if (passes <= 0) return values;
  const n = values.length;
  const lookup = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    lookup.set((rows[i] << 14) | cols[i], i);
  }
  let curr = new Float32Array(values);
  let next = new Float32Array(n);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < n; i++) {
      const c = cols[i];
      const r = rows[i];
      let sum = curr[i] * 2.4;
      let w = 2.4;
      for (let d = 0; d < dirs.length; d++) {
        const nb = lookup.get(((r + dirs[d][1]) << 14) | (c + dirs[d][0]));
        if (nb !== undefined) {
          const wt = d < 4 ? 1.0 : 0.65;
          sum += curr[nb] * wt;
          w += wt;
        }
      }
      next[i] = sum / w;
    }
    const tmp = curr;
    curr = next;
    next = tmp;
  }
  return curr;
}

export interface ParsedPinBin {
  meta: {
    region: string;
    label?: string;
    metric: DroughtIndexKey;
    cadence?: 'monthly' | 'annual_spi12';
    source: string;
    is_simulated: boolean;
    spacing_km: number;
    step_deg: number;
    bbox: [number, number, number, number];
    pin_count: number;
    time_count: number;
    time_labels: string[];
    scale_min: number;
    scale_max: number;
    anchors?: AnchorCity[];
  };
  lons: Float32Array;
  lats: Float32Array;
  frames: Float32Array[];
}

export function parsePinBin(buffer: ArrayBuffer): ParsedPinBin {
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength < 8) throw new Error('Berkas .pinbin terlalu kecil.');
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'PIN1') throw new Error('Header berkas bukan format PIN1 yang valid.');
  const view = new DataView(buffer);
  const metaLen = view.getUint32(4, true);
  const metaEnd = 8 + metaLen;
  if (metaEnd > bytes.byteLength) throw new Error('Metadata PIN1 korup.');
  const metaText = new TextDecoder('utf-8').decode(bytes.subarray(8, metaEnd));
  const meta = JSON.parse(metaText);
  const pinCount = Number(meta.pin_count);
  const timeCount = Number(meta.time_count);
  const sMin = Number(meta.scale_min ?? -3.0);
  const sMax = Number(meta.scale_max ?? 3.0);

  let pos = metaEnd;
  const f32Bytes = pinCount * 4;
  const lons = new Float32Array(buffer.slice(pos, pos + f32Bytes));
  pos += f32Bytes;
  const lats = new Float32Array(buffer.slice(pos, pos + f32Bytes));
  pos += f32Bytes;

  const frames: Float32Array[] = [];
  for (let t = 0; t < timeCount; t++) {
    const raw = new Int8Array(buffer, pos, pinCount);
    pos += pinCount;
    const out = new Float32Array(pinCount);
    for (let i = 0; i < pinCount; i++) {
      const q = raw[i];
      if (q === -128) {
        out[i] = 0;
      } else {
        const u = (q + 127) / 254;
        out[i] = sMin + u * (sMax - sMin);
      }
    }
    frames.push(out);
  }
  return { meta, lons, lats, frames };
}
