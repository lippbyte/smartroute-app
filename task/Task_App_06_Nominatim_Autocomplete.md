# Task App-06: Autocomplete Lokasi via Nominatim (Debounced)

**Assignee:** Lippable
**Prasyarat:** Task App-05 selesai (auto-isi lokasi via GPS).

## Tujuan

Tambah saran lokasi otomatis (autocomplete) yang muncul sambil user mengetik di field "Dari"/"Tujuan" — mirip pengalaman Gojek/Google Maps, tapi tetap pakai Nominatim (gratis) dengan debounce yang hati-hati, bukan pindah ke Google Places.

## Konteks

`geocode.ts` yang ada sekarang cuma geocode sekali tembak (user ketik nama lengkap, submit, baru dapat satu koordinat) — bukan saran yang muncul sambil mengetik. Nominatim membatasi maksimal 1 request/detik, jadi autocomplete di sini **wajib** di-debounce dengan benar, tidak boleh menembak request tiap ketukan huruf.

## Lingkup

- Tambah fungsi baru di `geocode.ts` (atau file baru `autocomplete.ts`), misal `searchPlaceSuggestions(query: string)`, yang memanggil endpoint pencarian Nominatim (`/search` dengan `limit=5` misalnya) dan mengembalikan beberapa hasil (bukan cuma satu seperti `geocodePlace` yang sudah ada).
- Di komponen input "Dari"/"Tujuan": tampilkan dropdown/list saran di bawah field, update setiap user mengetik — **tapi baru kirim request ke Nominatim setelah user berhenti mengetik ~500ms–800ms** (debounce), bukan tiap huruf.
- Batalkan (`abort`) request sebelumnya kalau user lanjut mengetik sebelum request lama selesai — supaya tidak ada hasil "telat" yang muncul salah.
- Tap salah satu saran → isi field dengan nama tempat itu dan simpan koordinatnya (reuse cache yang sudah ada di `geocode.ts` kalau relevan).
- State kosong (belum ada hasil, atau user belum ketik apa-apa) dan state loading (spinner kecil saat menunggu hasil) ditangani dengan jelas — jangan biarkan dropdown kosong tanpa keterangan.

## Batasan eksplisit

- **Jangan pindah ke Google Places API** — tetap Nominatim, sesuai keputusan (menghindari credential baru + billing setup di tengah waktu yang mepet).
- Jangan hilangkan `geocodePlace()` yang sudah ada — itu tetap dipakai untuk kasus lain (misal isi otomatis dari GPS di App-05). Task ini menambah fungsi baru untuk saran multi-hasil, bukan mengganti yang lama.
- Jangan kirim request Nominatim untuk query yang terlalu pendek (misal <3 karakter) — buang-buang kuota request untuk hasil yang biasanya tidak berguna.
- Tetap patuhi `User-Agent` header dan throttle yang sudah ada di `geocode.ts` — jangan hilangkan itu demi "biar cepat".

## Acceptance criteria

- Mengetik di field "Dari"/"Tujuan" menampilkan saran lokasi setelah jeda singkat berhenti mengetik (bukan per-huruf) — diverifikasi dengan mengetik cepat dan memastikan tidak ada request berlebihan terkirim (cek network tab/log).
- Tap saran mengisi field dan koordinatnya benar (diverifikasi dengan search rute setelahnya, hasilnya masuk akal).
- Mengetik lalu cepat mengganti kata kunci tidak menampilkan hasil dari request lama yang sudah usang.
- Query terlalu pendek (<3 karakter) tidak memicu request ke Nominatim.
