import type { DroughtMonthlyPoint, DroughtRegionTimeseries } from '../types/drought';

export const COLAB_OFFICIAL_URL =
  'https://colab.research.google.com/github/gisrad/drought-in-control/blob/main/notebooks/drought_gee_analysis.ipynb';

export interface GeeQuotaInfo {
  actor_type: 'google' | 'trial';
  limit: number;
  used: number;
  remaining: number;
  cooldown_remaining_sec: number;
  reset_utc: string;
}

export interface GeeCachedPayload {
  kode_bps: string;
  nama: string;
  provinsi: string;
  climate_zone: 'monsunal' | 'ekuatorial' | 'lokal';
  source: 'GEE' | 'GEE_COLAB';
  cached_at?: string;
  generated_at?: string;
  series: DroughtMonthlyPoint[];
}

export function buildRegionColabNotebook(region: DroughtRegionTimeseries, monthsCount = 36): string {
  const safeKode = JSON.stringify(region.kode_bps);
  const safeNama = JSON.stringify(region.nama);
  const safeProv = JSON.stringify(region.provinsi);
  const lon = Number((region.centroid?.[0] ?? 110.25).toFixed(4));
  const lat = Number((region.centroid?.[1] ?? -7.52).toFixed(4));

  const nb = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      colab: {
        name: `Drought-GEE-${region.kode_bps}-${region.nama.replace(/[^A-Za-z0-9_-]+/g, '_')}.ipynb`,
        provenance: [],
      },
      kernelspec: { display_name: 'Python 3', name: 'python3' },
      language_info: { name: 'python' },
    },
    cells: [
      {
        cell_type: 'markdown',
        metadata: {},
        source: [
          `# Analisis GEE Wilayah ${region.nama} (BPS ${region.kode_bps})\n\n`,
          'Notebook ini otomatis terisi koordinat sentroid & kode BPS dari [`agri.transbulent.id/kekeringan/`](https://agri.transbulent.id/kekeringan/).\n\n',
          '- **Auto-Shutdown 3 Menit**: Runtime otomatis dimatikan (`runtime.unassign()`) setelah ekspor selesai atau idle >= 180 detik.\n',
          '- **Shared Cache Check**: Mengecek cache bersama terlebih dahulu agar tidak membuang kuota GEE.',
        ],
      },
      {
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          '#@title 1. Parameter Wilayah & Watchdog Auto-Shutdown 3 Menit\n',
          'import threading, time\n\n',
          `KODE_BPS = ${safeKode}  #@param {type:"string"}\n`,
          `NAMA_WILAYAH = ${safeNama}  #@param {type:"string"}\n`,
          `PROVINSI = ${safeProv}  #@param {type:"string"}\n`,
          `LAT = ${lat}  #@param {type:"number"}\n`,
          `LON = ${lon}  #@param {type:"number"}\n`,
          `MONTHS = ${monthsCount}  #@param {type:"integer"}\n`,
          'GEE_PROJECT_ID = ""  #@param {type:"string"}\n',
          'AUTO_SHUTDOWN_AFTER_EXPORT = True  #@param {type:"boolean"}\n',
          'IDLE_LIMIT_SEC = 180  #@param {type:"integer"}\n\n',
          '_LAST_ACTIVITY = [time.time()]\n',
          '_STOP_WATCHDOG = [False]\n',
          'def touch_activity(): _LAST_ACTIVITY[0] = time.time()\n',
          'def shutdown_colab_runtime(reason="Selesai"):\n',
          '    print(f"[AUTO-SHUTDOWN] Mematikan runtime Colab ({reason})...")\n',
          '    try:\n',
          '        from google.colab import runtime\n',
          '        runtime.unassign()\n',
          '    except Exception:\n',
          '        pass\n',
          'def _watchdog():\n',
          '    while not _STOP_WATCHDOG[0]:\n',
          '        time.sleep(10)\n',
          '        if time.time() - _LAST_ACTIVITY[0] >= IDLE_LIMIT_SEC:\n',
          '            shutdown_colab_runtime("idle >= 180s")\n',
          '            break\n',
          'threading.Thread(target=_watchdog, daemon=True).start()\n',
          'print(f"Siap: {NAMA_WILAYAH} (BPS {KODE_BPS}) @ ({LAT}, {LON})")',
        ],
      },
      {
        cell_type: 'code',
        execution_count: null,
        metadata: {},
        outputs: [],
        source: [
          '#@title 2. Ekstrak Satelit GEE + Ekspor JSON + Auto-Shutdown\n',
          'import json, math, urllib.request\n',
          'from datetime import datetime, timezone\n',
          'from statistics import mean, pstdev\n\n',
          'out_json = f"drought-gee-{KODE_BPS}.json"\n',
          'SHARED = None\n',
          'try:\n',
          '    req = urllib.request.Request(f"https://agri.transbulent.id/api/v1/gee/cache?kode={KODE_BPS}", headers={"User-Agent": "Colab-GEE/1.0"})\n',
          '    with urllib.request.urlopen(req, timeout=10) as r:\n',
          '        res = json.loads(r.read().decode("utf-8"))\n',
          '        if res.get("cached") and res.get("data"):\n',
          '            SHARED = res["data"]\n',
          '            print("[CACHE HIT] Menggunakan observasi Shared Cache (<14 hari).")\n',
          'except Exception:\n',
          '    pass\n\n',
          'try:\n',
          '    if SHARED is not None:\n',
          '        payload = SHARED\n',
          '    else:\n',
          '        import ee\n',
          '        ee.Authenticate()\n',
          '        ee.Initialize(project=GEE_PROJECT_ID.strip()) if GEE_PROJECT_ID.strip() else ee.Initialize()\n',
          '        roi = ee.Geometry.Point([float(LON), float(LAT)]).buffer(15000)\n',
          '        slope_stat = ee.Terrain.slope(ee.Image("USGS/SRTMGL1_003")).reduceRegion(ee.Reducer.mean(), roi, 90, maxPixels=1e8).getInfo()\n',
          '        mean_slope = round(float(slope_stat.get("slope") or 8.5), 2)\n',
          '        now_dt = datetime.now(timezone.utc)\n',
          '        ey, em = (now_dt.year - 1, 12) if now_dt.month == 1 else (now_dt.year, now_dt.month - 1)\n',
          '        ym_list = [(*divmod(ey * 12 + (em - 1) - i, 12),) for i in range(int(MONTHS) - 1, -1, -1)]\n',
          '        chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")\n',
          '        m_ndvi = ee.ImageCollection("MODIS/061/MOD13A2")\n',
          '        m_lst = ee.ImageCollection("MODIS/061/MOD11A2")\n',
          '        era5 = ee.ImageCollection("ECMWF/ERA5_LAND/MONTHLY_AGGR")\n',
          '        rains, ndvis, lsts, sms, yms = [], [], [], [], []\n',
          '        for yy, mm0 in ym_list:\n',
          '            touch_activity()\n',
          '            mm = mm0 + 1\n',
          '            yms.append(f"{yy:04d}-{mm:02d}")\n',
          '            s = ee.Date.fromYMD(yy, mm, 1)\n',
          '            e = s.advance(1, "month")\n',
          '            rv = chirps.filterDate(s, e).select("precipitation").sum().reduceRegion(ee.Reducer.mean(), roi, 5000).get("precipitation").getInfo()\n',
          '            nv = m_ndvi.filterDate(s, e).select("NDVI").mean().multiply(0.0001).reduceRegion(ee.Reducer.mean(), roi, 1000).get("NDVI").getInfo()\n',
          '            lv = m_lst.filterDate(s, e).select("LST_Day_1km").mean().multiply(0.02).subtract(273.15).reduceRegion(ee.Reducer.mean(), roi, 1000).get("LST_Day_1km").getInfo()\n',
          '            sv = era5.filterDate(s, e).select("volumetric_soil_water_layer_1").mean().reduceRegion(ee.Reducer.mean(), roi, 11132).get("volumetric_soil_water_layer_1").getInfo()\n',
          '            rains.append(float(rv if rv is not None else 140.0))\n',
          '            ndvis.append(float(nv if nv is not None else 0.58))\n',
          '            lsts.append(float(lv if lv is not None else 30.5))\n',
          '            sms.append(float(sv if sv is not None else 0.28))\n',
          '        roll3 = [math.log1p(sum(max(0.0, rains[j]) for j in range(max(0, i - 2), i + 1))) for i in range(len(rains))]\n',
          '        mr, sr = mean(roll3), max(pstdev(roll3), 1e-6)\n',
          '        spi3s = [round(max(-3.5, min(3.5, (v - mr) / sr)), 3) for v in roll3]\n',
          '        nd_lo, nd_hi = min(ndvis), max(ndvis)\n',
          '        ls_lo, ls_hi = min(lsts), max(lsts)\n',
          '        sm_mu, sm_sd = mean(sms), max(pstdev(sms), 1e-6)\n',
          '        series = []\n',
          '        for i, ym in enumerate(yms):\n',
          '            vci = max(0.0, min(100.0, ((ndvis[i] - nd_lo) / max(nd_hi - nd_lo, 1e-6)) * 100.0))\n',
          '            tci = max(0.0, min(100.0, ((ls_hi - lsts[i]) / max(ls_hi - ls_lo, 1e-6)) * 100.0))\n',
          '            vhi = round(0.5 * vci + 0.5 * tci, 2)\n',
          '            ssma = round(max(-3.5, min(3.5, (sms[i] - sm_mu) / sm_sd)), 3)\n',
          '            spi3 = spi3s[i]\n',
          '            base = 0.35 * ((100.0 - vhi) / 100.0) + 0.40 * max(0.0, min(1.0, -ssma / 3.0)) + 0.25 * max(0.0, min(1.0, -spi3 / 3.0))\n',
          '            pdlvi = round(max(0.0, min(1.0, base * (1.0 + 0.015 * max(0.0, min(30.0, mean_slope))))), 3)\n',
          '            st = "AWAS" if (pdlvi >= 0.65 or vhi < 26 or spi3 <= -1.9) else ("SIAGA" if (pdlvi >= 0.48 or vhi < 36 or spi3 <= -1.4) else ("WASPADA" if (pdlvi >= 0.32 or vhi < 46 or spi3 <= -0.95) else "NORMAL"))\n',
          '            series.append({"ym": ym, "spi3": spi3, "ssma": ssma, "vhi": vhi, "pdlvi": pdlvi, "status": st})\n',
          '        payload = {"kode_bps": KODE_BPS, "nama": NAMA_WILAYAH, "provinsi": PROVINSI, "source": "GEE_COLAB", "generated_at": datetime.now(timezone.utc).isoformat(), "series": series}\n',
          '    with open(out_json, "w", encoding="utf-8") as f:\n',
          '        json.dump(payload, f, ensure_ascii=False, indent=2)\n',
          '    print(f"Ekspor selesai: {out_json}")\n',
          '    try:\n',
          '        from google.colab import files\n',
          '        files.download(out_json)\n',
          '        time.sleep(12)\n',
          '    except Exception:\n',
          '        pass\n',
          'finally:\n',
          '    _STOP_WATCHDOG[0] = True\n',
          '    if AUTO_SHUTDOWN_AFTER_EXPORT:\n',
          '        shutdown_colab_runtime("ekspor selesai")',
        ],
      },
    ],
  };
  return JSON.stringify(nb, null, 2);
}

