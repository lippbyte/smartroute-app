// Kontrak skema resmi untuk seluruh service routing engine.
// Final untuk MVP — service selanjutnya (Backend-02, 03, 04, 05) WAJIB mengikuti ini,
// bukan draft yang boleh diubah bebas.

export interface RouteLeg {
  // "RAIL" ditambahkan saat integrasi KRL (Track 1 sprint H10-14): OTP2
  // mengembalikan mode "RAIL" untuk leg KRL Commuter. Sebelum ini enum-nya
  // cuma WALK|BUS, jadi setiap itinerary yang menyentuh KRL ditolak
  // validasi skema dan berubah jadi HTTP 500 di routes.ts — bukan cuma
  // salah label, tapi rutenya hilang sama sekali.
  mode: "WALK" | "BUS" | "RAIL";
  route_name?: string;
  from: string;
  to: string;
}

export interface RouteCandidate {
  route_id: string;
  legs: RouteLeg[];
  // rentang, bukan angka tunggal — ini pembeda utama dari Google Maps
  travel_time_minutes: { min: number; max: number };
  transfer_count: number;
  walking_distance_m: number;
  cost_idr: number;
  // diisi Task Backend-04, kosong dulu di sini
  crowd_level?: "low" | "moderate" | "high";
  // diisi Task Backend-05, kosong dulu di sini
  reliability?: { score: number; risk: "low" | "medium" | "high" };
  // diisi Task Backend-06: skor gabungan (waktu, biaya, kepadatan,
  // reliabilitas) dipakai frontend buat ranking. Selalu terisi (beda dari
  // crowd_level/reliability di atas) karena rumusnya sudah punya nilai
  // netral untuk tiap komponen yang datanya belum ada.
  recommendation_score: number;
}

export interface RouteRecommendation {
  request_id: string;
  origin: { name: string; lat: number; lng: number };
  destination: { name: string; lat: number; lng: number };
  routes: RouteCandidate[]; // urut dari yang paling relevan
  // Waktu keberangkatan yang benar-benar dipakai untuk pencarian ini — dari
  // request.departure_time kalau diisi, atau "sekarang" saat request masuk
  // kalau tidak. Ditambahkan Task Backend-03c: hasil rute time-of-day
  // sensitive (jadwal TransJakarta sungguhan), field ini yang mencatat jam
  // berapa suatu hasil rute berlaku, untuk rehearsal/demo yang bisa diulang.
  departure_time: string; // ISO 8601
  generated_at: string; // ISO 8601
}
