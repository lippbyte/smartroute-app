// src/services/tripService.ts
//
// Hari 1 Task 5/6: riwayat perjalanan & penilaian (wajib masuk). Bentuk data
// dicerminkan manual dari backend (backend-skeleton/src/services/trips.ts).
// Tamu TIDAK memanggil service ini — layar menampilkan ajakan masuk.
import type { RouteItem } from "@/type";
import { apiRequest } from "./apiClient";

export type DurationBasis = "aktual" | "estimasi";

export interface TripRating {
  stars: number;
  eta_accurate: boolean | null;
  transfer_risk_accurate: boolean | null;
  crowd_accurate: boolean | null;
  message: string | null;
  created_at: string;
}

export interface TripLegSummary {
  mode: string;
  service?: string;
  from: string;
  to: string;
}

export interface Trip {
  id: string;
  created_at: string;
  origin_label: string;
  destination_label: string;
  route_summary: { legs: TripLegSummary[]; transfers: number; walking_distance_m: number };
  predicted_min_range: { min: number; max: number } | null;
  actual_duration_min: number | null;
  duration_basis: DurationBasis;
  fare_total: number;
  co2_estimate_g: number | null; // diisi Hari 2 — sampai itu selalu null
  rating: TripRating | null;
}

export interface TripInput {
  client_ref: string;
  origin_label: string;
  destination_label: string;
  route_summary: Trip["route_summary"];
  predicted_min_range: Trip["predicted_min_range"];
  actual_duration_min: number | null;
  duration_basis: DurationBasis;
  fare_total: number;
}

export interface RatingInput {
  stars: number;
  eta_accurate: boolean | null;
  transfer_risk_accurate: boolean | null;
  crowd_accurate: boolean | null;
  message: string | null;
}

/** Pengenal satu sesi navigasi. Dikirim ulang apa adanya saat "Coba lagi",
 *  jadi backend mengembalikan entri yang sama (tidak ada riwayat dobel). */
export function newClientRef(): string {
  return `nav-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * Payload riwayat dari rute yang dinavigasi. Durasi "aktual" HANYA bila
 * navigasi selesai lewat trigger kedatangan 75 m (actualMinutes != null);
 * selesai lewat tombol manual = "estimasi". Tarif apa adanya dari backend
 * (cost_idr), tidak dihitung ulang.
 */
export function buildTripInput(args: {
  clientRef: string;
  route: RouteItem;
  originLabel: string;
  destinationLabel: string;
  actualMinutes: number | null;
}): TripInput {
  const { clientRef, route, originLabel, destinationLabel, actualMinutes } = args;
  const range = route.travel_time_range;
  return {
    client_ref: clientRef,
    origin_label: clip(originLabel.trim() || route.legs[0]?.from || "Asal", 200),
    destination_label: clip(destinationLabel.trim() || route.legs.at(-1)?.to || "Tujuan", 200),
    route_summary: {
      legs: route.legs.slice(0, 20).map((l) => ({
        mode: clip(l.mode, 30),
        ...(l.service ? { service: clip(l.service, 80) } : {}),
        from: clip(l.from, 200),
        to: clip(l.to, 200),
      })),
      transfers: route.transfers,
      walking_distance_m: Math.round(route.walking_distance_m),
    },
    // Bulatkan ke menit utuh (kontrak backend: bilangan bulat) — bukan
    // menghitung ulang prediksinya.
    predicted_min_range: range ? { min: Math.round(range.min), max: Math.round(range.max) } : null,
    actual_duration_min: actualMinutes,
    duration_basis: actualMinutes !== null ? "aktual" : "estimasi",
    fare_total: Math.round(route.cost_idr),
  };
}

export function createTrip(token: string, input: TripInput): Promise<Trip> {
  return apiRequest("POST", "/trips", {
    token,
    body: input,
    timeoutMessage: "Menyimpan perjalanan terlalu lama menunggu server. Coba lagi.",
  });
}

export function listTrips(token: string): Promise<Trip[]> {
  return apiRequest("GET", "/trips", { token, timeoutMessage: "Memuat riwayat terlalu lama. Coba lagi." });
}

export function getTrip(token: string, id: string): Promise<Trip> {
  return apiRequest("GET", `/trips/${encodeURIComponent(id)}`, {
    token,
    timeoutMessage: "Memuat perjalanan terlalu lama. Coba lagi.",
  });
}

export function rateTrip(token: string, id: string, input: RatingInput): Promise<Trip> {
  return apiRequest("POST", `/trips/${encodeURIComponent(id)}/rating`, {
    token,
    body: input,
    timeoutMessage: "Mengirim penilaian terlalu lama menunggu server. Draf Anda tetap tersimpan.",
  });
}
