import type { DroughtIndexKey } from '../types/drought';
import type { PinFieldEngine } from './pinFieldEngine';
import {
  buildEditorialTitle,
  describeMeanStatus,
  METRIC_VISUALS,
  sampleRampHex,
  type AnchorCity,
  type AspectPreset,
  type ReliefLocale,
  type ReliefRegionId,
} from './pinFieldConfig';

export interface HudRenderParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  engine: PinFieldEngine;
  regionId: ReliefRegionId;
  metric: DroughtIndexKey;
  locale: ReliefLocale;
  aspect: AspectPreset;
  timeLabels: string[];
  meanSeries: number[];
  frameFloat: number;
  spacingKm: number;
  isSimulated: boolean;
  sourceLabel: string;
  anchors: AnchorCity[];
  cadence?: 'monthly' | 'annual_spi12';
  customTitle?: string;
  customSubtitle?: string;
  showSafeZoneGuides?: boolean;
  climateZoneLabel?: string;
}

function drawRoundedLineText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, curY);
      line = words[i];
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, curY);
    curY += lineHeight;
  }
  return curY;
}

export function renderReliefCompositeFrame(params: HudRenderParams): void {
  const {
    ctx,
    width: W,
    height: H,
    engine,
    regionId,
    metric,
    locale,
    aspect,
    timeLabels,
    meanSeries,
    frameFloat,
    spacingKm,
    isSimulated,
    sourceLabel,
    anchors,
    cadence = 'monthly',
    customTitle,
    customSubtitle,
    showSafeZoneGuides = false,
    climateZoneLabel,
  } = params;

  const spec = METRIC_VISUALS[metric];
  const isPortrait = H > W;
  const isReels916 = aspect === '9x16' || (aspect === 'auto' && H / W > 1.35);

  // 1. Matte Studio Background (#171A1F with restrained architectural radial vignette)
  ctx.save();
  ctx.fillStyle = '#171A1F';
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createRadialGradient(W * 0.5, H * 0.48, W * 0.1, W * 0.5, H * 0.5, Math.max(W, H) * 0.72);
  grad.addColorStop(0, '#1D2128');
  grad.addColorStop(1, '#13161B');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 2. Composite WebGL 3D Pin-Field Layer
  ctx.drawImage(engine.domElement, 0, 0, W, H);

  // Safe margins
  const padX = Math.round(W * (isPortrait ? 0.055 : 0.036));
  const safeTop = isReels916 ? Math.round(H * 0.125) : Math.round(H * 0.045);
  const safeBottom = isReels916 ? Math.round(H * 0.785) : Math.round(H * 0.948);
  const safeRightX = isReels916 ? Math.round(W * 0.855) : W - padX;
  const s = Math.min(W, H) / 1080; // unified scale token

  // 3. Projected 3D Anchor City Labels (with collision culling)
  const placedBoxes: Array<[number, number, number, number]> = [];
  const labelFontSize = Math.max(11, Math.round((isPortrait ? 20 : 16) * s));
  ctx.font = `500 ${labelFontSize}px "Overused Grotesk", system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  for (const city of anchors) {
    const p = engine.projectLonLatToScreen(city.lon, city.lat, W, H, 0.03);
    if (!p.visible) continue;
    if (p.y < safeTop + 60 * s || p.y > safeBottom - 80 * s) continue;
    if (p.x > safeRightX - 60 * s) continue;

    const tw = ctx.measureText(city.name).width;
    const lx = p.x + 8 * s;
    const ly = p.y;
    const box: [number, number, number, number] = [lx - 4, ly - labelFontSize * 0.7, lx + tw + 6, ly + labelFontSize * 0.7];
    let collides = false;
    for (const b of placedBoxes) {
      if (!(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3])) {
        collides = true;
        break;
      }
    }
    if (collides) continue;
    placedBoxes.push(box);

    // Subtle city pin dot
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(2.5, 3.2 * s), 0, Math.PI * 2);
    ctx.fillStyle = '#F4F5F7';
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, 1.5 * s);
    ctx.strokeStyle = '#171A1F';
    ctx.stroke();

    // Crisp haloed city name
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2.8, 4.0 * s);
    ctx.strokeStyle = 'rgba(20, 23, 28, 0.9)';
    ctx.strokeText(city.name, lx, ly);
    ctx.fillStyle = '#E8ECF2';
    ctx.fillText(city.name, lx, ly);
  }

  // 4. Top-Left Editorial Title & Subtitle
  const autoCopy = buildEditorialTitle(regionId, metric, timeLabels.length || 36, spacingKm, locale, cadence);
  const titleText = customTitle?.trim() || autoCopy.title;
  const subText = customSubtitle?.trim() || autoCopy.subtitle;

  const titleSize = Math.max(18, Math.round((isPortrait ? 38 : 34) * s));
  const subSize = Math.max(11, Math.round((isPortrait ? 19 : 16.5) * s));
  const titleMaxW = isPortrait ? safeRightX - padX : Math.round(W * 0.58);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `600 ${titleSize}px "Overused Grotesk", system-ui, sans-serif`;
  ctx.fillStyle = '#F5F7FA';
  const afterTitleY = drawRoundedLineText(ctx, titleText, padX, safeTop, titleMaxW, Math.round(titleSize * 1.15));

  ctx.font = `400 ${subSize}px "Overused Grotesk", system-ui, sans-serif`;
  ctx.fillStyle = '#A0A7B3';
  const afterSubY = drawRoundedLineText(ctx, subText, padX, afterTitleY + 4 * s, titleMaxW, Math.round(subSize * 1.28));

  // 5. Minimal Diverging / Hazard Legend Bar
  const provSize = Math.max(9, Math.round(11 * s));
  const barW = Math.round((isPortrait ? Math.min(340 * Math.max(0.8, s), safeRightX - padX) : 290 * Math.max(0.8, s)));
  const barH = Math.max(4, Math.round(5.5 * s));
  const barX = isPortrait ? padX : safeRightX - barW;
  const barY = isPortrait ? afterSubY + Math.max(22, Math.round(28 * s)) : safeTop + Math.round(12 * s);

  const rampGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  for (const st of spec.stops) {
    rampGrad.addColorStop(st.t, st.hex);
  }
  ctx.fillStyle = rampGrad;
  ctx.fillRect(barX, barY, barW, barH);

  // Zero / center tick extending slightly upward
  const centerTickX = barX + barW * 0.5;
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = Math.max(1, 1.4 * s);
  ctx.beginPath();
  ctx.moveTo(centerTickX, barY - Math.max(3, 4 * s));
  ctx.lineTo(centerTickX, barY + barH + Math.max(2, 2 * s));
  ctx.stroke();

  const tickFont = Math.max(9.5, Math.round(12.5 * s));
  ctx.font = `500 ${tickFont}px "IBM Plex Mono", monospace`;
  ctx.fillStyle = '#B8BEC8';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(spec.legendTicks[0], barX, barY + barH + Math.max(4, 5 * s));
  ctx.textAlign = 'center';
  ctx.fillText(spec.legendTicks[1], centerTickX, barY + barH + Math.max(4, 5 * s));
  ctx.textAlign = 'right';
  ctx.fillText(spec.legendTicks[2], barX + barW, barY + barH + Math.max(4, 5 * s));

  // Understated provenance pill cleanly above legend bar
  const provText = isSimulated
    ? locale === 'en'
      ? 'SIMULATED · 514 REGENCIES'
      : 'SIMULASI · 514 KAB/KOTA'
    : sourceLabel.toUpperCase();
  const provTag = climateZoneLabel ? `${provText} · ${climateZoneLabel}` : provText;
  ctx.font = `500 ${provSize}px "IBM Plex Mono", monospace`;
  ctx.fillStyle = isSimulated ? '#DFAC80' : '#88C1D8';
  ctx.textAlign = isPortrait ? 'left' : 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(provTag, isPortrait ? barX : barX + barW, barY - Math.max(5, 6 * s));

  // 6. Current Frame Interpolated Value + Bottom-Left Giant Tabular Timestamp
  const maxIdx = Math.max(0, timeLabels.length - 1);
  const clamped = Math.max(0, Math.min(maxIdx, frameFloat));
  const i0 = Math.floor(clamped);
  const i1 = Math.min(maxIdx, i0 + 1);
  const frac = clamped - i0;
  const curMean =
    meanSeries.length > 0
      ? (meanSeries[i0] ?? 0) * (1 - frac) + (meanSeries[i1] ?? meanSeries[i0] ?? 0) * frac
      : 0;
  const curLabel = timeLabels[Math.round(clamped)] || '—';
  const statusInfo = describeMeanStatus(metric, curMean, locale);

  // Sparkline & bottom typography sizing (exact pixel bottom-up stacking to prevent any overlap)
  const sparkW = isPortrait ? Math.min(Math.max(220, 360 * s), safeRightX - padX) : Math.round(310 * s);
  const sparkH = Math.max(38, Math.round((isPortrait ? 58 : 58) * s));
  const sparkTitleSize = Math.max(10, Math.round(13 * s));
  const axisFont = Math.max(9, Math.round(11 * s));

  const dateSize = Math.max(24, Math.round(52 * s));
  const statusSize = Math.max(12, Math.round(20 * s));
  const creditSize = Math.max(9, Math.round(12.5 * s));

  const creditY = safeBottom;
  const axisY = creditY - creditSize - Math.max(8, Math.round(10 * s)) - axisFont;
  const sparkY = axisY - Math.max(4, Math.round(5 * s)) - sparkH;
  const sparkHeaderY = sparkY - Math.max(5, Math.round(6 * s));

  // Measure whether status fits inline next to timestamp
  ctx.font = `500 ${dateSize}px "IBM Plex Mono", monospace`;
  const dateW = ctx.measureText(curLabel).width;
  ctx.font = `500 ${statusSize}px "Overused Grotesk", system-ui, sans-serif`;
  const statusStr = `${statusInfo.text} (${statusInfo.metricStr})`;
  const statusGap = Math.max(10, Math.round(14 * s));
  const maxInlineX = isPortrait ? safeRightX : safeRightX - sparkW - Math.round(24 * s);
  const statusFitsInline = padX + dateW + statusGap + ctx.measureText(statusStr).width <= maxInlineX;

  const dateBlockY = isPortrait
    ? sparkHeaderY - sparkTitleSize - Math.max(14, Math.round(18 * s)) - dateSize - (statusFitsInline ? 0 : statusSize + 4)
    : creditY - creditSize - Math.max(12, Math.round(14 * s)) - dateSize;

  // Giant tabular timestamp
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `500 ${dateSize}px "IBM Plex Mono", monospace`;
  ctx.fillStyle = '#F5F7FA';
  ctx.fillText(curLabel, padX, dateBlockY);

  // Inline or stacked qualitative status + index reading
  ctx.font = `500 ${statusSize}px "Overused Grotesk", system-ui, sans-serif`;
  ctx.fillStyle = '#C7CDD6';
  if (statusFitsInline) {
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(statusStr, padX + dateW + statusGap, dateBlockY + dateSize * 0.84);
  } else {
    ctx.textBaseline = 'top';
    ctx.fillText(statusStr, padX, dateBlockY + dateSize + 2);
  }

  // Micro academic credit footer
  ctx.textBaseline = 'bottom';
  ctx.font = `400 ${creditSize}px "IBM Plex Mono", monospace`;
  ctx.fillStyle = '#7D8590';
  const creditLine =
    W < 520
      ? isSimulated
        ? '514 BPS (Simulasi) · agri.transbulent.id/kekeringan/relief'
        : `${sourceLabel} · agri.transbulent.id/kekeringan/relief`
      : isSimulated
        ? `Baseline: 514 Kab/Kota BPS (${sourceLabel}) · agri.transbulent.id/kekeringan/relief`
        : `Data: ${sourceLabel} · agri.transbulent.id/kekeringan/relief`;
  ctx.fillText(creditLine, padX, creditY);

  // 7. Bottom-Right (or stacked in portrait) Synchronized Bipolar Sparkline
  const sparkX = isPortrait ? padX : safeRightX - sparkW;

  ctx.font = `500 ${sparkTitleSize}px "Overused Grotesk", system-ui, sans-serif`;
  ctx.fillStyle = '#B8BEC8';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  const sparkHeader =
    locale === 'en'
      ? `${REGION_NAME_EN(regionId)} mean ${spec.unitLabel} by period`
      : `Rata-rata ${spec.unitLabel} ${REGION_NAME_ID(regionId)}`;
  ctx.fillText(sparkHeader, sparkX, sparkHeaderY);

  // Baseline zero/center line
  const zeroY = spec.mode === 'unipolar' ? sparkY + sparkH : sparkY + sparkH * 0.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sparkX, zeroY);
  ctx.lineTo(sparkX + sparkW, zeroY);
  ctx.stroke();

  if (meanSeries.length > 0) {
    const count = meanSeries.length;
    const slotW = sparkW / count;
    const barDrawW = Math.max(1.4, slotW * 0.68);
    const halfSpan = Math.max((spec.maxVal - spec.minVal) * 0.5, 1e-6);

    for (let i = 0; i < count; i++) {
      const val = meanSeries[i];
      const bx = sparkX + i * slotW + (slotW - barDrawW) * 0.5;
      ctx.fillStyle = sampleRampHex(spec, val);
      ctx.globalAlpha = i <= Math.ceil(clamped) ? 0.96 : 0.34;
      if (spec.mode === 'unipolar') {
        const norm = Math.max(0.03, Math.min(1, (val - spec.minVal) / Math.max(spec.maxVal - spec.minVal, 1e-6)));
        const bh = norm * sparkH;
        ctx.fillRect(bx, sparkY + sparkH - bh, barDrawW, bh);
      } else {
        const norm = Math.max(-1, Math.min(1, (val - spec.centerVal) / halfSpan));
        const bh = Math.max(1.5, Math.abs(norm) * (sparkH * 0.48));
        if (norm >= 0) {
          ctx.fillRect(bx, zeroY - bh, barDrawW, bh);
        } else {
          ctx.fillRect(bx, zeroY, barDrawW, bh);
        }
      }
    }
    ctx.globalAlpha = 1;

    // White playhead cursor line
    const cursorX = sparkX + ((clamped + 0.5) / count) * sparkW;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(1.3, 1.8 * s);
    ctx.beginPath();
    ctx.moveTo(cursorX, sparkY - 2);
    ctx.lineTo(cursorX, sparkY + sparkH + 2);
    ctx.stroke();

    // First, middle, last labels
    ctx.font = `400 ${axisFont}px "IBM Plex Mono", monospace`;
    ctx.fillStyle = '#8C94A0';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(timeLabels[0] || '', sparkX, axisY);
    if (count > 2) {
      ctx.textAlign = 'center';
      ctx.fillText(timeLabels[Math.floor(count / 2)] || '', sparkX + sparkW * 0.5, axisY);
    }
    ctx.textAlign = 'right';
    ctx.fillText(timeLabels[count - 1] || '', sparkX + sparkW, axisY);
  }

  // 8. Preview-only TikTok / Reels Safe Zone Guides (NEVER included in exports)
  if (showSafeZoneGuides && isReels916) {
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(245, 247, 250, 0.25)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(padX * 0.6, safeTop - 10, safeRightX - padX * 0.6, safeBottom - safeTop + 20);
    ctx.font = `500 ${Math.max(10, Math.round(12 * s))}px "IBM Plex Mono", monospace`;
    ctx.fillStyle = 'rgba(245, 247, 250, 0.5)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('SAFE ZONE · TIKTOK / IG REELS', padX * 0.6, safeTop - 14);
    ctx.restore();
  }

  ctx.restore();
}

function REGION_NAME_ID(id: ReliefRegionId): string {
  const map: Record<ReliefRegionId, string> = {
    indonesia: 'Indonesia',
    jawa: 'Jawa & Bali',
    jateng: 'Jateng & DIY',
    sumatera: 'Sumatera',
    ntt_bali: 'Bali & NTT',
    kalimantan: 'Kalimantan',
    sulawesi: 'Sulawesi',
  };
  return map[id];
}

function REGION_NAME_EN(id: ReliefRegionId): string {
  const map: Record<ReliefRegionId, string> = {
    indonesia: 'Indonesia',
    jawa: 'Java & Bali',
    jateng: 'Central Java & DIY',
    sumatera: 'Sumatra',
    ntt_bali: 'Bali & Nusa Tenggara',
    kalimantan: 'Kalimantan',
    sulawesi: 'Sulawesi',
  };
  return map[id];
}
