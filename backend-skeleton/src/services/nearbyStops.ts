// src/services/nearbyStops.ts
//
// Task Backend-11: gabungkan 4 sumber halte/stasiun jadi satu daftar
// "terdekat dari titik user" — murni proximity, bukan routing/perhitungan
// rute lewat moda-moda ini (batasan eksplisit task).
import { getAllOtpStops } from "../lib/otpClient";
import { LRT_STATIONS, MRT_STATIONS } from "../data/mrtLrtStations";

export type TransitMode = "transjakarta" | "jaklingko" | "mrt" | "lrt";

export interface NearbyStop {
  name: string;
  mode: TransitMode;
  distance_m: number;
  lat: number;
  lng: number;
}

// Haversine — jarak garis lurus, BUKAN jarak jalan kaki sesungguhnya, sesuai
// batasan eksplisit task ("jangan query rute jalan kaki ke tiap titik,
// terlalu berat untuk sekadar 'lihat yang deket'"). Rumus sama persis
// dengan yang sudah dipakai & diverifikasi di smartroute/src/app/
// navigate.tsx (Task App-13) — konsisten satu formula di seluruh proyek.
function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const EARTH_RADIUS_M = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Radius default kalau tidak diisi user — tengah rentang 1-2km yang
// disarankan task.
export const DEFAULT_RADIUS_M = 1500;

// Pengaman kalau area padat mikrotrans (prefix B — 7215 dari 7819 stop
// OTP2, lihat investigasi Task Backend-09) kebetulan punya puluhan titik
// dalam radius: tetap urut dari terdekat, tapi jangan kirim ratusan baris
// ke UI. Radius tetap jadi filter utama; ini cuma batas atas jaga-jaga.
const MAX_RESULTS = 30;

/**
 * @param lat/lng - titik user
 * @param radiusM - radius pencarian dalam meter (default DEFAULT_RADIUS_M)
 * @param maxResults - batas jumlah hasil (default MAX_RESULTS); Asisten AI
 *   butuh lebih banyak supaya MRT/LRT tidak tergusur titik JakLingko yang padat
 */
export async function findNearbyStops(
  lat: number,
  lng: number,
  radiusM: number = DEFAULT_RADIUS_M,
  maxResults: number = MAX_RESULTS
): Promise<NearbyStop[]> {
  const origin = { lat, lng };
  const results: NearbyStop[] = [];

  // 1 & 2: TransJakarta (prefix G) + JakLingko/mikrotrans (prefix B), dari
  // OTP2 — prefix persis temuan Task Backend-09's investigasi (G=590 halte
  // BRT, B=7215 titik mikrotrans, dari total 7819 stop yang dimuat).
  const otpStops = await getAllOtpStops();
  for (const stop of otpStops) {
    const rawId = stop.gtfsId.includes(":")
      ? stop.gtfsId.slice(stop.gtfsId.indexOf(":") + 1)
      : stop.gtfsId;
    let mode: TransitMode | null = null;
    if (rawId.startsWith("G")) mode = "transjakarta";
    else if (rawId.startsWith("B")) mode = "jaklingko";
    else continue; // prefix P/TEMP dkk — di luar 2 kategori yang diminta task

    const distance = haversineMeters(origin, { lat: stop.lat, lng: stop.lng });
    if (distance <= radiusM) {
      results.push({
        name: stop.name,
        mode,
        distance_m: Math.round(distance),
        lat: stop.lat,
        lng: stop.lng,
      });
    }
  }

  // 3 & 4: MRT + LRT, dari data statis (lihat data/mrtLrtStations.ts untuk
  // sumber & metode verifikasinya).
  for (const station of MRT_STATIONS) {
    const distance = haversineMeters(origin, { lat: station.lat, lng: station.lon });
    if (distance <= radiusM) {
      results.push({
        name: station.name,
        mode: "mrt",
        distance_m: Math.round(distance),
        lat: station.lat,
        lng: station.lon,
      });
    }
  }
  for (const station of LRT_STATIONS) {
    const distance = haversineMeters(origin, { lat: station.lat, lng: station.lon });
    if (distance <= radiusM) {
      results.push({
        name: station.name,
        mode: "lrt",
        distance_m: Math.round(distance),
        lat: station.lat,
        lng: station.lon,
      });
    }
  }

  results.sort((a, b) => a.distance_m - b.distance_m);
  return results.slice(0, maxResults);
}
