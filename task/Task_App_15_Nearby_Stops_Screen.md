# Task App-15: Layar "Halte Terdekat"

**Assignee:** Lippable
**Prasyarat:** Task Backend-11 selesai.

## Tujuan

Tampilkan daftar halte/stasiun terdekat (4 moda: TransJakarta, MRT, LRT, JakLingko) di app, memakai lokasi GPS user (reuse logic lokasi dari App-05 kalau relevan).

## Lingkup

- Tambah bagian/layar baru "Halte Terdekat" — list halte dari endpoint Backend-11, masing-masing dengan nama, moda (ikon/badge beda per moda), dan jarak dari user (misal "350m").
- Bisa diakses dari Beranda (kartu baru, mirip kartu "Peta Kepadatan" yang sudah ada) atau tab terpisah — pilih yang paling natural dengan struktur navigasi yang sudah ada sekarang.

## Batasan eksplisit

- Jangan campur logic ini dengan pencarian rute yang sudah ada — ini fitur informasi terpisah (lihat halte terdekat), bukan bagian dari alur cari-rute.

## Acceptance criteria

- User bisa lihat daftar halte/stasiun terdekat dari 4 moda, dengan jarak yang masuk akal — dites di lokasi nyata, dibandingkan secara kasar dengan Google Maps sebagai referensi.
