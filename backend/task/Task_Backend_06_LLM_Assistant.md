# Task Backend-06: Asisten Wayfinding LLM via OpenRouter

**Assignee:** Lippable
**Prasyarat:** Task Backend-03c selesai (routing engine sudah jalan).

## Tujuan

Dua hal terpisah dalam satu task:

1. **Endpoint `POST /assistant/ask`** yang menerima pertanyaan bebas teks dari pengguna (mis. "dari Blok M ke Kota naik apa?"), menjawab pakai konteks GTFS TransJakarta yang sudah dimuat di memori, dan merespons dengan jawaban natural language yang jelas. Ini satu-satunya bagian yang benar-benar "AI" dalam arti memanggil LLM — dan jadi bukti konkret di depan juri bahwa tim ini memang pakai AI, bukan cuma klaim di proposal.

2. **Calculation `recommendation_score` di akhir `/routes`** (setelah Task 04 dan 05 selesai): mengombinasikan kepadatan (dari Task 04) dan reliabilitas (dari Task 05) menjadi satu skor akhir yang digunakan frontend buat ranking/urutan rute. Ini dilakukan di sini (bukan di 04 atau 05) karena sudah cukup kompleks dan perlu satu tempat centralized buat manajemen rumus.

## Lingkup

### Bagian A: Asisten Chat LLM

- Endpoint `POST /assistant/ask` menerima `{ question: string, context?: { origin?, destination? } }` (context opsional, kalau user sedang mencari rute spesifik).
- Load data GTFS sekali saat server start (bukan per-request): daftar halte + rute + jadwal. Sistem ini cukup untuk menjawab pertanyaan standar seperti "berapa tarif?", "jam berapa berangkat?", "naik koridor apa?".
- Panggil LLM via OpenRouter API pakai model yang murah & cepat (coba `anthropic/claude-3-5-haiku` dulu — Haiku relatif murah & cukup cepat buat task seperti ini).
- System prompt yang jelas: instruksikan LLM buat jawab berdasarkan data GTFS yang kalian sediakan, jangan buat-buat jawaban di luar data itu.
- Rate-limit sanity: catat berapa API call ke OpenRouter setiap kali, dan set alert/log kalau sudah lebih dari threshold tertentu (mis. 20 call dalam satu jam) — ini buat avoid surprise biaya di tengah demo.
- Handle error jelas: kalau OpenRouter timeout/error, jangan coba fallback ke jawaban yang dibuat-buat — kasih tahu pengguna "layanan asisten sedang tidak tersedia."

### Bagian B: Recommendation Score Calculation

Di endpoint `POST /routes`, **setelah** semua `RouteCandidate` sudah dihitung `crowd_level` (Task 04) dan `reliability` (Task 05)-nya, hitung `recommendation_score` dengan rumus tertimbang ini:

```
recommendation_score = 
  0.25 × normalized_time +
  0.15 × normalized_cost +
  0.35 × crowd_quality +
  0.25 × reliability_score
```

**Detail setiap komponen:**
- `normalized_time` = `1 - (travel_time_minutes / 120)` clamped ke [0, 1]. Asumsi: 120 menit adalah worst-case buat Jakarta.
- `normalized_cost` = `1 - (cost_idr / 15000)` clamped ke [0, 1]. Asumsi: Rp 15.000 adalah worst-case (multi-transfer).
- `crowd_quality` = mapping dari `crowd_level`:
  - `"low"` → 1.0 (baik)
  - `"moderate"` → 0.5 (sedang)
  - `"high"` → 0.0 (buruk)
  - `undefined` → 0.5 (netral, belum ada data)
- `reliability_score` = nilai dari Task 05:
  - `score: 0.9` (risk "low") → 0.9
  - `score: 0.5` (risk "medium") → 0.5
  - `score: 0.1` (risk "high") → 0.1
  - `undefined` → 0.5 (netral, belum ada data)

**Sorting final**: urut `RouteCandidate[]` dalam response `/routes` by `recommendation_score` descending (tertinggi duluan).

**Dokumentasi rumus**: semua konstanta (bobot, threshold) harus di-comment dengan penjelasan singkat kenapa nilai itu dipilih — bukan magic number tanpa konteks.

## Batasan eksplisit

- Jangan fine-tune atau train model apapun — pure API call, pakai bobot yang sudah ada.
- Jangan integrasikan dengan Model 0 (CV) — asisten ini cuma jawab soal rute/jadwal, bukan soal kepadatan real-time dari video.
- Jangan buat sistem memory/history pertanyaan panjang — simple stateless: satu pertanyaan, satu jawaban, nggak perlu "remember" dari pertanyaan sebelumnya.
- Jangan buat chat UI baru — ini hanya API endpoint, bukan komponen React. Frontend bisa nanti pakai endpoint ini kalau mau integrate ke UI.

## Acceptance criteria

### Bagian A: LLM Assistant
- Endpoint `/assistant/ask` dengan request `{ question: "dari Blok M ke Kota naik apa?" }` menghasilkan jawaban natural language yang benar — verifikasi manual dengan 3–5 pertanyaan yang sudah direncanakan (biar saat demo, jawaban sudah pasti benar, tidak ada surprise).
- OpenRouter API key berhasil terpakai, response lolos parsing.
- Error path: timeout/gagal koneksi ke OpenRouter → response 502 dengan pesan jelas (bukan 500 generic).
- Catatan di README tentang API key setup (jangan hardcode di kode, gunakan env var `OPENROUTER_API_KEY`).

### Bagian B: Recommendation Score
- Untuk 3 rute AC (Blok M–Kota, Kalideres–PGC, Grogol–Kampung Melayu), `recommendation_score` terisi dan rute di-sort berdasarkan skor ini. Verifikasi manual bahwa urutan rute di response `/routes` masuk akal (mis. rute dengan kepadatan rendah + reliabilitas tinggi ranked lebih tinggi daripada kepadatan tinggi + reliabilitas rendah).
- `tsc --noEmit` lolos, nggak ada type error dari penambahan scoring logic.

---

## OpenRouter Setup (Info tambahan, bukan bagian task)

1. Daftar akun di openrouter.ai (gratis).
2. Buat API key di dashboard.
3. Tentukan model (rec: `anthropic/claude-3-5-haiku`), verifikasi pricing di dashboard.
4. Set env var `OPENROUTER_API_KEY=sk_...` di `.env` backend.
5. Test manual sekali pake curl buat pastikan auth bekerja sebelum ngerjain task — jangan asumsikan akan jalan di kode, cek dulu.

Pricing untuk Haiku di OpenRouter kira-kira **$0.80 per juta input token, $2.40 per juta output token** — artinya untuk pertanyaan + jawaban ringkas rata-rata 500 input token + 200 output token, itu sekitar $0.0008 per call, atau ~1000 call per $1. Cukup murah buat volume testing & demo.
