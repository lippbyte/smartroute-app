# Task Ops-01: Verifikasi App-06 Penuh + Investigasi OTP2 yang Sering Mati

**Assignee:** Lippable
**Prioritas: SEGERA — sebelum mulai fitur baru manapun (App-07 dst).**

## Tujuan

Dua hal dalam satu task:
1. Re-verifikasi Task App-06 end-to-end dengan OTP2 benar-benar jalan — bukan cuma "koordinat terkirim benar", tapi hasil rute beneran muncul di layar.
2. Cari tahu kenapa OTP2 berulang kali mati di antara sesi kerja, dan perbaiki penyebabnya.

## Konteks

OTP2 sudah dua kali ditemukan mati tanpa disengaja — sekali saat testing HP fisik (era Task App-04), sekali lagi saat verifikasi App-06. Pola berulang ini lebih penting dibereskan sekarang daripada nanti — risikonya paling parah kalau kejadian pas presentasi live di depan juri, bukan pas development.

## Lingkup — Bagian 1: Re-verifikasi App-06

- Nyalakan OTP2 (`docker compose up` di `otp2-setup`).
- Ulangi skenario end-to-end dari laporan App-06 sebelumnya (ketik "blok m" di autocomplete, tap saran, cari rute) — kali ini sampai **hasil rute beneran tampil di layar**, bukan berhenti di titik "request terkirim dengan benar".
- Verifikasi hasil rute yang tampil masuk akal (waktu tempuh, transfer, dst).

## Lingkup — Bagian 2: Investigasi & Perbaikan OTP2

- Cek `docker-compose.yml` di `otp2-setup` — apakah container punya restart policy (`restart: unless-stopped` atau `always`)? Kalau tidak ada, tambahkan.
- Cek log container (`docker logs`) — apakah OTP2 pernah benar-benar crash sendiri (kehabisan memori, error internal), atau dimatikan oleh sesuatu di luar aplikasinya (laptop sleep, Docker Desktop restart, dimatikan manual dan lupa dinyalakan lagi)?
- **Kalau penyebabnya laptop sleep/restart** (bukan crash aplikasi) — restart policy container saja tidak cukup, karena itu soal Docker Desktop sendiri yang perlu jalan lagi. Untuk kasus ini, solusi realistis adalah **checklist manual** ("nyalakan & cek OTP2 di awal tiap sesi kerja/rehearsal"), bukan otomatisasi berlebihan untuk masalah yang sebenarnya operasional.
- Tambahkan cara cek cepat "OTP2 hidup atau tidak" (bisa sesederhana satu baris curl ke endpoint OTP2) — dicatat di README, siap dipakai sebelum mulai kerja atau rehearsal.

## Batasan eksplisit

- Jangan bikin OTP2 auto-start bareng OS/login (task scheduler, dll) — di luar scope, cukup restart policy container + checklist manual.
- Jangan ubah konfigurasi OTP2 lainnya (GTFS, OSM graph, dst) di task ini — murni soal reliability start/restart.
- Kalau Bagian 1 (re-verifikasi App-06) gagal karena bug baru (bukan cuma OTP2 mati), laporkan itu terpisah — jangan dicampur jadi satu kesimpulan yang membingungkan.

## Acceptance criteria

- App-06 end-to-end terverifikasi penuh: dari ketik autocomplete sampai hasil rute beneran tampil di layar dengan data yang masuk akal.
- Penyebab OTP2 sering mati teridentifikasi jelas — crash aplikasi vs dimatikan sistem/manual.
- Kalau penyebabnya bisa diperbaiki teknis (restart policy) — diterapkan dan diverifikasi (simulasikan restart, pastikan container otomatis hidup lagi).
- Kalau penyebabnya operasional (laptop sleep, dll) — ada checklist jelas di README, bukan dibiarkan tanpa mitigasi.
- Cara cepat cek kesehatan OTP2 didokumentasikan, siap dipakai sebelum rehearsal maupun demo beneran.
