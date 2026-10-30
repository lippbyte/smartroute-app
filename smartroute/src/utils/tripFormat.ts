// src/utils/tripFormat.ts
//
// Hari 1 Task 5: format durasi & tanggal perjalanan — satu tempat supaya
// Ringkasan, Riwayat, dan Detail memakai label yang sama.
// Aturan kejujuran: "Aktual" HANYA bila duration_basis = 'aktual' (trigger
// kedatangan 75 m); selain itu selalu "Estimasi". Prediksi ditampilkan
// sebagai rentang {min,max} dari backend, bukan satu angka.

export function formatRange(range: { min: number; max: number } | null | undefined): string | null {
  if (!range) return null;
  return range.min === range.max ? `${range.min} mnt` : `${range.min}–${range.max} mnt`;
}

export interface DurationDisplay {
  /** "Aktual" atau "Estimasi" — selalu ditampilkan bersama angkanya. */
  label: "Aktual" | "Estimasi";
  value: string;
  /** Pembanding untuk "Aktual": rentang prediksi; null bila tidak ada. */
  predicted: string | null;
}

export function durationDisplay(args: {
  basis: "aktual" | "estimasi";
  actualMin: number | null;
  predicted: { min: number; max: number } | null | undefined;
  /** Cadangan bila rute lama tidak membawa rentang. */
  fallbackMin?: number;
}): DurationDisplay {
  const predicted = formatRange(args.predicted);
  if (args.basis === "aktual" && args.actualMin !== null) {
    return { label: "Aktual", value: `${args.actualMin} mnt`, predicted };
  }
  return {
    label: "Estimasi",
    value: predicted ?? (args.fallbackMin !== undefined ? `± ${args.fallbackMin} mnt` : "—"),
    predicted: null,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/** "Kam, 30 Okt 2026, 17:05" — manual, tanpa Intl (lihat utils/currency.ts
 *  untuk alasan tidak mengandalkan Intl di Hermes). Jam lokal perangkat. */
export function formatTripDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}
