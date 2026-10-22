# Task App-22: UI Asisten AI (Wayfinding Chat)

**Assignee:** Lippable

## Tujuan

Bangun layar/komponen chat sederhana di app yang memanggil endpoint `/assistant/ask` yang sudah ada, supaya Asisten AI bisa didemokan dari dalam app — bukan lewat terminal/Postman lagi.

## Konteks

Backend `/assistant/ask` (Task Backend-06) sudah berfungsi sempurna dan teruji akurat, tapi belum ada UI di app untuk mengaksesnya — saat ini cuma bisa didemokan lewat API client eksternal.

## Lingkup

- Layar/komponen baru: input teks pertanyaan, tombol kirim, area tampilan jawaban.
- Panggil endpoint `/assistant/ask` yang sudah ada (tidak perlu ubah backend sama sekali).
- State loading (saat menunggu jawaban dari AI) dan error (kalau API gagal/timeout) ditangani jelas — jangan biarkan layar kosong tanpa keterangan.
- Tambahkan entry point (kartu/tombol) dari Beranda, mirip pola kartu "Peta Kepadatan" dan "Halte Terdekat" yang sudah ada.
- Tidak perlu riwayat percakapan multi-turn yang kompleks — cukup satu pertanyaan, satu jawaban per interaksi, kecuali itu sudah didukung natural oleh backend tanpa effort tambahan berarti.

## Batasan eksplisit

- Jangan ubah logic backend `/assistant/ask` — itu sudah teruji benar, task ini murni membangun UI yang memanggilnya.
- Jangan tambah kompleksitas berlebih (riwayat tersimpan, konteks multi-turn, dll) — fokus ke satu alur tanya-jawab yang bekerja baik untuk demo.

## Acceptance criteria

- User bisa mengetik pertanyaan wayfinding dan mendapat jawaban dari AI langsung di dalam app, tanpa perlu tool eksternal.
- Diverifikasi dengan pertanyaan yang sama seperti skenario demo runbook ("dari Blok M ke Kota naik apa?") — jawaban benar dan tampil dengan baik di UI.
- State loading dan error ditangani dengan baik — tidak crash, tidak layar kosong tanpa keterangan saat API lambat/gagal.
