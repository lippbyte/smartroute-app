# Task Model0-03: Validasi Video + Visual Output (Pretrained, Tanpa Fine-Tuning)

**Assignee:** Lippable
**Prasyarat:** Task 01 selesai (pipeline pretrained YOLO11 + ByteTrack sudah jalan). 10 sample video sudah tersedia.

## Tujuan

Ubah pipeline yang sudah jalan (Task 01) dari "menghasilkan JSON di terminal" menjadi "menghasilkan video dengan bounding box + track ID ter-overlay" — supaya bisa langsung jadi materi demo ke juri. Ini **bukan** soal akurasi lebih baik (itu urusan fine-tuning yang di-park dulu) — ini soal membuat AI yang sudah bekerja jadi *terlihat* bekerja.

## Konteks

Fine-tuning (Beijing-BRT atau lainnya) sengaja tidak dikejar sekarang karena datasetnya belum pasti lengkap/sesuai. Jalur ini pakai model pretrained apa adanya (sama seperti yang sudah divalidasi di sanity check ShanghaiTech sebelumnya) — targetnya kecepatan ke output yang bisa didemokan, bukan akurasi maksimal.

## Lingkup

- Jalankan pipeline Task 01 (YOLO11 pretrained + ByteTrack) ke ke-10 video sample.
- Untuk setiap video, generate output video baru dengan overlay:
  - Bounding box di setiap orang terdeteksi.
  - Track ID di atas/dekat setiap bounding box (angka yang konsisten selama orang itu masih di frame — bukti tracking bekerja, bukan cuma deteksi per-frame).
  - Counter jumlah orang saat ini di pojok video (real-time count per frame).
- Untuk tiap video, catat manual: apakah tracking terlihat stabil (ID nggak lompat-lompat ganti tiap beberapa frame untuk orang yang sama), atau ada masalah jelas (ID sering ganti, deteksi hilang-muncul, dll).
- Pilih **1–2 video terbaik** (paling stabil, paling representatif) sebagai kandidat utama materi demo — tidak perlu semua 10 dipoles sama bagus, cukup yang terbaik untuk showcase.

## Batasan eksplisit

- Jangan fine-tuning atau ubah bobot model apa pun di task ini — pretrained apa adanya, sesuai keputusan yang sudah diambil.
- Jangan buat UI/aplikasi terpisah untuk menampilkan video ini — cukup file video output (mp4), bisa diputar manual saat presentasi.
- Jangan habiskan waktu memperbaiki video yang hasilnya jelek (kepadatan tinggi, deteksi kacau) — itu sudah diprediksi dari sanity check sebelumnya. Fokus ke video yang hasilnya bagus, bukan usaha benerin yang jelek.

## Acceptance criteria

- Minimal 1 video output dengan bounding box + track ID + counter yang terlihat jelas dan stabil, siap dipakai sebagai materi demo langsung.
- Catatan singkat per video (10 video) soal kualitas tracking — bukan cuma "berhasil"/"gagal", tapi observasi konkret (mis. "ID stabil di kepadatan rendah, mulai lompat saat >15 orang berdekatan").
- File video final ada di folder yang jelas, siap dipresentasikan tanpa proses tambahan.
