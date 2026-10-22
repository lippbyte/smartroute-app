# Task Backend-09: Endpoint Daftar Semua Halte TransJakarta

**Assignee:** Lippable

## Tujuan

Ubah Peta Kepadatan supaya menampilkan **semua** halte TransJakarta (bukan cuma yang ada laporan aktif) — laporan kepadatan jadi info tambahan di atas halte yang sudah ada, bukan syarat halte itu muncul di peta.

## Konteks

Backend-08 sengaja cuma menampilkan halte dengan laporan aktif (waktu itu fokusnya ke fix ID matching, bukan kelengkapan tampilan). Sekarang keputusan produk berubah — peta harus tetap bisa dibrowse meski belum ada laporan sama sekali, seperti peta transit pada umumnya.

## ⚠️ WAJIB diverifikasi dulu sebelum implementasi penuh

Temuan Backend-08: OTP2 mengembalikan **7.819 stop total** tanpa filter. Belum dikonfirmasi berapa dari itu yang genuinely "halte TransJakarta" yang relevan — bisa jadi mayoritas memang TransJakarta (karena cuma itu GTFS yang dimuat), dan angkanya tetap besar karena banyak koridor + arah + varian feeder.

**Sebelum membangun apa pun, cek dulu:**
- Berapa jumlah stop kalau difilter ke yang dilayani rute TransJakarta (routes bermoda BUS dari GTFS yang dimuat)?
- **Kalau hasilnya masih ribuan** (bukan ratusan seperti diharapkan) — **laporkan balik dan berhenti**, jangan lanjut implementasi. Diskusikan dulu strategi filter tambahan (misal cuma halte koridor utama/BRT, bukan semua feeder) sebelum lanjut.

## Lingkup (lanjutkan HANYA setelah verifikasi di atas menghasilkan angka yang masuk akal untuk satu peta HP — idealnya ratusan, bukan ribuan)

- Endpoint baru (atau modifikasi endpoint yang ada): list semua halte TransJakarta hasil filter, masing-masing menyertakan `gtfsId`, `name`, `lat`, `lon`, dan `crowd_level` (`null`/`undefined` kalau belum ada laporan, terisi kalau ada).
- Ini gabungan dari 2 sumber: daftar halte lengkap (dari OTP2, sudah difilter) + status kepadatan (dari `crowdDensity` service yang sudah ada) — **join data yang ada**, jangan bikin ulang logic kepadatan.

## Batasan eksplisit

- **Jangan lanjut ke implementasi kalau hasil investigasi jumlah stop masih terlalu banyak** — laporkan dan berhenti, tunggu keputusan filter tambahan.
- Jangan ubah cara `crowdDensity`/`routing.ts` bekerja — ini murni soal daftar halte mana yang ditampilkan di peta, bukan soal logic scoring/matching yang sudah benar.

## Acceptance criteria

- Laporan jelas soal jumlah halte hasil filter TransJakarta, **sebelum** lanjut ke implementasi apa pun.
- Kalau lanjut: endpoint baru mengembalikan semua halte TransJakarta dengan `crowd_level` `null` untuk yang belum ada data, terisi untuk yang ada.
