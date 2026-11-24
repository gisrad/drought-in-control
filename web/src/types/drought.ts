export type DroughtIndexKey = 'spi3' | 'ssma' | 'vhi' | 'pdlvi';

export type DroughtStatus = 'normal' | 'waspada' | 'moderat' | 'parah' | 'ekstrem';

export interface DroughtMonthlyPoint {
  ym: string;
  spi3: number;
  ssma: number;
  vhi: number;
  pdlvi: number;
  status: DroughtStatus;
}

export interface DroughtRegionTimeseries {
  kode_bps: string;
  nama: string;
  provinsi: string;
  das: string;
  centroid: [number, number];
  mean_slope_deg: number;
  updated_at: string;
  series: DroughtMonthlyPoint[];
  executive_brief_id: string;
  linked_panen_field_id?: string;
}

export interface DroughtDataset {
  is_simulated: boolean;
  generated_at: string;
  months: string[];
  regions: Record<string, DroughtRegionTimeseries>;
}
