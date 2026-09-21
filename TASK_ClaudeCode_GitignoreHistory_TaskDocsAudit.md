# TASK Claude Code — SmartRoute AI
## Histori .gitignore feed TJ + Audit keamanan dokumen task/

Dua item terbuka dari sesi sebelumnya (commit 97dc362, 269e90d, e452530). Keduanya investigasi + laporan, bukan perubahan kode. Jangan commit apa pun di Task 2 tanpa laporan ini diperiksa dulu.

---

## TASK 1 — Histori aturan `.gitignore` lama untuk `transjakarta_gtfs.zip`

Sebelumnya `backend/otp2-setup/.gitignore` mengabaikan `data/transjakarta_gtfs.zip`. Aturan itu sudah dihapus dan filenya sudah di-commit (269e90d), tapi alasan aslinya belum diketahui.

1. `git log --follow -p -- backend/otp2-setup/.gitignore` (atau path yang sesuai) — cari commit yang menambahkan baris itu pertama kali.
2. Baca pesan commit-nya utuh. Kalau ada penjelasan (ukuran repo, kebijakan artefak besar, dll.), kutip apa adanya — jangan disimpulkan atau diparafrase jadi terdengar lebih meyakinkan dari aslinya.
3. Kalau pesan commit tidak menjelaskan apa-apa (cuma "add gitignore" generik), cek juga apakah commit yang sama menambahkan aturan serupa untuk file lain — itu bisa jadi petunjuk apakah aturan ini memang kebijakan umum ("semua artefak besar diabaikan") atau khusus untuk file ini.
4. Kalau tidak ketemu apa-apa yang bermakna, laporkan itu apa adanya: "tidak ada alasan tertulis di histori git."

Jangan menghubungi siapa pun atau menebak — ini murni baca histori git.

---

## TASK 2 — Audit keamanan dokumen `task/` sebelum keputusan tracking

35 dokumen di `task/` (di luar runbook yang sudah di-commit di e452530) masih belum dilacak git. Salah satu judulnya `Task_Security_01_API_Key_Audit.md` — kemungkinan berisi kunci asli.

1. **Baca `Task_Security_01_API_Key_Audit.md` lebih dulu, sendirian.** Cari pola kunci/token/kredensial nyata: `sk-`, `sk-ant-`, `ghp_`, `AIza`, `Bearer `, string panjang acak setelah `key=`/`token=`/`password=`/`secret=`, atau nilai yang cocok dengan format API key OpenRouter/Anthropic/Google yang dipakai proyek ini.
2. **Untuk 34 dokumen lain**, jalankan pemindaian pola yang sama (grep/regex) — jangan baca satu-satu secara manual kalau tidak perlu, cukup cari kecocokan pola.
3. **Jangan tampilkan nilai kredensial asli di laporanmu ke saya.** Kalau ketemu sesuatu yang cocok pola, laporkan nama file + nomor baris + jenis kredensial yang terlihat (mis. "baris 42: terlihat seperti OpenRouter API key"), bukan nilainya.
4. **Jangan commit apa pun di `task/` dalam task ini** — ini audit dan laporan saja, keputusan tracking menunggu saya baca hasilnya.

Laporkan sebagai dua daftar:
- Dokumen yang aman untuk di-commit langsung (tidak ada pola kredensial ditemukan)
- Dokumen yang mengandung sesuatu yang terlihat seperti kredensial, dengan lokasi baris (bukan nilainya)

---

## Yang saya minta di laporan akhir

1. Task 1: kutipan pesan commit asli (atau "tidak ada alasan tertulis")
2. Task 2: dua daftar dokumen di atas
