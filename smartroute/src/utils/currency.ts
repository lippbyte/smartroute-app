// src/utils/currency.ts
//
// Task App-20: `.toLocaleString()` tanpa locale eksplisit dipakai di 3
// tempat untuk format Rupiah (route/index.tsx, route/[id].tsx,
// ArrivalCelebration.tsx) — terbukti salah tanpa locale device/browser
// dipaksa "id-ID" ("3,500" bukan "3.500", dikonfirmasi lewat Playwright
// dengan locale default). Sama kelas risiko dengan yang sudah didokumentasi
// di components/crowd/crowdLevel.ts untuk format tanggal (Hermes/Android
// tidak menjamin hasil Intl yang konsisten) — formatter manual di sini
// menghilangkan ketergantungan ke Intl runtime sama sekali, bukan cuma
// menambah locale "id-ID" eksplisit (yang untuk ANGKA kemungkinan besar
// aman di semua engine, tapi tidak ada alasan mengambil risiko itu kalau
// solusi tanpa-Intl sama sederhananya).
//
// @param amount - nilai rupiah, selalu bilangan bulat (IDR tidak punya
//   subunit yang dipakai praktis) — tidak menangani desimal.
export function formatRupiah(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const digits = Math.round(Math.abs(amount)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `Rp ${sign}${grouped}`;
}
