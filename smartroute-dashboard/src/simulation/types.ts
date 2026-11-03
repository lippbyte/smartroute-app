// Bentuk data simulasi. Modul ini murni: tanpa React, peta, atau DOM.

export type ModeKey = "mrt" | "lrt_jabodebek" | "krl" | "brt" | "bus" | "mikrotrans";

export interface PatternService {
  /** Senin (indeks 0) sampai Minggu (indeks 6). */
  days: boolean[];
  /** Keberangkatan pertama, menit sejak 00:00 WIB. */
  startMin: number;
  /** Batas keberangkatan terakhir (eksklusif), menit sejak 00:00 WIB. */
  endMin: number;
  headwayPeakMin: number;
  headwayOffMin: number;
  /** Jadwal nyata bila ada (GTFS rel). Bila ada, headway tidak dipakai. */
  departuresMin?: number[];
  /** Jendela frekuensi GTFS bila lebih dari satu: [mulai, selesai, headway] menit. */
  windows?: Array<[number, number, number]>;
}

export interface Pattern {
  id: string;
  routeId: string;
  mode: ModeKey;
  headsign: string;
  stopIds: string[];
  /** Jarak tiap halte dari awal jalur, meter, tidak pernah menurun. */
  stopDistM: number[];
  /** Geometri jalur, [lon, lat]. */
  shape: Array<[number, number]>;
  speedKmh: number;
  service: PatternService;
  timing?: string;
  geometry?: string;
}

export interface NetworkRoute {
  id: string;
  code: string;
  name: string;
  mode: ModeKey;
  category: string;
  color: string;
}

export interface NetworkStop {
  id: string;
  name: string;
  lon: number;
  lat: number;
}

export interface Network {
  version: { builtAt: string; feeds: Record<string, string>; osmExtract: string };
  routes: NetworkRoute[];
  stops: NetworkStop[];
  patterns: Pattern[];
}

/** Waktu simulasi WIB: hari (0 = Senin) dan detik sejak 00:00. */
export interface WibTime {
  dayIndex: number;
  secOfDay: number;
}

export type VehicleStatus = "berjalan" | "berhenti";

export interface Vehicle {
  id: string;
  routeId: string;
  patternId: string;
  mode: ModeKey;
  lon: number;
  lat: number;
  /** Arah hadap, derajat dari utara searah jarum jam. */
  bearing: number;
  status: VehicleStatus;
  /** null bila sudah di halte terakhir. */
  nextStopId: string | null;
  /** 0 di awal jalur, 1 di akhir jalur (berdasarkan jarak). */
  progress: number;
  /** Jarak yang sudah ditempuh pada trip berjalan, meter. */
  distanceM: number;
}
