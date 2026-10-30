// Kontrak skema resmi untuk seluruh service routing engine.
// Final untuk MVP — service selanjutnya (Backend-02, 03, 04, 05) WAJIB mengikuti ini,
// bukan draft yang boleh diubah bebas.

export interface RouteLeg {
  // "RAIL" ditambahkan saat integrasi KRL (Track 1 sprint H10-14): OTP2
  // mengembalikan mode "RAIL" untuk leg KRL Commuter. Sebelum ini enum-nya
  // cuma WALK|BUS, jadi setiap itinerary yang menyentuh KRL ditolak
  // validasi skema dan berubah jadi HTTP 500 di routes.ts — bukan cuma
  // salah label, tapi rutenya hilang sama sekali.
  //
  // "SUBWAY" ditambahkan saat MRT masuk graph, untuk alasan yang persis sama:
  // OTP2 mengirim mode SUBWAY untuk feed dengan route_type=1.
  //
  // "TRAM" = LRT Jabodebek: feed-nya route_type=0 ("Tram, Streetcar, Light
  // rail" di GTFS) dan OTP2 memetakan route_type 0 ke mode TRAM.
  mode: "WALK" | "BUS" | "RAIL" | "SUBWAY" | "TRAM";
  route_name?: string;
  // Hanya leg BUS: kategori resmi `route_desc` dari feed TransJakarta
  // ("BRT", "Mikrotrans", "Angkutan Umum Integrasi", ...). Satu feed BUS
  // menaungi BRT, feeder, dan JakLingko sekaligus — tanpa field ini
  // frontend tidak bisa membedakannya dan semuanya tampil "TransJakarta".
  route_category?: string;
  from: string;
  to: string;
  // Data navigasi (ditambahkan untuk UX ala Google Maps). Sebelumnya layar
  // navigasi mencari ulang NAMA halte ke Nominatim dan menggambar garis bus
  // dengan router mobil umum — posisinya bisa melenceng dari halte asli.
  // Semua ini dari OTP2 langsung, sama dengan yang dipakai merutekan.
  from_coord?: { lat: number; lng: number };
  to_coord?: { lat: number; lng: number };
  // Arah kendaraan, mis. "Lebak Bulus" untuk MRT arah Lebak Bulus.
  headsign?: string;
  // Bentuk jalur leg, [lat, lng] berurutan. Bus mengikuti shapes GTFS.
  path?: Array<[number, number]>;
  // Halte/stasiun yang DILEWATI di antara titik naik dan turun (leg transit).
  stops_passed?: Array<{ name: string; lat: number; lng: number }>;
  // Belokan untuk leg jalan kaki: arah relatif OTP2 (LEFT, RIGHT, CONTINUE,
  // DEPART, ...) + nama jalan.
  walk_steps?: Array<{
    distance_m: number;
    direction: string;
    street: string;
    lat: number; // titik awal belokan
    lng: number;
  }>;
  depart_at?: string; // ISO, WIB
  arrive_at?: string; // ISO, WIB
  distance_m?: number;
}

export interface RouteCandidate {
  route_id: string;
  legs: RouteLeg[];
  // rentang, bukan angka tunggal — ini pembeda utama dari Google Maps
  travel_time_minutes: { min: number; max: number };
  transfer_count: number;
  walking_distance_m: number;
  cost_idr: number;
  // Hari 3 Task 3 (ADDITIVE): rincian cost_idr per segmen bergerbang (satu
  // tap-in), dari perhitungan yang sama — dipakai layar Trip Pass. Jumlah
  // fare_idr yang bukan null = cost_idr.
  fare_breakdown?: Array<{
    operator: "TransJakarta" | "KRL" | "MRT" | "LRT";
    label: string;
    fare_idr: number | null;
    leg_indexes: number[];
    from_name?: string;
    to_name?: string;
    note?: string;
  }>;
  // diisi Task Backend-04, kosong dulu di sini
  crowd_level?: "low" | "moderate" | "high";
  // diisi Task Backend-05, kosong dulu di sini
  reliability?: { score: number; risk: "low" | "medium" | "high" };
  // diisi Task Backend-06: skor gabungan (waktu, biaya, kepadatan,
  // reliabilitas) dipakai frontend buat ranking. Selalu terisi (beda dari
  // crowd_level/reliability di atas) karena rumusnya sudah punya nilai
  // netral untuk tiap komponen yang datanya belum ada.
  recommendation_score: number;
  // Hari 2 Task 1: estimasi CO₂ (ADDITIVE, semua opsional) — lihat
  // services/emissionFactors.ts untuk faktor & sumbernya. Gram, dibulatkan
  // ke puluhan. Tidak dipakai untuk skor atau urutan.
  co2_estimate_g?: number;
  co2_by_mode?: Partial<Record<RouteLeg["mode"], number>>;
  co2_car_g?: number;
  co2_motorcycle_g?: number;
  // Jarak proksi pembanding mobil/motor = jumlah jarak semua leg (m).
  co2_comparator_distance_m?: number;
  co2_basis?: "estimasi";
  co2_factors_version?: string;
  // Hari 3 Task 1: info aksesibilitas kursi roda (opt-in, ADDITIVE) — lihat
  // services/accessibility.ts. Hanya ada bila request mengirim
  // accessibility: ["kursi_roda"]. Tidak dipakai untuk skor atau urutan.
  accessibility_confidence?: "tinggi" | "sedang" | "rendah" | "tidak_diketahui";
  accessibility_summary?: string;
  accessibility_points?: Array<{
    stop_id: string | null;
    name: string;
    role: "naik" | "turun" | "transfer";
    mode: string;
    status: "bisa" | "tidak_bisa" | "tidak_diketahui";
  }>;
  accessibility_trip_data?: "lengkap" | "sebagian" | "tidak_ada";
  accessibility_basis?: "data_gtfs";
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
