// src/utils/departureTime.ts
//
// Task App-08: bangun string departure_time yang backend terima —
// `z.iso.datetime({ offset: true })` di backend/backend-skeleton/src/lib/
// validation.ts mewajibkan offset zona waktu EKSPLISIT (mis.
// "2026-09-10T20:17:00+07:00"), bukan "Z". Date#toISOString() bawaan JS
// selalu mengonversi ke UTC dengan akhiran "Z" — tidak bisa dipakai apa
// adanya, makanya perlu dibangun manual di sini.
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * @param hour 0-23
 * @param minute 0-59
 * @param baseDate tanggalnya (default hari ini) — task ini sengaja tidak
 *   menyediakan pemilihan tanggal jauh ke depan (di luar lingkup), cuma jam
 *   di hari yang sama.
 */
export function buildDepartureTimeIso(
  hour: number,
  minute: number,
  baseDate: Date = new Date(),
): string {
  const target = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    hour,
    minute,
    0,
  );

  // getTimezoneOffset() adalah (UTC - lokal) dalam menit, jadi dibalik
  // tandanya dulu untuk dapat offset (lokal - UTC) yang biasa ditulis
  // manusia (mis. WIB = UTC+7 -> offset lokal +420 menit).
  const offsetMinutes = -target.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetMins = pad(absOffset % 60);

  const datePart = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
  const timePart = `${pad(target.getHours())}:${pad(target.getMinutes())}:00`;

  return `${datePart}T${timePart}${sign}${offsetHours}:${offsetMins}`;
}

/**
 * Validasi jam/menit mentah dari input teks sebelum dibangun jadi ISO
 * string. Mengembalikan pesan error (string) kalau tidak valid, atau null
 * kalau valid.
 */
export function validateHourMinute(
  hourText: string,
  minuteText: string,
): string | null {
  if (hourText.trim() === "" || minuteText.trim() === "") {
    return 'Isi jam dan menit, atau matikan "Atur waktu" untuk pakai waktu sekarang.';
  }
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return "Jam harus angka 0-23.";
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    return "Menit harus angka 0-59.";
  }
  return null;
}

// Task App-20: backend selalu meng-echo balik waktu berangkat yang BENAR-
// BENAR dipakai untuk hitung jadwal (RouteRecommendation.departure_time) —
// baik itu waktu custom user maupun "sekarang" kalau user tidak mengisi.
// Ditemukan selama verifikasi task ini bahwa field ini sampai sekarang
// tidak pernah ditampilkan lagi ke user setelah submit, jadi tidak ada
// konfirmasi visual bahwa input custom mereka benar-benar dipakai.
//
// Regex langsung ambil "HH:MM" dari string, BUKAN parse ke Date lalu
// format ulang — string ISO ini sendiri sudah literal jam-dinding Jakarta
// (dibangun oleh buildDepartureTimeIso/nowInJakartaIso di backend, sama
// persis triknya dengan jakartaTimeOfDaySeconds() di routing.ts backend).
// Ini menghindari sama sekali ketergantungan ke Date/Intl runtime — kelas
// risiko yang sama dengan yang sudah didokumentasikan di crowdLevel.ts
// (Hermes/Android tidak menjamin hasil Date-formatting yang konsisten).
//
// @returns null kalau string-nya tidak sesuai format yang diharapkan
//   (jangan tampilkan apa pun daripada menebak).
export function formatDepartureLabel(iso: string): string | null {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}
