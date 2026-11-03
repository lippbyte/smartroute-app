# Tabel Faktor GreenOps per Kendaraan-km

**Status: DRAF, menunggu persetujuan Khalifa.** Selama `FACTORS_APPROVED` di `smartroute-dashboard/src/greenops/greenopsFactors.ts` bernilai `false`, dashboard menampilkan penanda draf.

**Ringkasnya:** dari 8 moda, 4 punya faktor dan 4 “tidak tersedia”. **Tidak ada faktor yang berkekuatan “kuat”.** Bus paling kokoh; angka KRL dan MRT lemah dan paling butuh verifikasi.

## Keputusan yang diminta

1. **Setujui, ubah, atau tolak tabel ini.** Bila disetujui, ubah `FACTORS_APPROVED` menjadi `true`.
2. **Selisih besar dengan faktor per penumpang-km** (bagian 4), terutama KRL dan MRT. Angka lama tidak saya ubah.
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

## 4. Konsistensi dengan faktor per penumpang-km yang sudah ada

Faktor lama: MRT 19, LRT 19, KRL 41, bus 36 g/pkm. **Faktor lama tidak diubah.**

| Moda | g/km baru | g/pkm lama | Penumpang tersirat (g/km ÷ g/pkm) | Porsi kapasitas | g/pkm baru pada okupansi 50% | Selisih dari lama |
|---|---:|---:|---:|---:|---:|---:|
| MRT | 30.659 | 19 | 1.614 | 83% | 31,4 | +65% |
| KRL | 15.535 | 41 | 379 | 19% | 15,5 | -62% |
| BRT | 1.236 | 36 | 34 | 69% | 49,4 | +37% |

**Penjelasan:**

- **BRT paling masuk akal.** Studi LCA di balik angka 36 mengasumsikan okupansi ±50%, dan selisihnya bisa dijelaskan oleh perbedaan metode dan armada.
- **MRT tinggi** kemungkinan karena listrik seluruh sistem dan faktor jaringan 870. Dengan ±26,8 kWh/km dan 680 g/kWh, angka okupansi 50% turun menjadi ±18,7 g/pkm, cocok dengan angka lama. Ini menandakan selisihnya berasal dari asumsi, tetapi bukan bukti bahwa salah satunya benar.
- **KRL arahnya terbalik.** Angka lama 41 g adalah batas atas klaim perusahaan (19-41 g), sedangkan 17,856 kWh/km mungkin hanya mencakup sebagian konsumsi. Keduanya lemah.

**Akibatnya:** panel per penumpang-km di dashboard bisa menampilkan angka yang berbeda dari kartu CO₂ di app mobile, misalnya KRL 16 g berbanding 41 g pada okupansi 50%. Ini perlu keputusan sebelum keduanya diperlihatkan berdampingan ke investor.

## 5. Yang belum diverifikasi

- Hanya abstrak: skripsi UGM (KRL).
- Tidak bisa dibuka alat otomatis, perlu dibuka manual: laporan keberlanjutan MRT Jakarta, makalah Unpam, tabel Ditjen Ketenagalistrikan.
- Sumber yang tertulis di modul ini telah dibuka, kecuali yang bertanda `openedFullText: false` (UGM).
- Halaman [hasil ICCT](https://theicct.org/publication/analysis-of-zero-emission-bus-in-transjakarta-fleet-feb24/) menolak alat saya, tetapi PDF-nya terunduh dan terbaca.
