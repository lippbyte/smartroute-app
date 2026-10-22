# Task Model0-02: Verifikasi Kelayakan Fine-Tuning ke Beijing-BRT Dataset

**Assignee:** Lippable
**Prasyarat:** Task 01 selesai (pipeline pretrained YOLO11 + ByteTrack sudah jalan).
**Batas waktu keras: maksimal 2 jam.** Ini task verifikasi/keputusan, bukan komitmen langsung ke fine-tuning penuh.

## Tujuan

Tentukan apakah fine-tuning YOLO11 ke Beijing-BRT dataset (github.com/XMU-smartdsp/Beijing-BRT-dataset) realistis dikerjakan dalam sisa waktu kompetisi, sebelum benar-benar mulai proses training.

## Konteks

Beijing-BRT itu dataset crowd counting dari sistem Bus Rapid Transit Beijing (1.280 gambar, 16.795 orang terlabel, rentang 1–64 orang per gambar) — domainnya jauh lebih cocok ke TransJakarta dibanding ShanghaiTech yang dipakai sanity check sebelumnya. Tapi dataset crowd-counting akademik **biasanya pakai anotasi titik** (posisi kepala), bukan bounding box yang dibutuhkan YOLO11 buat training deteksi objek — ini yang perlu dipastikan dulu.

## Lingkup

1. Unduh dataset dari repo GitHub tersebut.
2. Cek isi folder `ground_truth`: apa format anotasinya?
   - Bounding box (koordinat kotak per orang) → bagus, bisa langsung dipakai.
   - Titik/head-center (koordinat x,y per orang) → perlu konversi ke bounding box perkiraan (ukuran box tetap di sekitar titik).
   - Density map kontinu (mis. file `.mat`/`.h5` berisi peta kepadatan, bukan koordinat diskrit per orang) → **tidak bisa dipakai untuk training YOLO sama sekali** — stop di sini, jangan coba workaround rumit.
3. Kalau formatnya titik: tulis estimasi waktu untuk skrip konversi titik → bounding box (biasanya sederhana, beberapa baris kode).
4. Cek apakah dataset publicly downloadable langsung, atau butuh request akses/approval dari penulis (kalau butuh approval — itu red flag, laporkan segera, jangan tunggu).
5. Tulis estimasi total waktu: unduh + konversi (kalau perlu) + training + evaluasi.

## Batasan eksplisit

- **Jangan mulai proses training apa pun** sebelum verifikasi ini selesai dan dilaporkan.
- **Jangan habiskan lebih dari 2 jam** untuk task ini — kalau ternyata rumit atau ambigu, laporkan balik dengan temuan apa adanya, jangan coba paksa menyelesaikan.
- Kalau dataset butuh approval akses dari penulis — laporkan sebagai "tidak feasible dalam waktu tersisa" dan berhenti, jangan menunggu respons yang tidak pasti waktunya.

## Acceptance criteria

Laporan singkat yang menjawab dengan jelas:
- Dataset bisa diakses langsung? (ya/tidak, dan bagaimana caranya)
- Format anotasinya apa persis?
- Kalau butuh konversi, berapa estimasi waktunya?
- Rekomendasi: worth dilanjutkan ke fine-tuning, atau lebih baik fokus ke Task 01b–01d (validasi & polish pretrained) saja?
