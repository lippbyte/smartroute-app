# Task Backend-13: Verifikasi & Perbaiki Akurasi Tarif dari GTFS Resmi

**Assignee:** Lippable

## Tujuan

Cek `fare_attributes.txt` dan `fare_rules.txt` dari GTFS TransJakarta resmi (sekarang sudah terlihat isinya lewat spreadsheet yang dibagikan Bayu) — pastikan tarif yang ditampilkan aplikasi (saat ini flat Rp3.500) memang sesuai data resmi, atau ternyata ada struktur tarif lebih detail yang belum dipakai.

## Konteks

Keputusan flat Rp3.500 diambil di awal proyek sebagai simplifikasi. Sekarang ada akses ke isi `fare_attributes.txt`/`fare_rules.txt` yang asli — saatnya dicek apakah simplifikasi itu masih akurat, atau perlu diperbaiki supaya tarif yang ditampilkan lebih sesuai kenyataan.

## Lingkup

- Baca `fare_attributes.txt` dan `fare_rules.txt` dari file GTFS TransJakarta yang **sudah dimuat backend** (bukan dari spreadsheet Bayu langsung — itu cuma salinan untuk dibaca manual, pakai file asli yang jadi sumber OTP2).
- Bandingkan dengan implementasi flat Rp3.500 yang sekarang dipakai — apakah GTFS resmi memang mendefinisikan tarif flat, atau ada variasi (misal beda per rute, jarak, atau waktu)?
- **Kalau GTFS memang mendefinisikan flat rate yang sama** — tidak perlu ubah kode, cukup didokumentasikan bahwa ini sudah terkonfirmasi benar dari sumber resmi (bukan asumsi lagi seperti sebelumnya).
- **Kalau ternyata ada struktur lebih detail** — laporkan dulu detailnya sebelum mengubah kode apa pun, supaya dampaknya ke tampilan/logic yang sudah ada bisa didiskusikan dulu.

## ⚠️ Cek tambahan — kemungkinan bug pada rute tanpa naik TransJakarta

Sebagian hasil pencarian rute bisa berupa **opsi jalan kaki murni** (tidak naik moda apa pun — sudah pernah muncul di pengujian sebelumnya, misal "109 menit jalan kaki" sebagai salah satu opsi). **Cek apakah tarif yang ditampilkan untuk opsi semacam ini benar Rp0, atau keliru ikut menampilkan Rp3.500** seperti opsi yang benar-benar naik TransJakarta.

- Telusuri `routing.ts`: apakah logic tarif membedakan rute yang punya minimal satu leg bermoda TRANSIT (kena tarif) vs rute yang isinya cuma leg WALK (harusnya Rp0)?
- Laporkan temuan dengan jelas sebelum memperbaiki — sertakan contoh konkret (skenario rute apa yang menunjukkan gejala ini, kalau ada).

## Batasan eksplisit

- Jangan ubah logic tarif tanpa laporan temuan dulu — kalau ternyata strukturnya lebih kompleks dari flat rate, atau ditemukan bug tarif di rute jalan-kaki, itu perlu keputusan sadar sebelum diimplementasikan, bukan langsung diubah.

## Acceptance criteria

- Laporan jelas: tarif flat Rp3.500 terkonfirmasi sesuai `fare_attributes.txt`/`fare_rules.txt` resmi, **atau** ditemukan struktur lebih detail yang perlu didiskusikan sebelum diimplementasikan.
- Laporan jelas soal rute jalan-kaki murni: tarifnya sudah benar Rp0, atau ditemukan bug menampilkan Rp3.500 secara keliru — kalau ditemukan bug, perbaiki dan verifikasi ulang.
