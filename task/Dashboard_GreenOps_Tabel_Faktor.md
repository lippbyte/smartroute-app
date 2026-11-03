**DRAF, BELUM DISETUJUI**

# Tabel Faktor GreenOps per Kendaraan-km

**Status: DRAF, menunggu persetujuan Khalifa.** `FACTORS_APPROVED` di `smartroute-dashboard/src/greenops/greenopsFactors.ts` bernilai `false`, panel GreenOps tersembunyi di balik `VITE_GREENOPS_ENABLED`, dan rute `/moda` di balik `VITE_MODA_ENABLED`, keduanya mati secara bawaan. Saat mati, tidak ada angka faktor di bundel yang terkirim ke peramban. Angka faktor tetap ada di kode sumber dan dokumen ini.

**Ringkasnya:** dari 8 moda, 4 punya faktor dan 4 “tidak tersedia”. **Tidak ada faktor yang berkekuatan “kuat”.** Bus paling kokoh; angka KRL dan MRT lemah dan paling butuh verifikasi.

## Keputusan yang diminta

1. **Setujui, ubah, atau tolak tabel ini.** Bila disetujui: ubah `FACTORS_APPROVED` menjadi `true` beserta ujinya, dan nyalakan `VITE_MODA_ENABLED` serta `VITE_GREENOPS_ENABLED` saat build.
2. **Pilih salah satu opsi di bagian 4 untuk selisih dengan angka app.** Angka lama tidak saya ubah.
3. **Faktor listrik 870 g/kWh atau rata-rata jaringan?** Bagian 2 menjelaskan pengaruhnya.

## 1. Tabel per moda

| Moda | Energi per kendaraan-km | Emisi (g CO₂/km) | Kapasitas | Kekuatan | Status |
|---|---:|---:|---:|---|---|
| MRT Jakarta | 35,24 kWh | 30.659 | 1.950 | Lemah | `TODO:verifikasi` |
| LRT Jakarta | tidak tersedia | tidak tersedia | 270 | — | Tidak dihitung |
| LRT Jabodebek | tidak tersedia | tidak tersedia | 1.308 (padat) | — | Tidak dihitung |
| KRL Commuter Line | 17,856 kWh | 15.535 | 2.000 | Lemah | `TODO:verifikasi` |
| Whoosh | tidak tersedia | tidak tersedia | — | — | Tidak dihitung |
| BRT TransJakarta | 0,478 liter | 1.236 | 50 | Sedang | `TODO:verifikasi` |
| Bus besar non-BRT | 0,478 liter | 1.236 | 50 | Lemah (proksi BRT) | `TODO:verifikasi` |
| Bus kecil / Mikrotrans | tidak tersedia | tidak tersedia | — | — | Tidak dihitung |

Satuan emisi di sini **CO₂**, bukan CO₂e seperti yang diminta dokumen tugas: CH₄ dan N₂O tidak dihitung pada diesel, dan tabel listrik JCM dinyatakan dalam tCO₂/MWh.

## 2. Faktor bahan bakar dan listrik

