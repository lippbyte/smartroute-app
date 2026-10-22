// src/services/allStops.ts
//
// Perluasan dari Task App-15 (diminta user langsung, bukan dari task file
// tertulis): SEMUA halte/stasiun 4 moda se-Jakarta, TANPA filter jarak —
// beda dari findNearbyStops() (services/nearbyStops.ts) yang selalu
// menyaring ke radius tertentu dari satu titik. Dipakai untuk peta
// "semua halte" (bisa ribuan titik, terutama JakLingko), bukan untuk
// "halte terdekat dari saya".
import { getAllOtpStops } from "../lib/otpClient";
import { LRT_STATIONS, MRT_STATIONS } from "../data/mrtLrtStations";
import { TransitMode } from "./nearbyStops";

export interface TransitStop {
  name: string;
  mode: TransitMode;
  lat: number;
  lng: number;
}

export const ALL_MODES: TransitMode[] = [
  "transjakarta",
  "jaklingko",
  "mrt",
  "lrt",
];

/**
 * @param modes - moda yang ingin disertakan. Default semua 4 (peta
 *   "semua halte"). Filter di sini, BUKAN di frontend, supaya kalau cuma
 *   butuh mrt+lrt misalnya, OTP2 tidak usah sama sekali disentuh
 *   (getAllOtpStops() cuma dipanggil kalau transjakarta atau jaklingko ada
 *   di daftar yang diminta) — payload & waktu respons proporsional dengan
 *   yang benar-benar diminta.
 */
export async function findAllStops(
  modes: TransitMode[] = ALL_MODES,
): Promise<TransitStop[]> {
  const wanted = new Set(modes);
  const results: TransitStop[] = [];

  if (wanted.has("transjakarta") || wanted.has("jaklingko")) {
    const otpStops = await getAllOtpStops();
    for (const stop of otpStops) {
      const rawId = stop.gtfsId.includes(":")
        ? stop.gtfsId.slice(stop.gtfsId.indexOf(":") + 1)
        : stop.gtfsId;
      let mode: TransitMode | null = null;
      if (rawId.startsWith("G")) mode = "transjakarta";
      else if (rawId.startsWith("B")) mode = "jaklingko";
      else continue;
      if (!wanted.has(mode)) continue;

      results.push({ name: stop.name, mode, lat: stop.lat, lng: stop.lng });
    }
  }

  if (wanted.has("mrt")) {
    for (const station of MRT_STATIONS) {
      results.push({ name: station.name, mode: "mrt", lat: station.lat, lng: station.lon });
    }
  }

  if (wanted.has("lrt")) {
    for (const station of LRT_STATIONS) {
      results.push({ name: station.name, mode: "lrt", lat: station.lat, lng: station.lon });
    }
  }

  return results;
}
