# Task Backend-03c: Parameter `departure_time`

**Assignee:** Lippable
**Prasyarat:** Task Backend-03b selesai.

## Tujuan

Tambahkan parameter opsional `departure_time` ke `POST /routes`, supaya hasil rute bisa di-pin ke waktu tertentu — bukan selalu memakai "sekarang". Ini langsung merespons temuan dari debugging Backend-03b: hasil rute berubah tergantung jam query (kandidat 3F+9A+10 ada di jam 20:17 tapi hilang di 22:31, sesuai jadwal TransJakarta sesungguhnya). Tanpa cara pin waktu, rehearsal dan demo beneran bisa menghasilkan rute yang berbeda kalau jatuh di jam yang berbeda.

## Lingkup

- Tambah field opsional `departure_time` (ISO 8601, mis. `"2026-09-10T20:17:00+07:00"`) ke skema request body di `validation.ts`.
- Teruskan nilai ini ke query `planConnection` di `otpClient.ts` sebagai waktu keberangkatan. Kalau tidak diisi, perilaku tetap seperti sekarang (pakai waktu saat request diterima).
- Echo `departure_time` yang benar-benar dipakai (baik dari input maupun default "sekarang") di response, supaya saat rehearsal ada catatan jelas rute itu dihasilkan untuk jam berapa.

## Batasan eksplisit

- Jangan ubah default behavior kalau field ini tidak diisi di request.
- Jangan bikin endpoint baru — ini murni parameter tambahan di `POST /routes` yang sudah ada.
- Jangan validasi ketat soal waktu masa lalu/masa depan yang tidak masuk akal — biarkan sederhana; kalau OTP2 tidak punya jadwal di waktu itu, biarkan dia balikin `routes: []` seperti biasa, bukan ditolak di layer validasi kita.

## Acceptance criteria

- `POST /routes` dengan `departure_time` di-pin ke 22:31 WIB untuk rute Kalideres–PGC menghasilkan kandidat 3/4-transfer (bukan 3F+9A+10) — konsisten dengan temuan debugging Backend-03b.
- `POST /routes` dengan `departure_time` di-pin ke 20:17 WIB untuk rute yang sama menghasilkan kandidat 3F+9A+10 — juga konsisten dengan temuan sebelumnya.
- `POST /routes` tanpa `departure_time` tetap berperilaku seperti sebelum task ini (pakai waktu saat ini).
- `tsc --noEmit` lolos.
