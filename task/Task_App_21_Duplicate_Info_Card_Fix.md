# Task App-21: Perbaiki Kartu "Informasi" Duplikat di Beranda

**Assignee:** Lippable

## Tujuan

Kartu "Lalu Lintas" di bagian "Informasi" Beranda muncul 2x dengan teks identik — perbaiki duplikasi ini, dan pastikan teksnya jujur sebagai info ilustratif statis, bukan terkesan data real-time (karena memang bukan, dan tidak ada sumber data real-time yang bisa dipakai untuk ini).

## Lingkup

- Cari penyebab kartu "Lalu Lintas" dirender 2x (kemungkinan data statis di-loop dari array yang salah, atau komponen dipanggil dua kali).
- Perbaiki jadi muncul 1x saja.
- Pertimbangkan ubah teksnya sedikit supaya tidak terkesan real-time (misal dari "beroperasi normal pagi ini" jadi framing yang lebih jelas ini info umum/ilustratif, bukan status langsung saat ini).

## Batasan eksplisit

- Jangan coba buat ini jadi data real-time sungguhan — sudah dikonfirmasi tidak ada sumber data yang bisa dipakai untuk itu (GAPEKA/situs lain sudah dicek, tidak cocok). Ini murni perbaikan bug tampilan + kejujuran teks.

## Acceptance criteria

- Kartu "Lalu Lintas" muncul cuma 1x di Beranda.
- Teksnya tidak menyiratkan data real-time yang sebenarnya tidak ada.
