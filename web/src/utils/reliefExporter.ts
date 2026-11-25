import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import type { DroughtIndexKey } from '../types/drought';
import type { PinFieldEngine } from './pinFieldEngine';
import {
  ASPECT_DIMS,
  REGION_PRESETS,
  type AnchorCity,
  type AspectPreset,
  type CameraPose,
  type ReliefLocale,
  type ReliefRegionId,
} from './pinFieldConfig';
import { renderReliefCompositeFrame } from './reliefHudRenderer';

export interface ExportCommonOptions {
  engine: PinFieldEngine;
  shaderFrames: Float32Array[];
  regionId: ReliefRegionId;
  metric: DroughtIndexKey;
  locale: ReliefLocale;
  aspect: Exclude<AspectPreset, 'auto'>;
  timeLabels: string[];
  meanSeries: number[];
  spacingKm: number;
  isSimulated: boolean;
  sourceLabel: string;
  anchors: AnchorCity[];
  cadence?: 'monthly' | 'annual_spi12';
  customTitle?: string;
  customSubtitle?: string;
  climateZoneLabel?: string;
  basePose: CameraPose;
}

export interface VideoExportOptions extends ExportCommonOptions {
  durationSec: number;
  fps: 30 | 60;
  hookMode: boolean;
  autoPan: boolean;
  onProgress?: (pct: number, label: string) => void;
  signal?: AbortSignal;
}

function buildTimelineFrames(
  timeCount: number,
  meanSeries: number[],
  metric: DroughtIndexKey,
  totalFrames: number,
  fps: number,
  hookMode: boolean
): number[] {
  const maxT = Math.max(0, timeCount - 1);
  if (maxT === 0) return new Array(totalFrames).fill(0);

  let peakIdx = 0;
  if (meanSeries.length === timeCount) {
    for (let i = 1; i < timeCount; i++) {
      if (metric === 'pdlvi') {
        if (meanSeries[i] > meanSeries[peakIdx]) peakIdx = i;
      } else {
        if (meanSeries[i] < meanSeries[peakIdx]) peakIdx = i;
      }
    }
  }

  const endHoldFrames = Math.round(fps * 1.2);
  const out: number[] = [];

  if (hookMode) {
    const hookHoldFrames = Math.round(fps * 1.35);
    const rewindFrames = Math.round(fps * 0.65);
    const sweepFrames = Math.max(10, totalFrames - hookHoldFrames - rewindFrames - endHoldFrames);

    for (let f = 0; f < totalFrames; f++) {
      if (f < hookHoldFrames) {
        out.push(peakIdx);
      } else if (f < hookHoldFrames + rewindFrames) {
        const u = (f - hookHoldFrames) / Math.max(1, rewindFrames - 1);
        const eased = u * u * (3 - 2 * u);
        out.push(peakIdx * (1 - eased));
      } else if (f < hookHoldFrames + rewindFrames + sweepFrames) {
        const u = (f - hookHoldFrames - rewindFrames) / Math.max(1, sweepFrames - 1);
        out.push(u * maxT);
      } else {
        out.push(maxT);
      }
    }
    return out;
  }

  const introHold = Math.round(fps * 0.45);
  const sweepFrames = Math.max(10, totalFrames - introHold - endHoldFrames);
  for (let f = 0; f < totalFrames; f++) {
    if (f < introHold) {
      out.push(0);
    } else if (f < introHold + sweepFrames) {
      const u = (f - introHold) / Math.max(1, sweepFrames - 1);
      out.push(u * maxT);
    } else {
      out.push(maxT);
    }
  }
  return out;
}

function triggerBlobDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function exportReliefPosterPng(
  opts: ExportCommonOptions & { frameFloat: number }
): Promise<void> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    await (document as any).fonts.ready;
  }
  const dim = ASPECT_DIMS[opts.aspect];
  const outW = dim.w * 2;
  const outH = dim.h * 2;

  const prevW = opts.engine.domElement.width;
  const prevH = opts.engine.domElement.height;
  const prevPose = opts.engine.getCameraPose();

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Gagal membuat kanvas ekspor PNG.');

  try {
    opts.engine.resize(outW, outH);
    opts.engine.setCameraPose(opts.basePose);

    const maxT = Math.max(0, opts.shaderFrames.length - 1);
    const clamped = Math.max(0, Math.min(maxT, opts.frameFloat));
    const i0 = Math.floor(clamped);
    const i1 = Math.min(maxT, i0 + 1);
    opts.engine.setValues(opts.shaderFrames[i0], opts.shaderFrames[i1], clamped - i0);
    opts.engine.render();

    renderReliefCompositeFrame({
      ctx,
      width: outW,
      height: outH,
      engine: opts.engine,
      regionId: opts.regionId,
      metric: opts.metric,
      locale: opts.locale,
      aspect: opts.aspect,
      timeLabels: opts.timeLabels,
      meanSeries: opts.meanSeries,
      frameFloat: clamped,
      spacingKm: opts.spacingKm,
      isSimulated: opts.isSimulated,
      sourceLabel: opts.sourceLabel,
      anchors: opts.anchors,
      cadence: opts.cadence,
      customTitle: opts.customTitle,
      customSubtitle: opts.customSubtitle,
      showSafeZoneGuides: false,
      climateZoneLabel: opts.climateZoneLabel,
    });

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Browser gagal menghasilkan PNG.');
    const ym = opts.timeLabels[Math.round(clamped)] || 'frame';
    triggerBlobDownload(`relief-${opts.regionId}-${opts.metric}-${ym}-${opts.aspect}.png`, blob);
  } finally {
    opts.engine.resize(prevW, prevH);
    opts.engine.setCameraPose(prevPose);
    opts.engine.render();
  }
}

async function pickSupportedAvcCodec(width: number, height: number, fps: number): Promise<string | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;
  const candidates = ['avc1.64002a', 'avc1.4d002a', 'avc1.420028', 'avc1.42E01E'];
  for (const codec of candidates) {
    try {
      const sup = await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        bitrate: 10_000_000,
        framerate: fps,
      });
      if (sup.supported) return codec;
    } catch {
      // try next profile
    }
  }
  return null;
}

