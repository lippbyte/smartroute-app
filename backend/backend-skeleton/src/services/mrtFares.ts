// Tarif MRT Jakarta per pasangan stasiun — berbasis jarak, seperti KRL (lihat
// krlFares.ts), bukan flat seperti TransJakarta.
//
// Tabelnya di-generate oleh otp2-krl-experiment/scripts/build_mrt_gtfs.py dari
// feed GTFS MRT yang sama dengan yang dimuat OTP2, termasuk override hasil
// verifikasi manual (mrt_fare_overrides.json). STATUS: TODO verifikasi — angka
// dasarnya dari sumber sekunder, belum dari jakartamrt.co.id.
import fareTable from "../data/mrtFares.json";

const FARES: Record<string, number> = fareTable.fares;

/**
 * @param fromStopId - stop_id MRT tanpa prefiks feed (mis. "MRT-LBB"). Pakai
 *   stationCodeFromGtfsId() dari krlFares.ts untuk membuang prefiks "3:".
 * @returns tarif rupiah, atau undefined kalau pasangannya tidak ada di tabel —
 *   JANGAN diganti angka default, sama alasannya dengan getKrlFare.
 */
export function getMrtFare(fromStopId: string, toStopId: string): number | undefined {
  if (fromStopId === toStopId) return undefined;
  return FARES[`${fromStopId}|${toStopId}`];
}
