# Task 01: Model 0-Mini — Deteksi & Pelacakan Kepadatan (YOLO11)

**Tim:** SmartRoute AI — Problem Solver
**Ditugaskan ke:** Lippable (backend, dengan bantuan Claude Code)
**Estimasi:** 1–2 hari kerja aktif
**Status:** Siap dieksekusi

---

## Tujuan

Bangun modul computer vision yang mendeteksi dan menghitung jumlah orang dari video, sebagai **showcase AI yang benar-benar berjalan** untuk mendukung narasi "Model 0" di pitch SmartRoute AI.

**Penting:** modul ini berdiri sendiri sebagai bukti konsep. Data kepadatan yang benar-benar dipakai aplikasi utama tetap berasal dari laporan pengguna (tombol penuh/sedang/lengang), bukan dari modul ini — supaya demo utama tidak bergantung pada video/webcam yang berisiko gagal saat presentasi live.

---

## Lingkup (in scope)

- Pakai **YOLO11 pretrained** (`yolo11n.pt`) via library `ultralytics` — **tanpa fine-tuning**.
- Pakai **tracking bawaan ultralytics** (`bytetrack.yaml` via `model.track()`) — jangan implementasikan ByteTrack manual dari nol.
- Deteksi hanya kelas `person` (class ID 0 di COCO).
- Proses dari **file video lokal** (rekaman sendiri), bukan live CCTV feed.
- Hitung jumlah orang per frame + level kepadatan (rendah/sedang/tinggi) berdasarkan threshold yang **bisa dikonfigurasi**, bukan hardcode.
- Bungkus sebagai REST API kecil (FastAPI) dengan endpoint deteksi.
- Output JSON mengikuti skema di bawah **persis** — ini kontrak interface, bukan opsional.
- Sertakan skrip pengujian dengan video sample.

## Di luar lingkup (jangan dikerjakan)

- Fine-tuning model ke data spesifik stasiun Jakarta.
- Integrasi ShanghaiTech / density estimation / arsitektur crowd-counting lain.
- Koneksi ke CCTV real-time atau feed langsung dari operator manapun.
- Menjadikan hasil modul ini sumber data kepadatan di aplikasi utama — ini modul showcase terpisah.

---

## Skema Output (wajib, untuk kompatibilitas dengan rancangan tim)

```json
{
  "timestamp": "2026-08-22T07:35:21+07:00",
  "camera_id": "MRT-BLOK-M-01",
  "location": {
    "station": "Blok M BCA",
    "transport_mode": "MRT",
    "zone": "platform"
  },
  "frame": {
    "frame_id": 18452,
    "width": 1920,
    "height": 1080
  },
  "detections": [
    {
      "track_id": 101,
      "class": "person",
      "confidence": 0.97,
      "bounding_box": { "x": 421, "y": 238, "width": 86, "height": 201 }
    }
  ],
  "passenger_count": {
    "current": 87,
    "entered": 12,
    "exited": 5
  },
  "crowd_status": {
    "level": "tinggi",
    "occupancy_percentage": 82
  }
}
```

Kalau ada perubahan pada API `ultralytics` yang membuat sebagian struktur di atas sulit dipenuhi persis, sesuaikan cara memperolehnya — tapi skema output JSON di atas harus tetap sama.

---

## Langkah Teknis

1. **Setup environment**
   ```
   pip install ultralytics fastapi uvicorn python-multipart
   ```
2. Load model — `yolo11n.pt` terunduh otomatis saat pertama kali dipanggil lewat `ultralytics`.
3. Buat modul deteksi: fungsi yang menerima path video, jalankan
   ```python
   model.track(source=video_path, classes=[0], tracker="bytetrack.yaml", persist=True)
   ```
   lalu iterasi hasil per frame.
4. Hitung `entered`/`exited` dengan membandingkan `track_id` yang baru muncul vs hilang antar frame. **Kalau ini bikin rumit, boleh disederhanakan jadi `current` count saja dulu** — bukan bagian kritis untuk MVP.
5. Tentukan threshold level kepadatan lewat parameter/config (bukan hardcode), contoh awal: `<10` = rendah, `10–25` = sedang, `>25` = tinggi. Nilai ini akan dikalibrasi ulang setelah lihat video demo asli.
6. Bangun endpoint `POST /detect` yang menerima file video atau path, mengembalikan array hasil per frame sesuai skema JSON di atas.
7. **Opsional** (kalau P0 lain sudah stabil): endpoint `/stream` yang mengirim hasil per frame secara berurutan dengan jeda, supaya terlihat seperti pemrosesan live saat demo.
8. Uji dengan 1–2 video yang direkam tim sendiri (bukan hasil unduhan tanpa izin pakai).

---

## Acceptance Criteria

- [ ] Instalasi berjalan tanpa error dari `requirements.txt`.
- [ ] Model berhasil load `yolo11n.pt` tanpa training tambahan apapun.
- [ ] Endpoint API menerima video test dan mengembalikan output sesuai skema JSON di atas, persis strukturnya.
- [ ] Jumlah orang terdeteksi masuk akal secara visual (dicek manual: bandingkan hasil model dengan hitungan mata di beberapa frame sample).
- [ ] Level kepadatan berubah sesuai threshold yang dikonfigurasi.
- [ ] Berjalan di CPU biasa tanpa GPU khusus; catat waktu proses aktual per menit video di README.
- [ ] README singkat: cara install, cara menjalankan, cara mengganti threshold.

---

## Dependencies / Prasyarat

- Python 3.10+
- Video sample dari tim (idealnya sudah direkam sebelum mulai — jangan tunggu proses coding baru mulai rekam)
- Tidak membutuhkan akses data eksternal, CCTV, atau kerja sama pihak manapun

---

## Catatan untuk Claude Code

- Jangan menambahkan fine-tuning, ShanghaiTech, atau integrasi CCTV real-time meskipun dokumentasi Ultralytics menyinggung kemampuan itu — di luar scope task ini.
- Kalau API tracking Ultralytics berbeda dari yang diasumsikan di atas, sesuaikan implementasinya, tapi skema output JSON harus tetap sama persis.
- Prioritaskan kode yang berjalan dan skema output benar, di atas optimasi performa atau akurasi deteksi.
- Modul ini berdiri sendiri — jangan hubungkan ke pipeline data aplikasi utama (routing/scoring) kecuali diminta eksplisit di task terpisah.

---

*Task berikutnya yang perlu disusun serupa: Task 02 (GTFS + OpenTripPlanner routing), Task 03 (skor rule-based multi-kriteria), Task 04 (asisten chat LLM wayfinding), Task 05 (frontend web mobile-first).*
