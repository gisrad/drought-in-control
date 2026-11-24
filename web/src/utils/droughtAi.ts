import type { DroughtMonthlyPoint } from '../types/drought';
import { CLIMATE_ZONE_META, getClimateZone } from './climateZones';

export interface PropagationLags {
  spiToSsmaLag: number;
  spiToSsmaR: number;
  ssmaToVhiLag: number;
  ssmaToVhiR: number;
  spiToPdlviLag: number;
  spiToPdlviR: number;
}

export interface ForecastHorizonPoint {
  step: number;
  ym: string;
  pdlvi: number;
  low90: number;
  high90: number;
  spi3: number;
  probAwasPct: number;
}

export interface DroughtForecast3m {
  phiPdlvi: number;
  sigmaPdlvi: number;
  horizon: ForecastHorizonPoint[];
}

function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 4) return 0;
  const muX = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const muY = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - muX;
    const dy = ys[i] - muY;
    num += dx * dy;
    sx += dx * dx;
    sy += dy * dy;
  }
  const den = Math.sqrt(sx * sy);
  return den > 1e-9 ? num / den : 0;
}

function bestLag(driver: number[], response: number[], maxLag = 4): { lag: number; r: number } {
  let best = { lag: 0, r: 0 };
  for (let k = 0; k <= maxLag; k++) {
    if (driver.length - k < 6) break;
    const xs = driver.slice(0, driver.length - k);
    const ys = response.slice(k);
    const r = pearson(xs, ys);
    if (r > best.r) best = { lag: k, r };
  }
  return { lag: best.lag, r: Number(best.r.toFixed(2)) };
}

export function detectPropagationLags(series: DroughtMonthlyPoint[]): PropagationLags {
  const spi = series.map((p) => p.spi3);
  const negSpi = spi.map((v) => -v);
  const ssma = series.map((p) => p.ssma);
  const vhi = series.map((p) => p.vhi);
  const pdlvi = series.map((p) => p.pdlvi);

  const l1 = bestLag(spi, ssma, 3);
  const l2 = bestLag(ssma, vhi, 3);
  const l3 = bestLag(negSpi, pdlvi, 4);

  return {
    spiToSsmaLag: l1.lag,
    spiToSsmaR: l1.r,
    ssmaToVhiLag: l2.lag,
    ssmaToVhiR: l2.r,
    spiToPdlviLag: l3.lag,
    spiToPdlviR: l3.r,
  };
}

function fitAr1(series: number[]): { mu: number; phi: number; sigma: number } {
  const n = series.length;
  if (n < 4) {
    const mu = n ? series.reduce((a, b) => a + b, 0) / n : 0;
    return { mu, phi: 0.5, sigma: 0.08 };
  }
  const mu = series.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let t = 1; t < n; t++) {
    const dxPrev = series[t - 1] - mu;
    const dxCurr = series[t] - mu;
    num += dxPrev * dxCurr;
    den += dxPrev * dxPrev;
  }
  const rawPhi = den > 1e-9 ? num / den : 0.5;
  const phi = Math.min(0.92, Math.max(0.05, rawPhi));

  let ss = 0;
  for (let t = 1; t < n; t++) {
    const pred = mu + phi * (series[t - 1] - mu);
    const err = series[t] - pred;
    ss += err * err;
  }
  const sigma = Math.max(0.02, Math.sqrt(ss / Math.max(1, n - 1)));
  return { mu, phi, sigma };
}

function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * poly;
  return z >= 0 ? p : 1 - p;
}

function addMonthsYm(ym: string, delta: number): string {
  const [yStr, mStr] = ym.split('-');
  const y = Number(yStr) || 2026;
  const m = (Number(mStr) || 1) - 1 + delta;
  const nextY = y + Math.floor(m / 12);
  const nextM = ((m % 12) + 12) % 12;
  return `${nextY}-${String(nextM + 1).padStart(2, '0')}`;
}

export function forecastDrought3m(series: DroughtMonthlyPoint[], kodeBps: string): DroughtForecast3m {
  const pdlvis = series.map((p) => p.pdlvi);
  const spi3s = series.map((p) => p.spi3);
  const lastYm = series[series.length - 1]?.ym || '2026-11';
  const lastPdlvi = pdlvis[pdlvis.length - 1] ?? 0.4;
  const lastSpi3 = spi3s[spi3s.length - 1] ?? -0.5;
  const zoneMeta = CLIMATE_ZONE_META[getClimateZone(kodeBps)];

  const arP = fitAr1(pdlvis);
  const arS = fitAr1(spi3s);

  const horizon: ForecastHorizonPoint[] = [];
  let prevP = lastPdlvi;
  let prevS = lastSpi3;
  let varP = 0;

  for (let h = 1; h <= 3; h++) {
    const nextP = Math.min(1.0, Math.max(0.0, arP.mu + arP.phi * (prevP - arP.mu)));
    const nextS = Math.min(3.5, Math.max(-3.5, arS.mu + arS.phi * (prevS - arS.mu)));
    varP = varP * arP.phi * arP.phi + arP.sigma * arP.sigma;
    const sdH = Math.sqrt(varP);
    const zThresh = (zoneMeta.pdlviAwas - nextP) / Math.max(sdH, 1e-4);
    const probAwasPct = Math.round((1 - normCdf(zThresh)) * 100);

    horizon.push({
      step: h,
      ym: addMonthsYm(lastYm, h),
      pdlvi: Number(nextP.toFixed(2)),
      low90: Number(Math.max(0, nextP - 1.645 * sdH).toFixed(2)),
      high90: Number(Math.min(1, nextP + 1.645 * sdH).toFixed(2)),
      spi3: Number(nextS.toFixed(2)),
      probAwasPct: Math.min(99, Math.max(1, probAwasPct)),
    });
    prevP = nextP;
    prevS = nextS;
  }

  return {
    phiPdlvi: Number(arP.phi.toFixed(2)),
    sigmaPdlvi: Number(arP.sigma.toFixed(3)),
    horizon,
  };
}
