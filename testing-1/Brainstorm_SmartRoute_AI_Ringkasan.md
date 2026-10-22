# Brainstorm: SmartRoute AI (Ringkasan Project)

## 1. Konteks masalah

Total pengguna harian TransJakarta, MRT, dan LRT gabungan baru sekitar 700 ribu orang — setara 6% populasi Jakarta — jauh dari target nasional 60% pada 2030 (Perpres No. 55/2018). Aplikasi resmi yang ada (JAKI, JakLingko) sudah menyediakan jadwal, rute, dan perbandingan tarif dasar, tapi belum menjawab dua kebutuhan nyata:

1. Ketidakpastian yang tidak dikomunikasikan — pengguna tidak tahu seberapa besar risiko ketinggalan sambungan di titik transfer.
2. Pengguna yang tidak familiar dengan sistem — pendatang, wisatawan, dan warga baru tidak punya bekal memahami istilah dan alur transum Jakarta.

Tim menyadari keterbatasan sudut pandang sebagai warga Bandung (bukan warga Jakarta), sehingga ide dikembangkan dari riset internet dan sesi mentoring Dishub, bukan pengalaman langsung — dan sengaja tidak berasumsi berlebihan soal detail lokal.

## 2. Ide solusi

SmartRoute AI: prototipe aplikasi web mobile-first yang memberi rekomendasi rute jujur soal ketidakpastian (rentang ETA, risiko transfer), bukan sekadar kalkulator rute tercepat/termurah. Diposisikan **bukan** sebagai pesaing JAKI/JakLingko, melainkan sebagai prototipe **modul fitur** yang secara konsep bisa diintegrasikan ke JAKI SuperApp di masa depan.

Elemen inti:
- Rentang ETA (bukan angka tunggal) + indikator risiko transfer di titik-titik kunci
- Toggle mode Komuter vs Wisatawan/Baru di Jakarta, di atas backend yang sama
- Asisten chat berbasis LLM untuk wayfinding bebas teks (fitur AI yang benar-benar berfungsi live)
- Mekanisme lapor kepadatan dari pengguna (pengganti CCTV untuk kebutuhan aplikasi utama)
- Skor rute multi-kriteria berbasis bobot (waktu/biaya/kenyamanan/transfer)
- Showcase computer vision (YOLO11 pretrained) sebagai bukti konsep AI, berdiri sendiri di luar jalur kritis aplikasi

## 3. Target pengguna

**Persona 1 — Komuter harian ("Rina")**: warga Jakarta, pekerja kantoran. Butuh rentang waktu realistis, info risiko transfer, dan kemampuan bandingkan rute berdasarkan prioritas harian.

**Persona 2 — Pendatang/Wisatawan ("Alex")**: baru pertama kali ke Jakarta. Butuh instruksi langkah-demi-langkah sederhana, asisten chat berbahasa sehari-hari, panduan visual/ikon, dan estimasi biaya yang jelas di depan.

Kedua persona dilayani lewat satu backend yang sama, dibedakan lewat toggle mode di UI — bukan dua produk terpisah.

## 4. Tech stack

- **Frontend**: web app mobile-first (bukan native), dibangun dengan **Claude Code**; wireframe → mockup di **Claude Design**
- **Routing engine**: GTFS TransJakarta + OpenTripPlanner (OTP2) self-hosted — bukan Google Maps Directions API, karena ToS Google Maps melarang penggunaan data untuk melatih/membangun model ML
- **Geocoding**: Google Maps API hanya untuk autocomplete lokasi/tampilan peta, tidak disimpan sebagai dataset
- **AI/skoring**: mesin skor rule-based multi-kriteria (bukan ML) sebagai "decision engine" utama
- **Asisten chat**: API model bahasa (LLM) untuk wayfinding, tanpa dataset pelatihan khusus
- **Computer vision showcase**: YOLO11 pretrained (`yolo11n.pt`, library `ultralytics`) + tracking bawaan (`bytetrack.yaml`), tanpa fine-tuning
- **Opsional**: model kecil (XGBoost) untuk prediksi delay di atas dataset sintetis terkalibrasi statistik publik (BPS, TomTom), dilabeli eksplisit sebagai bukti-konsep

## 5. Fitur/task yang kepikiran