| Faktor | Nilai | Cara hitung | Sumber | Kekuatan |
|---|---:|---|---|---|
| Listrik Jawa-Madura-Bali | 870 g CO₂/kWh | Dikutip | [GEC, tabel JCM Reiwa 4 (2022), lampiran 2, baris 22 Jamali](https://gec.jp/innovation/R4/T.CO2EmissionFactor_20220406.pdf) | Sedang |
| Solar | 2.584,9 g CO₂/L | 74,1 g/MJ × 9,69 kWh/L × 3,6 MJ/kWh | [IPCC 2006 Vol. 2 Bab 3 Tabel 3.2.1](https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_3_Ch3_Mobile_Combustion.pdf) dan [ICCT 2024 h.13](https://theicct.org/wp-content/uploads/2024/01/ID-44-%E2%80%93-Transjakarta-TCO-Working-Paper-A4-50108-PUBLIC-fv-1.pdf) | Kuat untuk faktor IPCC, asumsi untuk campuran |

**Tentang 870 g/kWh.** Nilai ini dari tabel program JCM untuk menilai proyek, bukan rata-rata jaringan. Situs pihak ketiga mencatat rata-rata Indonesia lebih rendah: [Inzonex, ±680 g/kWh (2024)](https://inzonex.co.uk/poweratlas/indonesia/) dan [LowCarbonPower, 625 g/kWh (2023)](https://www.lowcarbonpower.org/region/Indonesia), keduanya nasional dan belum saya periksa ke data asalnya. Dengan 680 g/kWh, emisi rel turun ±22%. Saya memakai 870 karena dokumen tugas meminta angka Jawa-Bali yang bisa dikutip. Dokumen primer Ditjen Ketenagalistrikan tidak bisa dibuka alat saya (`TODO:verifikasi`).

**Tentang solar.** Porsi biodiesel tidak dikurangkan, sehingga cenderung atas. ICCT menghitung B20, sedangkan solar Indonesia saat ini mengandung biodiesel lebih tinggi.

## 3. Rincian per moda

### MRT Jakarta: 35,24 kWh/km-kereta (lemah)

- **Diturunkan, bukan dikutip.** [Listrik Indonesia (21 Jul 2023)](https://listrikindonesia.com/detail/11359/efisiensi-energi-cara-mrt-jakarta-dukung-zero-emisi): “10 persen (5.000 MWh) penggunaan listrik MRT Jakarta” pada 2022, jadi total ±50.000 MWh per tahun.
- **Pembagi:** 1.418.853 km-kereta per tahun dari GTFS kita (27.192 km/minggu × 365,25 ÷ 7; diulang oleh uji otomatis).
- **Asumsi:** listrik mencakup **seluruh sistem** (stasiun bawah tanah, depo), jadi cenderung atas untuk per kereta. Listrik 2022 dibagi jadwal 2026.
- **Pembanding yang tidak dipakai:** [makalah Unpam](https://openjournal.unpam.ac.id/index.php/SNH/article/view/16488) menurut hasil pencarian menyebut 3.163.654 kWh/bulan sebelum pandemi, atau ±26,8 kWh/km. Situsnya menolak alat saya, jadi tidak saya baca langsung.
- **Yang menyelesaikan ini:** laporan keberlanjutan PT MRT Jakarta. [Berkas 2023](https://jakartamrt.co.id/sites/default/files/2024-09/Medium_SR%20MRT%202023%2013%20Aug.pdf) ada, tetapi situsnya menolak alat saya. Perlu dibuka manual untuk memeriksa listrik dan km-kereta.

### KRL Commuter Line: 17,856 kWh/km (lemah)

- [Skripsi UGM, A. A. Yulanto (2015)](https://etd.repository.ugm.ac.id/penelitian/detail/93343): “tiap KRL mengonsumsi energi sebesar 17,856 kWh/km”.
- **Hanya abstrak yang terbaca.** Tidak jelas per rangkaian atau traksi saja. Rangkaian 8, 10, dan 12 kereta tidak dibedakan.

### BRT TransJakarta: 0,478 L/km (sedang)

- [ICCT, Working Paper Feb 2024](https://theicct.org/wp-content/uploads/2024/01/ID-44-%E2%80%93-Transjakarta-TCO-Working-Paper-A4-50108-PUBLIC-fv-1.pdf), h.14: bus diesel 12 m Euro III di rute 1, 13, 2A, 5 = 4,5; 4,49; 4,94; 4,6 kWh/km. Rata-rata 4,6325 ÷ 9,69 kWh/L = 0,478 L/km.
- **Simulasi berkalibrasi, bukan pengukuran armada.** ICCT melaporkan hasil bus listriknya cocok dengan data uji coba TransJakarta (0,9-1,0 kWh/km), tetapi itu untuk bus listrik.
- **Armada campuran tidak dibedakan:** CNG, listrik, dan bus gandeng 18 m memakai angka ini. Bus listrik sendiri ±1 kWh/km, atau ±870 g/km pada faktor di atas.
- **Pembanding:** hasil pencarian menyebut 2,03 km/L (0,493 L/km) untuk armada 12 m, selisih ±3%. Dokumen asal angka itu belum saya pastikan, jadi tidak dipakai.

### Bus besar non-BRT: proksi BRT (lemah)

Kategori GTFS Angkutan Umum Integrasi, Transjabodetabek, Royaltrans, Rusun, dan Bus Wisata memuat juga bus lebih kecil dan pola berhenti yang berbeda. Angka ini bisa terlalu tinggi untuk sebagian rute.

### Tidak tersedia

- **Mikrotrans:** tidak ada sumber konsumsi bahan bakar armada. **±2.600 kendaraan simulasi tidak ikut total**, jadi total armada di panel lebih rendah dari keseluruhan moda. Panel menyebut ini secara tertulis.
- **LRT Jabodebek:** tidak ada sumber kWh. Proksi MRT pada faktor per penumpang-km sengaja tidak diteruskan, karena ukuran dan berat keretanya berbeda.
- **LRT Jakarta:** satu [makalah](https://www.atlantis-press.com/article/125998504.pdf) hanya memodelkan traksi, tanpa beban lain. Tidak layak jadi faktor. Moda ini juga belum ada di GTFS kita.
- **Whoosh:** tidak ada sumber layak dan tidak ada di data jaringan.

### Kapasitas

Hanya dipakai untuk skenario okupansi.

| Moda | Nilai | Sumber |
|---|---:|---|
| MRT, KRL | 1.950; 2.000 | [CNN Indonesia, 26 Okt 2021](https://www.cnnindonesia.com/ekonomi/20211026164418-92-712642/beda-transportasi-rel-ibu-kota-lrt-mrt-dan-krl) |
| LRT Jabodebek | 1.308 (padat) | [Fortune IDN, 25 Agu 2023](https://www.fortuneidn.com/news/beroperasi-akhir-agustus-begini-cara-naik-lrt-jabodebek-00-my5jv-c3ygsd) |
| LRT Jakarta | 270 | [detikFinance, 16 Des 2023](https://finance.detik.com/infrastruktur/d-7093019/lrt-jakarta-diklaim-nggak-sepi-penumpang-begini-datanya) |
| Bus 12 m | 50 (24 duduk + 26 berdiri) | ICCT 2024 h.21 |

Angka kapasitas rel dari berita, bukan spesifikasi operator (`TODO:verifikasi`). KRL 12 kereta jauh lebih besar dan tidak dibedakan.

## 4. Perbandingan per penumpang-km: dashboard vs app

**Kesimpulannya:** kedua set angka sepakat bahwa angkutan umum jauh di bawah mobil, tetapi **urutan antarmoda terbalik**. Di app: MRT 19 < BRT 36 < KRL 41. Di dashboard pada okupansi 50%: KRL 15,5 < MRT 31,4 < BRT 49,4. Faktor app tidak saya ubah.

### Tabel utama

Angka dashboard = g CO₂/km ÷ (kapasitas nominal × okupansi). Satuan semua angka g per penumpang-km.

| Moda | App | Okupansi di balik angka app | Dashboard 25% | Dashboard 50% | Dashboard 75% | Dashboard 50% vs app | Okupansi agar sama dengan app |
|---|---:|---|---:|---:|---:|---:|---:|
| MRT Jakarta | 19 | ±50%, batas masa COVID-19 | 62,9 | 31,4 | 21,0 | +65% | 83% |
| LRT Jakarta | tidak ada | — | tidak tersedia | tidak tersedia | tidak tersedia | — | — |
| LRT Jabodebek | 19 (proksi MRT) | Sama dengan MRT | tidak tersedia | tidak tersedia | tidak tersedia | — | — |
| KRL Commuter Line | 41 (batas atas klaim) | Tidak disebut sumber | 31,1 | 15,5 | 10,4 | -62% | 19% |
| Whoosh | tidak ada | — | tidak tersedia | tidak tersedia | tidak tersedia | — | — |
| BRT TransJakarta | 36 | ±50%, batas masa COVID-19 | 98,9 | 49,4 | 33,0 | +37% | 69% |
| Bus besar non-BRT | 36 (angka BRT) | Sama dengan BRT | 98,9 | 49,4 | 33,0 | +37% | 69% |
| Mikrotrans | 36 (angka BRT) | Sama dengan BRT | tidak tersedia | tidak tersedia | tidak tersedia | — | — |

Pembanding: mobil 170 di keduanya, karena dashboard memakai faktor app. Motor 100 hanya di app.

**Cara membaca:**

- **“Okupansi yang sama” hanya benar-benar sama untuk MRT dan BRT.** Studi di balik angka app menyebut ±50%, walau basis kapasitasnya belum saya periksa karena teks lengkapnya belum terbaca. Untuk KRL, sumber app tidak menyebut okupansi, jadi kolom 50% hanya asumsi saya.
- **Kolom terakhir** menunjukkan okupansi yang membuat kedua angka sama. MRT butuh 83% dan BRT 69%, lebih tinggi dari ±50% di studi app. KRL hanya 19%.
- **Semua sel tetap di bawah mobil.** Nilai tertinggi 98,9 (bus pada okupansi 25%) berbanding 170.
- **Kapasitas MRT dan KRL berasal dari berita,** dan KRL 12 kereta tidak dibedakan.

### Seberapa peka terhadap asumsi

Okupansi 50%, g per penumpang-km.

| Moda | Dasar | Listrik 680 g/kWh | 26,76 kWh/km | Keduanya |
|---|---:|---:|---:|---:|
| MRT (app 19) | 31,4 | 24,6 | 23,9 | 18,7 |
| KRL (app 41) | 15,5 | 12,1 | — | — |
| BRT (app 36) | 49,4 | tidak berpengaruh | — | — |

- **680 g/kWh** adalah rata-rata nasional dari situs pihak ketiga (bagian 2), belum saya periksa ke data asalnya.
- **26,76 kWh/km** memakai 3.163.654 kWh/bulan dari hasil pencarian atas makalah Unpam yang tidak bisa saya buka.
- **MRT bisa menyamai app, tetapi hanya dengan dua asumsi lemah sekaligus.** Itu menunjukkan selisihnya mungkin berasal dari asumsi, bukan bukti angka mana yang benar.
- **KRL tidak bisa mendekati 41 dengan asumsi ini.** Angka 17,856 kWh/km mungkin hanya sebagian konsumsi, dan 41 adalah batas atas klaim perusahaan. Keduanya lemah.

### Opsi

| Opsi | Akibat | Risiko |
|---|---|---|
| **A. Panel tetap mati, app tetap** | Tidak ada pertentangan yang terlihat | GreenOps tidak bisa dipamerkan |
| **B. Panel menyala tanpa bagian per penumpang-km** | Hanya per kendaraan-km dan energi, tidak bertabrakan langsung dengan app | Angka KRL dan MRT yang lemah tetap tampil |
| **C. Panel menyala lengkap dengan penjelasan selisih** | Paling terbuka | Investor melihat dua angka berbeda untuk moda yang sama |
| **D. Ganti faktor app dengan angka baru** | Satu set angka | Mengubah CO₂ di setiap kartu rute dari sumber lemah; perlu kenaikan `FACTORS_VERSION` dan regresi |

**Rekomendasi: A sekarang, sambil memeriksa dua sumber secara manual:** laporan keberlanjutan MRT Jakarta dan teks lengkap skripsi UGM. Selisih terbesar ada di dua moda yang sumbernya paling lemah, jadi memilih B, C, atau D sebelum itu berarti memutuskan dengan angka yang mungkin berubah. Setelah keduanya terbaca, angka yang lebih kuat bisa menentukan pilihan antara B dan D.

## 5. Yang belum diverifikasi

- Hanya abstrak: skripsi UGM (KRL).
- Tidak bisa dibuka alat otomatis, perlu dibuka manual: laporan keberlanjutan MRT Jakarta, makalah Unpam, tabel Ditjen Ketenagalistrikan.
- Sumber yang tertulis di modul ini telah dibuka, kecuali yang bertanda `openedFullText: false` (UGM).
- Halaman [hasil ICCT](https://theicct.org/publication/analysis-of-zero-emission-bus-in-transjakarta-fleet-feb24/) menolak alat saya, tetapi PDF-nya terunduh dan terbaca.
