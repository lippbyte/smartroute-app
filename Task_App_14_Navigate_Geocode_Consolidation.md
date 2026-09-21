# Task App-14: Ganti Geocoding Duplikat di navigate.tsx dengan utils/geocode.ts

**Assignee:** Lippable
**Prioritas: TINGGI** — ini bug korektnes nyata (resolve ke kota/pulau salah), sudah dilaporkan 2x sebagai technical debt sebelum akhirnya manifest jadi bug aktif.

## Konteks

`navigate.tsx` punya fungsi geocoding lokal sendiri (bukan reuse `utils/geocode.ts` yang sudah proven dan dipakai konsisten di App-05/App-06), tanpa cache/throttle — dan baru ketahuan resolve **"Kali Besar" ke Banjarmasin, Kalimantan**, bukan Jakarta. Kelas bug yang sama dengan ambiguitas "kota" di rehearsal dulu, tapi kali ini bisa resolve ke **pulau berbeda sama sekali**, bukan sekadar area salah dalam kota yang sama.

Ini pertama kali dilaporkan sebagai debt di Task App-05, sekarang manifest jadi bug aktif yang mempengaruhi korektnes fitur inti — `navigate.tsx` dipakai di semua skenario demo, dan Task App-13 (notifikasi tiba) baru saja dibangun **bergantung langsung** ke koordinat tujuan yang benar dari fungsi ini.

## Tujuan

Hapus fungsi geocoding duplikat di `navigate.tsx`, ganti dengan memanggil `geocodePlace()` dari `utils/geocode.ts` — satu sumber kebenaran yang sudah teruji, sudah ada cache/throttle Nominatim yang benar.

## Lingkup

- Identifikasi semua pemakaian fungsi geocoding lokal di `navigate.tsx`.
- Ganti semua panggilan itu dengan `geocodePlace()` dari `utils/geocode.ts`.
- Hapus fungsi lokal lama setelah dipastikan tidak dipakai lagi di mana pun.
- Verifikasi ulang kasus "Kali Besar" — pastikan sekarang resolve ke Jakarta, bukan Banjarmasin.
- Verifikasi ulang alur `navigate.tsx` end-to-end (termasuk Task App-13 arrival detection) masih bekerja dengan geocoding yang baru.

## Batasan eksplisit

- Jangan ubah `utils/geocode.ts` — itu sudah proven benar, task ini murni soal `navigate.tsx` mengadopsinya.
- Jangan tambah logic geocoding baru — tujuannya konsolidasi ke satu implementasi, bukan bikin implementasi ketiga.

## Acceptance criteria

- `navigate.tsx` tidak lagi punya fungsi geocoding sendiri terpisah — semua pakai `utils/geocode.ts`.
- "Kali Besar" (dan idealnya beberapa nama tempat Jakarta lain yang berpotensi ambigu) resolve ke Jakarta, bukan kota/pulau lain.
- Alur `navigate.tsx` end-to-end (termasuk Task App-13 arrival detection) diverifikasi masih bekerja setelah perubahan ini.
