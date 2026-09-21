# Task Backend-04: Layanan Kepadatan Crowdsource

**Assignee:** Lippable
**Prasyarat:** Task Backend-03c selesai dan di-merge (untuk menghindari konflik file dengan Backend-05 yang jalan paralel).

## Tujuan

Endpoint untuk menerima laporan kepadatan dari pengguna ("penuh/sedang/lengang" per halte), mengagregasinya, dan mengisi field `crowd_level` di `RouteCandidate`.

## Konteks

Ini satu-satunya sumber data live/real-time yang benar-benar dimiliki tim — bukan API pemerintah mana pun (yang semuanya statis/historis, sudah dikonfirmasi sebelumnya). Model 0 (CV) **tidak** dipakai sebagai sumber data di sini — itu tetap showcase terpisah, sesuai keputusan yang sudah disepakati.

## Lingkup

- Tabel penyimpanan laporan: `stop_id`, `level` (`"low" | "moderate" | "high"` — harus persis sama dengan enum `crowd_level` di skema `RouteCandidate`), `reported_at`.
- `POST /crowd-reports` — menerima `{ stop_id, level }`, simpan dengan timestamp saat diterima.
- Fungsi agregasi per `stop_id`: ambil laporan dalam window waktu tertentu (mulai dari 15 menit terakhir sebagai starting point, boleh disesuaikan), berikan bobot lebih besar ke laporan yang lebih baru (recency-weighted), hasilkan satu level representatif.
- `GET /crowd-reports/:stop_id` — endpoint bantu untuk testing/debug, mengembalikan level agregat saat ini untuk satu halte.
- Integrasi ke `routing.ts`: untuk tiap `RouteCandidate`, isi `crowd_level` dengan level **terburuk (worst-case)** di antara semua halte yang dilalui rute tersebut (naik-turun maupun titik transfer) — bukan cuma halte asal. Ini karena titik transfer adalah tempat paling relevan untuk kekhawatiran kepadatan sesuai framing PRD.

## Batasan eksplisit

- Jangan integrasikan Model 0 (CV) di sini — sumber data murni dari laporan pengguna.
- Jangan bikin sistem autentikasi atau pencegahan spam laporan palsu — di luar scope MVP kompetisi. Ini boleh dicatat sebagai known limitation di README, bukan diselesaikan sekarang.
- **Jangan isi `crowd_level` dengan nilai default/tebakan kalau tidak ada laporan sama sekali untuk halte-halte di rute itu** — biarkan tetap `undefined`, konsisten dengan prinsip yang sudah dipegang sejak Task Backend-03 (jangan teruskan data yang seolah-olah nyata padahal tidak ada).

## Acceptance criteria

- `POST /crowd-reports` berhasil menyimpan laporan baru; `GET /crowd-reports/:stop_id` mengembalikan agregasi yang benar — diverifikasi manual dengan mengirim beberapa laporan berbeda level & waktu, lalu cek hasil agregasinya sesuai bobot recency yang diharapkan.
- `POST /routes` sekarang mengisi `crowd_level` untuk kandidat yang salah satu halte-nya punya laporan aktif, dan tetap `undefined` untuk kandidat yang halte-haltenya belum ada laporan sama sekali.
- `tsc --noEmit` lolos.
