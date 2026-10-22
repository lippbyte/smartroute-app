# Task Backend: Routing Engine — SmartRoute AI

**Assignee:** Lippable (backend)
**Stack:** Express + TypeScript
**Prasyarat teknis:** Node.js 20+, Docker, Java 21 (dibutuhkan OTP2)
**Target akhir seri task ini:** Endpoint `/routes` yang mengembalikan rekomendasi rute nyata TransJakarta, dengan skema JSON yang jadi kontrak resmi untuk semua service berikutnya (skor risiko, skor kepadatan, rekomendasi, asisten LLM).

## Kenapa urutannya begini

Semua layanan lain di arsitektur backend butuh kandidat rute sebagai input — tidak ada yang bisa divalidasi kalau routing engine belum jalan. Ini prioritas nomor satu dan harus stabil dulu, sesuai checkpoint Hari ke-5 di PRD ("GTFS TransJakarta + OTP2 stabil, baru lanjut ke P1").

Kerjakan tiga task di bawah secara berurutan — masing-masing bisa jadi satu sesi kerja terpisah dengan Claude Code.

---

## Task Backend-01 — Setup proyek & kontrak skema

### Tujuan
Proyek Express + TypeScript yang bisa dijalankan, dengan tipe data yang jadi kontrak resmi untuk semua service berikutnya. Ini yang bikin front-end tidak perlu berubah nanti kalau ada bagian yang diganti dari heuristik ke model beneran.

### Lingkup
- Inisialisasi proyek: Express + TypeScript, struktur folder (`src/routes`, `src/services`, `src/types`, `src/lib`)
- Endpoint `GET /health` yang mengembalikan `{ "status": "ok" }`
- File `src/types/schema.ts` berisi interface berikut (final untuk MVP, bukan draft — service selanjutnya wajib mengikuti ini):

```typescript
interface RouteLeg {
  mode: "WALK" | "BUS";
  route_name?: string;
  from: string;
  to: string;
}

interface RouteCandidate {
  route_id: string;
  legs: RouteLeg[];
  travel_time_minutes: { min: number; max: number }; // rentang, bukan angka tunggal — ini pembeda utama dari Google Maps
  transfer_count: number;
  walking_distance_m: number;
  cost_idr: number;
  crowd_level?: "low" | "moderate" | "high"; // diisi Task Backend-04, kosong dulu di sini
  reliability?: { score: number; risk: "low" | "medium" | "high" }; // diisi Task Backend-05, kosong dulu di sini
}

interface RouteRecommendation {
  request_id: string;
  origin: { name: string; lat: number; lng: number };
  destination: { name: string; lat: number; lng: number };
  routes: RouteCandidate[]; // urut dari yang paling relevan
  generated_at: string; // ISO 8601
}
```

### Batasan eksplisit
- Jangan implementasi logika routing di task ini — murni skeleton + tipe.
- Jangan pasang database dulu — itu bagian dari Task Backend-02.
- Jangan pasang autentikasi/login pengguna — di luar scope MVP kompetisi.

### Acceptance criteria
- `npm run dev` jalan tanpa error, `GET /health` merespons 200 dengan body yang benar.
- `tsc --noEmit` lolos tanpa error tipe.

---

## Task Backend-02 — GTFS TransJakarta + OpenTripPlanner 2

### Tujuan
Instance OTP2 self-hosted yang bisa menjawab query rute nyata TransJakarta.

### Konteks penting
GTFS statis TransJakarta itu nyata dan bisa diunduh (terindeks di Transitland sebagai feed `f-transjakarta~id`, sekitar 236 rute dan 8.400 stop). Ini data **jadwal terjadwal, bukan posisi real-time** — OTP2 menghitung rute dari jadwal ini plus asumsi kecepatan jalan kaki standar. Jangan cari data GPS armada real-time, itu memang tidak dipublikasikan siapa pun untuk TransJakarta saat ini.

### Lingkup
- Cari dan unduh GTFS TransJakarta terbaru yang valid — validasi strukturnya (`agency.txt`, `routes.txt`, `stops.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt` harus ada dan tidak korup) sebelum dipakai
- Build graf OTP2 dari GTFS tersebut (image Docker resmi OTP2, atau jar lokal — pilih yang paling cepat untuk iterasi ulang)
- Jalankan OTP2 server lokal, expose GraphQL API-nya
- Tulis README singkat di folder OTP2: cara refresh graf kalau file GTFS berubah

### Batasan eksplisit
- Jangan tambahkan GTFS moda lain (KRL/MRT) di task ini — itu keputusan terpisah nanti sebagai P1, hanya kalau task ini sudah stabil sebelum Hari ke-5.
- Jangan coba bangun atau cari GTFS-RT (real-time) untuk TransJakarta — tidak tersedia publik, jangan buang waktu.

### Acceptance criteria
- OTP2 server jalan lokal dan bisa di-query manual lewat GraphiQL bawaan OTP2.
- Query manual dari Blok M ke Kota via GraphQL OTP2 menghasilkan rute yang masuk akal secara manual (dicek dengan pengetahuan umum jalur TransJakarta).

---

## Task Backend-03 — Wrapper endpoint `/routes`

### Tujuan
Endpoint Express yang menerima origin-destination, memanggil OTP2, lalu mengubah hasilnya ke skema `RouteRecommendation` dari Task Backend-01.

### Lingkup
- `POST /routes` menerima body `{ origin: {lat, lng}, destination: {lat, lng} }`
- Panggil GraphQL OTP2, ambil 2–3 kandidat rute teratas
- Transform ke `RouteCandidate`: hitung `travel_time_minutes` sebagai rentang (mis. waktu terjadwal OTP2 sebagai batas bawah, + buffer sekitar 15% sebagai batas atas — ini yang merepresentasikan ketidakpastian, bukan angka tunggal palsu-pasti)
- Isi `cost_idr` dari tarif flat TransJakarta (Rp 3.500 per legs berbayar)
- `crowd_level` dan `reliability` biarkan `undefined` dulu — diisi task selanjutnya, jangan diisi nilai dummy acak

### Batasan eksplisit
- Jangan implementasi skor risiko atau skor kepadatan di task ini — endpoint ini murni wrapper routing.
- Jangan pasang caching dulu — optimisasi ini belakangan kalau memang perlu.

### Acceptance criteria (ini persis AC dari PRD P0.1 — sekarang bisa diverifikasi beneran)
- 3 rute nyata berikut menghasilkan hasil yang benar, diverifikasi manual satu per satu:
  - Blok M – Kota
  - Kalideres – PGC
  - Grogol – Kampung Melayu
- Response selalu valid sesuai skema `RouteRecommendation` (validasi pakai Zod atau setara) — kalau OTP2 mengembalikan sesuatu yang tidak terduga, endpoint harus menolak dengan error yang jelas, bukan meneruskan data yang rusak ke frontend.

---

*Setelah task 01–03 selesai dan stabil, lanjut ke Task Backend-04 (skor kepadatan dari laporan crowdsource) dan Task Backend-05 (skor risiko dari headway) — masing-masing akan jadi dokumen task terpisah begitu routing engine ini sudah teruji.*
