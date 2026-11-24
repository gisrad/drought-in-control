export type BmkgClimateZone = 'monsunal' | 'ekuatorial' | 'lokal';

export const EKUATORIAL_PROVS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '19', '21', '61', '62', '63', '64', '65',
]);

export const LOKAL_PROVS = new Set([
  '71', '72', '75', '81', '82', '91', '92', '93', '94', '95', '96',
]);

export const CLIMATE_ZONE_META: Record<
  BmkgClimateZone,
  {
    label: string;
    short: string;
    regions: string;
    spiAwas: number;
    spiSiaga: number;
    pdlviAwas: number;
    note: string;
  }
> = {
  monsunal: {
    label: 'Zona Monsunal',
    short: 'MONSUNAL',
    regions: 'Jawa, Bali, NTB, NTT, Lampung–Sumsel, Sul-Sel',
    spiAwas: -2.0,
    spiSiaga: -1.5,
    pdlviAwas: 0.68,
    note: 'Satu puncak kemarau jelas (Mei–Okt); ambang defisit tegas per Aldrian & Susanto (2003) / BMKG.',
  },
  ekuatorial: {
    label: 'Zona Ekuatorial',
    short: 'EKUATORIAL',
    regions: 'Aceh–Jambi, Riau, Kepulauan Riau, Kalimantan',
    spiAwas: -1.75,
    spiSiaga: -1.25,
    pdlviAwas: 0.62,
    note: 'Dua puncak hujan ekuatorial; anomali defisit SPI-3 -1.75 sudah memicu stres vegetasi & gambut.',
  },
  lokal: {
    label: 'Zona Lokal',
    short: 'LOKAL',
    regions: 'Sulawesi Utara/Tengah/Gorontalo, Maluku, Papua',
    spiAwas: -1.85,
    spiSiaga: -1.35,
    pdlviAwas: 0.65,
    note: 'Pola hujan lokal dipengaruhi topografi & arus laut (Aldrian & Susanto, 2003); kalibrasi moderat.',
  },
};

export function getClimateZone(kodeBps: string): BmkgClimateZone {
  const prov = String(kodeBps || '').slice(0, 2);
  if (EKUATORIAL_PROVS.has(prov)) return 'ekuatorial';
  if (LOKAL_PROVS.has(prov)) return 'lokal';
  return 'monsunal';
}
