# Task App-18: Optimasi Gesture Dua Jari di Peta

**Assignee:** Lippable

## Tujuan

Perbaiki pengalaman saat user menggunakan dua jari di peta (pan/rotate/tilt) — dilaporkan terasa kurang nyaman saat drag/geser peta.

## Lingkup

- Investigasi dulu: apakah gesture dua jari saat ini memicu rotate/tilt kamera secara tidak sengaja saat user cuma bermaksud geser (pan) peta? Ini perilaku umum MapLibre/peta berbasis gesture kalau tidak dikonfigurasi khusus.
- Kalau iya: pertimbangkan menonaktifkan rotate-tidak-sengaja saat pan dua jari, atau buat threshold yang lebih toleran supaya gesture pan biasa tidak gampang ke-interpretasi sebagai rotate.
- Uji langsung di device fisik — ini jenis masalah yang cuma benar-benar terasa lewat sentuhan tangan, bukan simulasi.

## Acceptance criteria

- Gesture dua jari untuk pan/geser peta terasa presisi dan sesuai maksud user, tidak tiba-tiba memutar/memiringkan tampilan tanpa diminta.
- Diverifikasi langsung di device fisik oleh Anda sendiri sebagai pengguna, bukan cuma laporan teknis dari Claude Code.