export async function exportReliefVideo(opts: VideoExportOptions): Promise<{ format: 'mp4' | 'webm' }> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    await (document as any).fonts.ready;
  }

  const dim = ASPECT_DIMS[opts.aspect];
  // H.264 requires even dimensions
  const outW = dim.w % 2 === 0 ? dim.w : dim.w - 1;
  const outH = dim.h % 2 === 0 ? dim.h : dim.h - 1;
  const totalFrames = Math.max(30, Math.round(opts.durationSec * opts.fps));
  const timeline = buildTimelineFrames(
    opts.shaderFrames.length,
    opts.meanSeries,
    opts.metric,
    totalFrames,
    opts.fps,
    opts.hookMode
  );

  const prevW = opts.engine.domElement.width;
  const prevH = opts.engine.domElement.height;
  const prevPose = opts.engine.getCameraPose();

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Gagal membuat kanvas video.');

  const codec = await pickSupportedAvcCodec(outW, outH, opts.fps);

  const renderStep = (fIdx: number) => {
    const frameFloat = timeline[fIdx];
    const maxT = Math.max(0, opts.shaderFrames.length - 1);
    const i0 = Math.floor(frameFloat);
    const i1 = Math.min(maxT, i0 + 1);

    if (opts.autoPan && opts.regionId === 'indonesia' && opts.aspect === '9x16') {
      const u = fIdx / Math.max(1, totalFrames - 1);
      const panX = -0.44 + u * 0.86;
      opts.engine.setCameraPose({ ...opts.basePose, offsetX: panX });
    } else {
      opts.engine.setCameraPose(opts.basePose);
    }

    opts.engine.setValues(opts.shaderFrames[i0], opts.shaderFrames[i1], frameFloat - i0);
    opts.engine.render();

    renderReliefCompositeFrame({
      ctx,
      width: outW,
      height: outH,
      engine: opts.engine,
      regionId: opts.regionId,
      metric: opts.metric,
      locale: opts.locale,
      aspect: opts.aspect,
      timeLabels: opts.timeLabels,
      meanSeries: opts.meanSeries,
      frameFloat,
      spacingKm: opts.spacingKm,
      isSimulated: opts.isSimulated,
      sourceLabel: opts.sourceLabel,
      anchors: opts.anchors,
      cadence: opts.cadence,
      customTitle: opts.customTitle,
      customSubtitle: opts.customSubtitle,
      showSafeZoneGuides: false,
      climateZoneLabel: opts.climateZoneLabel,
    });
  };

  try {
    opts.engine.resize(outW, outH);

    if (codec) {
      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: {
          codec: 'avc',
          width: outW,
          height: outH,
          frameRate: opts.fps,
        },
        fastStart: 'in-memory',
      });

      let encoderErr: unknown = null;
      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (err) => {
          encoderErr = err;
        },
      });

      encoder.configure({
        codec,
        width: outW,
        height: outH,
        bitrate: 10_000_000,
        framerate: opts.fps,
      });

      const frameDurationUs = Math.round(1_000_000 / opts.fps);
      for (let f = 0; f < totalFrames; f++) {
        if (opts.signal?.aborted) {
          encoder.close();
          throw new Error('Ekspor video dibatalkan.');
        }
        if (encoderErr) throw encoderErr;

        renderStep(f);
        const vf = new VideoFrame(canvas, {
          timestamp: f * frameDurationUs,
          duration: frameDurationUs,
        });
        encoder.encode(vf, { keyFrame: f % opts.fps === 0 });
        vf.close();

        if (encoder.encodeQueueSize > 8) {
          await encoder.flush();
        }
        if (f % 4 === 0 || f === totalFrames - 1) {
          opts.onProgress?.(Math.round(((f + 1) / totalFrames) * 95), `Merender frame ${f + 1}/${totalFrames}...`);
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      opts.onProgress?.(97, 'Menyusun kontainer MP4...');
      await encoder.flush();
      encoder.close();
      muxer.finalize();

      const blob = new Blob([target.buffer], { type: 'video/mp4' });
      const fileSlug = `${REGION_PRESETS[opts.regionId].id}-${opts.metric}-${opts.aspect}`;
      triggerBlobDownload(`relief-${fileSlug}.mp4`, blob);
      opts.onProgress?.(100, 'Selesai (.mp4)');
      return { format: 'mp4' };
    }

    // Fallback: MediaRecorder WebM
    const stream = canvas.captureStream(opts.fps);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const chunks: BlobPart[] = [];
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    rec.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunks.push(ev.data);
    };

    const donePromise = new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });
    rec.start();

    const stepMs = 1000 / opts.fps;
    for (let f = 0; f < totalFrames; f++) {
      if (opts.signal?.aborted) {
        rec.stop();
        throw new Error('Ekspor video dibatalkan.');
      }
      renderStep(f);
      if (f % 3 === 0 || f === totalFrames - 1) {
        opts.onProgress?.(Math.round(((f + 1) / totalFrames) * 96), `Merekam WebM ${f + 1}/${totalFrames}...`);
      }
      await new Promise((r) => setTimeout(r, stepMs));
    }
    rec.stop();
    const webmBlob = await donePromise;
    triggerBlobDownload(`relief-${opts.regionId}-${opts.metric}-${opts.aspect}.webm`, webmBlob);
    opts.onProgress?.(100, 'Selesai (.webm)');
    return { format: 'webm' };
  } finally {
    opts.engine.resize(prevW, prevH);
    opts.engine.setCameraPose(prevPose);
    opts.engine.render();
  }
}
