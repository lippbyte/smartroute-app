# Task Backend-02b: Tambahkan Data OSM ke Graf OTP2

**Assignee:** Lippable / Khalifa (siapa pun yang pegang setup OTP2)
**Prasyarat:** Task Backend-02 sudah selesai — graf OTP2 dari GTFS TransJakarta sudah bisa di-build dan berjalan.

## Tujuan

Graf OTP2 yang menggabungkan GTFS TransJakarta dengan data jaringan jalan OSM, supaya OTP2 bisa menghitung rute jalan kaki dari titik lat/lng sembarang (bukan cuma antar-halte GTFS) mengikuti jalan asli — bukan garis lurus.

## Konteks

Saat ini graf cuma berisi GTFS, jadi OTP2 tidak bisa merutekan jalan kaki dari titik sembarang. Itu sebabnya Task Backend-03 harus bikin workaround manual (snap ke halte terdekat via `stopsByRadius` + hitung jarak garis lurus untuk walking leg). Setelah OSM ditambahkan, OTP2 bisa menghitung access/egress leg (jalan kaki dari origin ke halte pertama, dan dari halte terakhir ke destination) sendiri, mengikuti jaringan jalan asli — termasuk hal seperti jembatan penyeberangan dan jalan satu arah.

## Lingkup

- Unduh ekstrak OSM dari Geofabrik untuk area Indonesia (cek ekstrak per-region yang tersedia; kalau tidak ada yang sekecil Jabodetabek langsung, unduh ekstrak Indonesia/Jawa lalu clip)
- Potong (clip) ekstrak itu ke bounding box Jabodetabek pakai `osmium extract` atau `osmconvert`, supaya file build tetap kecil dan waktu build graf tetap cepat untuk iterasi berulang
- Taruh file `.osm.pbf` hasil clip di folder input yang sama dengan GTFS zip (folder build OTP2)
- Rebuild graf OTP2, pastikan log build menunjukkan data OSM ter-load (biasanya ada baris log soal jumlah way/edge jalan yang diproses — catat angkanya di README sebagai referensi)
- Update README OTP2 (yang sudah dibuat di Task Backend-02): tambahkan langkah cara refresh data OSM + cara re-clip kalau area cakupan diperluas nanti

## Batasan eksplisit

- Jangan ubah kode Express/TypeScript (`otpClient.ts`, `routing.ts`) di task ini — mengganti workaround manual dengan kapabilitas baru ini adalah task terpisah (Backend-03b), setelah graf ini diverifikasi jalan.
- Jangan pakai ekstrak OSM seluruh Indonesia mentah-mentah untuk build rutin — harus di-clip ke Jabodetabek dulu, supaya tidak boros waktu dan RAM setiap kali rebuild.
- Jangan aktifkan mode routing selain jalan kaki (misal car routing, bike routing) kecuali memang diminta — cukup yang dibutuhkan untuk access/egress pejalan kaki.

## Acceptance criteria

- Graf OTP2 berhasil di-build ulang tanpa error, dengan OSM Jabodetabek ter-include (diverifikasi dari log build).
- Query manual lewat GraphiQL OTP2: cari rute dari satu titik lat/lng sembarang (bukan koordinat halte persis, mis. titik di tengah blok bangunan) ke halte GTFS terdekat — OTP2 sekarang harus bisa mengembalikan walking leg dengan jarak & rute yang masuk akal (dicek manual di peta, dibandingkan kasar dengan Google Maps).
- Waktu build graf tetap wajar (bukan puluhan menit). Kalau jauh lebih lambat dari sebelumnya, itu sinyal ekstrak belum ter-clip dengan benar ke Jabodetabek saja.

---

*Setelah task ini stabil, Task Backend-03b akan mengganti workaround manual (`stopsByRadius` + walk leg sintetis) di `routing.ts` dengan query native ke OTP2 yang sekarang bisa menerima lat/lng sembarang langsung — sekaligus memperbaiki `cost_idr` jadi tarif flat Rp 3.500 per itinerary (bukan dikali jumlah transfer).*
