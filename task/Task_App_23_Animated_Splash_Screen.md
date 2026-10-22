# Task App-23: Splash Screen Animasi (Background + Fade-in Teks)

**Assignee:** Lippable

## ⚠️ Sebelum mulai

Simpan dua gambar yang sudah dibuat (background polos, dan background+teks "Smart Route AI") ke folder aset project (misal `smartroute/assets/splash/`) — file-file ini ada di percakapan/upload sebelumnya, belum otomatis ada di project, jadi perlu dipindahkan manual dulu sebelum bisa dipakai kode.

## Tujuan

Bikin splash screen animasi saat app dibuka: background (Monas + siluet patung) muncul dulu, lalu teks **"Smart Route AI"** + tagline **"Navigate Smarter. Travel Better."** fade-in beberapa detik kemudian, baru otomatis pindah ke Beranda.

## Konteks

Splash native (OS-level, dikontrol `app.json`/`expo-splash-screen`) cuma bisa gambar **statis** — tidak bisa animasi, karena itu tampil sebelum kode JS sempat jalan. Jadi animasi fade-in teks ini perlu dibuat sebagai **layar kustom di dalam app** (muncul sesaat setelah JS dimuat), bukan splash native itu sendiri.

## Lingkup

1. **Splash native** (`app.json`/`expo-splash-screen`): pakai gambar background **polos** (tanpa teks) sebagai splash OS-level standar — ini yang muncul paling pertama, harus statis.
2. **Layar intro kustom** (baru, muncul sesaat setelah splash native hilang, sebelum masuk Beranda):
   - Tampilkan background yang sama (supaya transisi dari splash native ke layar ini mulus, tidak ada "kedipan" ganti gambar)
   - Fade-in teks "Smart Route AI" + tagline "Navigate Smarter. Travel Better." (pakai `Animated` API bawaan React Native, atau Reanimated kalau sudah dipakai di project)
   - Setelah teks selesai fade-in + jeda singkat (total durasi sekitar 2–3 detik dari awal fade-in), otomatis navigasi ke Beranda — tidak perlu tombol "lanjut" manual
3. Pastikan transisi ke Beranda mulus, tidak ada flicker/jeda kosong di antaranya.

## Batasan eksplisit

- Splash native **wajib statis** (keterbatasan platform, bukan pilihan desain) — jangan coba paksa animasi di situ.
- Jangan bikin splash ini bisa di-skip manual atau muncul berulang tiap pindah layar lain — ini cuma sekali di awal app dibuka.
- Durasi total splash (termasuk animasi) jangan kelamaan (maksimal ~3–4 detik) — splash kepanjangan bikin app kelihatan lambat dibuka, bukan kelihatan bagus.

## Acceptance criteria

- Native splash tampil dengan background yang benar saat app pertama dibuka.
- Setelah itu, teks "Smart Route AI" + tagline fade-in dengan animasi yang terlihat mulus.
- Setelah animasi selesai, otomatis pindah ke Beranda tanpa aksi manual dari user.
- Total durasi dari app dibuka sampai masuk Beranda tidak lebih dari ~3–4 detik.
