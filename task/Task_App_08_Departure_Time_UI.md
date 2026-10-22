# Task App-08: Field Pin `departure_time` di Pencarian Rute

**Assignee:** Lippable
**Prioritas: TINGGI — kerjakan sebelum Backend-08/App-07, murah dan mempengaruhi akurasi SEMUA skenario rehearsal, bukan cuma Skenario 2.**

## Tujuan

Tambah cara set waktu keberangkatan di UI pencarian rute, supaya hasil rehearsal dan hasil demo beneran bisa dikunci ke jam yang sama — bukan tergantung jam berapa kebetulan dites/didemokan.

## Konteks

`routeService.ts` sudah punya parameter `departureTime` siap pakai (dari Task Backend-03c), tapi `route.tsx` tidak pernah mengirimkannya. Rehearsal barusan membuktikan dampaknya nyata secara empiris: rute Blok M → Halte Kota yang sama menghasilkan 91–105 menit jam 07:45 WIB, vs ~70–75 menit di referensi README jam 09:00 — beda ~20 menit murni karena jam, bukan bug rute.

## Lingkup

- Tambah input waktu sederhana (jam:menit, tanggal opsional/default hari ini) di layar pencarian rute.
- Sambungkan nilai itu ke `fetchRealRoutes()`/`routeService.ts` yang parameternya sudah siap dipakai.
- Tanpa diisi user, default tetap "sekarang" — perilaku tidak berubah dari sebelumnya.

## Batasan eksplisit

- Jangan bikin UI picker yang rumit (kalender penuh, pemilihan tanggal jauh ke depan, dst) — cukup input sederhana yang memadai untuk keperluan rehearsal/demo.
- Jangan sentuh logic backend — parameter ini sudah ada dan berfungsi sejak Backend-03c, task ini murni menyambungkan dari sisi UI.

## Acceptance criteria

- User bisa set jam keberangkatan spesifik di UI, dan hasil rute berubah sesuai — diverifikasi dengan 2 jam berbeda menghasilkan rute/waktu berbeda, konsisten dengan temuan Backend-03c.
- Tanpa diisi, default tetap "sekarang" seperti sebelumnya (regresi dicek, bukan diasumsikan).
