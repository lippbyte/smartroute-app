// src/type/index.ts

export interface Leg {
  mode: "KRL" | "MRT" | "TransJakarta" | "JakLingko" | "Walk" | string;
  service?: string;
  from: string;
  to: string;
  // Data navigasi dari backend (OTP2) — lihat RouteLeg di skema backend.
  // Optional: RouteItem lama (history/cache) tidak punya field ini.
  from_coord?: { lat: number; lng: number };
  to_coord?: { lat: number; lng: number };
  headsign?: string;
  path?: Array<[number, number]>; // [lat, lng]
  stops_passed?: Array<{ name: string; lat: number; lng: number }>;
  walk_steps?: Array<{
    distance_m: number;
    direction: string;
    street: string;
    lat?: number;
    lng?: number;
  }>;
  depart_at?: string;
  arrive_at?: string;
  distance_m?: number;
}

export interface CrowdInfo {
  current_level: "LOW" | "MEDIUM" | "HIGH";
  predicted_level: "LOW" | "MEDIUM" | "HIGH";
  // Optional sejak Task Integration-02: backend (Task Backend-04) hanya
  // mengirim satu level kualitatif ("low"/"moderate"/"high", worst-case
  // antar halte yang dilewati rute), tidak ada angka okupansi 0-100 —
  // current_level/predicted_level diisi dari nilai real yang sama itu,
  // predicted_occupancy dibiarkan undefined daripada ditebak.
  predicted_occupancy?: number; // 0-100
}

export interface ReliabilityInfo {
  score: number;
  // Optional: backend (Task Backend-05) hanya mengirim {score, risk}, tidak
  // ada angka delay_risk — tidak ada komponen UI yang membaca field ini
  // saat ini, dibiarkan optional daripada ditebak dari `risk` kualitatif.
  delay_risk?: number;
}

export interface RouteItem {
  route_id: string;
  rank: number;
  legs: Leg[];
  travel_time_minutes: number;
  cost_idr: number;
  transfers: number;
  walking_distance_m: number;
  // Optional sejak Task Integration-01, diperbarui di Task Integration-02:
  // backend (Task Backend-04) hanya mengisi crowd_level kalau ada laporan
  // kepadatan aktif untuk halte yang dilewati rute (15 menit terakhir) —
  // undefined di sini tetap berarti "data belum tersedia" untuk rute yang
  // memang belum ada laporannya, bukan bug. reliability & recommendation_score
  // dibiarkan optional juga (walau backend sekarang selalu mengisinya, lewat
  // Task Backend-05/06) supaya layar yang membuka RouteItem lama (mis. dari
  // cache/history) tidak crash kalau datanya tidak lengkap.
  // Lihat TEMPORARY SHIM di src/services/routeService.ts.
  crowd?: CrowdInfo;
  reliability?: ReliabilityInfo;
  comfort_score?: number;
  recommendation_score?: number;
  reason?: string[]; // Alasan rekomendasi
  // Task App-20: waktu berangkat yang BENAR-BENAR dipakai backend untuk
  // hitung jadwal (echo dari RouteRecommendation.departure_time) — bisa
  // waktu custom user atau "sekarang", ISO 8601 dengan offset. Ditaruh di
  // sini (bukan cuma di ApiResponse level atas) supaya ikut terbawa saat
  // satu RouteItem di-JSON.stringify ke route/[id].tsx & navigate.tsx
  // (yang tidak menerima ApiResponse penuh, cuma satu item).
  departure_time?: string;
}

export interface ApiResponse {
  request_id: string;
  timestamp: string;
  origin: { name: string; lat: number; lng: number };
  destination: { name: string; lat: number; lng: number };
  routes: RouteItem[];
  // Task App-20 — lihat catatan di RouteItem.departure_time.
  departure_time?: string;
  recommendation?: {
    route_id: string;
    rank: number;
    score: number;
    reason: string[];
  };
}

// Alias untuk kompatibilitas dengan kode lama jika perlu
export type routeOptionItem = RouteItem;