export function parseAndValidateGeeJson(text: string): { ok: true; payload: GeeCachedPayload } | { ok: false; error: string } {
  try {
    const raw = JSON.parse(text);
    const kode = String(raw?.kode_bps || '').trim();
    if (!/^\d{4}$/.test(kode)) return { ok: false, error: 'Field kode_bps (4 digit) tidak valid.' };
    if (!Array.isArray(raw?.series) || raw.series.length < 12 || raw.series.length > 60) {
      return { ok: false, error: 'Field series wajib berisi 12–60 observasi bulanan.' };
    }
    const cleanSeries: DroughtMonthlyPoint[] = [];
    for (const pt of raw.series) {
      const ym = String(pt?.ym || '').trim();
      const spi3 = Number(pt?.spi3);
      const ssma = Number(pt?.ssma);
      const vhi = Number(pt?.vhi);
      const pdlvi = Number(pt?.pdlvi);
      const status = String(pt?.status || 'normal') as DroughtMonthlyPoint['status'];
      if (!/^\d{4}-\d{2}$/.test(ym) || !Number.isFinite(spi3) || !Number.isFinite(ssma) || !Number.isFinite(vhi) || !Number.isFinite(pdlvi)) {
        return { ok: false, error: `Baris observasi tidak valid pada ${ym || '?'}.` };
      }
      cleanSeries.push({ ym, spi3, ssma, vhi, pdlvi, status });
    }
    return {
      ok: true,
      payload: {
        kode_bps: kode,
        nama: String(raw.nama || `Kabupaten ${kode}`),
        provinsi: String(raw.provinsi || ''),
        climate_zone: raw.climate_zone || 'monsunal',
        source: raw.source === 'GEE' ? 'GEE' : 'GEE_COLAB',
        generated_at: raw.generated_at,
        series: cleanSeries,
      },
    };
  } catch {
    return { ok: false, error: 'File JSON hasil GEE tidak dapat diparsing.' };
  }
}