- GTFS TransJakarta ingestion + OTP2 routing (minimal 3 rute nyata terverifikasi)
- Input asal-tujuan dengan autocomplete
- Hasil rute: rentang ETA + biaya + jumlah transfer
- Indikator risiko transfer di titik-titik utama (heuristik headway GTFS)
- Toggle mode Komuter vs Wisatawan/Baru di Jakarta
- Asisten chat LLM untuk wayfinding
- Mekanisme lapor kepadatan per halte (tombol penuh/sedang/lengang)
- UI ramah semua umur (WCAG AA, alur inti ≤3 tap)
- Model 0-mini: deteksi & hitung orang dari video (YOLO11), showcase AI terpisah dari jalur data utama
- *(P1, kalau waktu memungkinkan)*: GTFS MRT satu jalur, perbandingan CO2 vs kendaraan pribadi, preferensi rute malam hari, UI dwibahasa

## 6. Alur (flow) kasar

1. Pengguna buka aplikasi lewat browser (tanpa instalasi) → pilih mode: Komuter atau Wisatawan/Baru di Jakarta
2. Input lokasi asal & tujuan (autocomplete)
3. Sistem menampilkan 2–3 opsi rute: rentang waktu, biaya, jumlah transfer, level risiko di tiap titik transfer
4. Kalau bingung, pengguna bisa tanya asisten chat dalam bahasa sehari-hari
5. Pengguna pilih rute
6. Saat berada di halte/stasiun, pengguna bisa melaporkan kepadatan saat itu, yang memengaruhi info untuk pengguna lain

## 7. Referensi/inspirasi

- **JAKI** — aplikasi resmi Pemprov DKI, fitur jadwal/rute/real-time untuk moda utama, bisa diunduh siapa saja
- **JakLingko app** — sudah punya perbandingan rute lintas moda dengan estimasi biaya-waktu ("rute terhemat")
- **Kommuta** — bilingual (ID/EN), fitur berbagi kondisi halte dari pengguna
- **Moovit** — panduan step-by-step untuk pengguna baru transportasi umum
- **Satu Matrix (BPTJ)** — platform integrasi data pergerakan skala B2G, bukan pesaing langsung tapi relevan sebagai konteks ekosistem data

## 8. Batasan

- **Waktu**: 2 minggu efektif, dinilai lewat demo live app (bukan cuma slide/video)
- **Data**: tidak ada GTFS-Realtime atau data posisi armada real-time yang terkonfirmasi tersedia publik dari operator manapun di Jakarta; data dari sesi mentoring Dishub bersifat agregat kota, bukan granular per-halte — jangan dijadikan dependency untuk demo
- **CCTV**: tidak diintegrasikan ke aplikasi utama (beban privasi & kompleksitas tidak sepadan); hanya jadi showcase computer vision berdiri sendiri
- **Cakupan moda**: TransJakarta penuh untuk demo live; MRT/LRT/KRL/JakLingko masuk roadmap, bukan dibangun penuh
- **Tim**: 4 anggota SMK (Amelia, Rakkan — UI/UX; Bayu, Rakkan — AI/ML; Khalifa — backend & data), ditambah kontribusi backend/AI dari penyusun brainstorm ini
- **Legal**: Google Maps API tidak boleh dipakai untuk melatih model ML (ToS)
- **Prioritas strategis**: memenangkan grand prize jadi tujuan utama; kelayakan adopsi nyata oleh Dishub/JAKI tetap jadi arah positioning jangka panjang, bukan syarat wajib desain v1
- Tim memilih tidak melakukan riset/wawancara pengguna formal di tahap ini — fokus langsung ke pengembangan prototipe

## 9. Pertanyaan terbuka

- Tanggal pasti hari-H babak final — memengaruhi seluruh timeline 2 minggu
- Kriteria penilaian pasti babak final — bobot antara inovasi AI, kelengkapan fitur, dan kelayakan implementasi
- Apakah data dari Dishub (kalau datang) akan diintegrasikan darurat sebelum hari-H, atau otomatis diabaikan untuk demo
- Batas rate-limit/biaya API LLM yang dipakai asisten chat — cukup untuk sesi demo tanpa risiko gagal di tengah presentasi
- Apakah UI dwibahasa (mode wisatawan) masuk skema desain awal atau ditambahkan belakangan
