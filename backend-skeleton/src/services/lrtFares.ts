// Tarif LRT Jabodebek per pasangan stasiun — dari tiga matriks resmi
// lrtjabodebek.kai.id/informasi-tarif (snapshot di
// otp2-krl-experiment/data/lrt_source/), di-generate oleh
// otp2-krl-experiment/scripts/build_lrt_gtfs.py, bukan diketik manual.
//
// Beda dari KRL/MRT: tarifnya bergantung JAM. Jam sibuk (06:00-08:59 dan
// 16:00-19:59) plafonnya Rp20.000; di luar jam sibuk dan Sabtu/Minggu/libur
// plafonnya Rp10.000 (dua matriks itu identik). Kata situs resmi: "Tarif jam
// sibuk tidak berlaku khusus untuk Sabtu, Minggu & Hari Libur."
//
// TODO: verifikasi — tanggal libur nasional belum dikenali; hari kerja yang
// jatuh pada libur nasional masih dihitung tarif jam sibuk.
import fareTable from "../data/lrtFares.json";

const PEAK: Record<string, number> = fareTable.peak;
const OFFPEAK: Record<string, number> = fareTable.offpeak;

// Menit-sejak-tengah-malam WIB, [mulai, akhir] inklusif, dari halaman resmi.
const PEAK_WINDOWS: Array<[number, number]> = [
  [6 * 60, 8 * 60 + 59],
  [16 * 60, 19 * 60 + 59],
];

/** "2026-09-22T07:37:00+07:00" -> apakah jam sibuk hari kerja. */
export function isLrtPeak(boardingIso: string): boolean {
  // Waktu OTP2 sudah dalam WIB (+07:00); tanggal & jam dibaca apa adanya
  // dari string supaya zona waktu mesin server tidak ikut campur.
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(boardingIso);
  if (!m) return false;
  const weekday = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  const minutes = +m[4] * 60 + +m[5];
  return PEAK_WINDOWS.some(([a, b]) => minutes >= a && minutes <= b);
}

/**
 * @param fromStopId/toStopId - stop_id LRT tanpa prefiks feed (mis. "LRT_DKA").
 * @param boardingIso - jam naik di stasiun asal (OTP2 leg.start.scheduledTime).
 *   Tanpa jam naik, tarif tidak bisa ditentukan dengan benar — dikembalikan
 *   undefined, bukan ditebak.
 */
export function getLrtFare(
  fromStopId: string,
  toStopId: string,
  boardingIso: string | undefined,
): number | undefined {
  if (fromStopId === toStopId || !boardingIso) return undefined;
  const table = isLrtPeak(boardingIso) ? PEAK : OFFPEAK;
  return table[`${fromStopId}|${toStopId}`];
}
