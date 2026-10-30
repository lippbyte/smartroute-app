// src/utils/co2Format.ts
//
// Hari 2 Task 3: format angka CO₂ — selalu estimasi, dibulatkan puluhan
// gram oleh backend. Tanpa Intl (lihat utils/currency.ts).

/** 480 -> "480 g", 1234 -> "1,2 kg". */
export function formatCo2(grams: number): string {
  if (grams < 1000) return `${Math.round(grams)} g`;
  const kg = Math.round(grams / 100) / 10;
  return `${String(kg).replace(".", ",")} kg`;
}

/** Selisih persen terhadap pembanding untuk jarak (proksi) yang sama:
 *  480 vs 2550 -> "−81%". Pembanding 0 -> null (tidak ada perbandingan). */
export function percentVs(grams: number, comparatorGrams: number): string | null {
  if (comparatorGrams <= 0) return null;
  const pct = Math.round((grams / comparatorGrams - 1) * 100);
  return pct <= 0 ? `−${Math.abs(pct)}%` : `+${pct}%`;
}
