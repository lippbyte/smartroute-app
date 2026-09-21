// Tarif KRL Commuter per pasangan stasiun.
//
// Beda mendasar dari TransJakarta: TransJakarta satu tarif flat sekali
// tap-in (lihat routing.ts), KRL berbasis jarak — Bekasi->Jakarta Kota
// Rp4.000, Bogor->Jakarta Kota Rp6.000, Rangkasbitung->Tanah Abang
// Rp8.000. Jadi tarif leg KRL cuma bisa ditentukan dengan melihat pasangan
// stasiun yang benar-benar ditumpangi, bukan dikira-kira dari satu angka.
//
// Sumber: matriks tarif resmi KCI (fares_all.json, sync 2026-07-01) —
// dataset yang sama yang dipakai membangun GTFS KRL. Tabelnya di-generate
// oleh otp2-krl-experiment/scripts/build_krl_fare_table.py, bukan diketik
// manual.
import fareTable from "../data/krlFares.json";

const FARES: Record<string, number> = fareTable.fares;

/**
 * @param fromStationCode - kode stasiun KCI (mis. "BKS"), bukan gtfsId
 *   berprefiks feed. Pakai stationCodeFromGtfsId() untuk mengubahnya.
 * @returns tarif dalam rupiah, atau undefined kalau pasangannya tidak ada
 *   di matriks resmi — JANGAN diganti angka default, karena menebak tarif
 *   lebih menyesatkan daripada tidak menampilkan angka sama sekali.
 */
export function getKrlFare(
  fromStationCode: string,
  toStationCode: string,
): number | undefined {
  if (fromStationCode === toStationCode) return undefined;
  // Matriks menyimpan satu arah per pasangan (tarif simetris by jarak).
  return (
    FARES[`${fromStationCode}|${toStationCode}`] ??
    FARES[`${toStationCode}|${fromStationCode}`]
  );
}

/** "2:BKS" -> "BKS". OTP2 memberi gtfsId berprefiks id feed. */
export function stationCodeFromGtfsId(gtfsId: string): string {
  const idx = gtfsId.indexOf(":");
  return idx === -1 ? gtfsId : gtfsId.slice(idx + 1);
}
