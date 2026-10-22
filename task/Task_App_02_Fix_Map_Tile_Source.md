# Task App-02: Perbaiki Sumber Tile Peta (Hapus Watermark "API Key Required")

**Assignee:** Lippable
**Prasyarat:** Tidak ada — ini perbaikan cepat, prioritas tinggi (visual bug yang terlihat langsung oleh siapa pun yang buka app).

## Tujuan

Ganti sumber tile peta dari CartoDB (yang sekarang butuh API key dan menampilkan watermark "API KEY REQUIRED" tanpa key) ke OpenFreeMap — gratis, tidak butuh key, dan sudah terbukti render bersih di project dashboard yang disisihkan (`Map3DToggle.tsx`).

## Konteks

Ditemukan dari screenshot layar Peta Kepadatan (Task App-01): peta menampilkan watermark berulang "API KEY REQUIRED — carto.com/basemaps/apikey" di seluruh permukaan peta. Ini bukan bug logic, ini fallback CartoDB waktu key tidak ada. `crowd-map.tsx` reuse teknik Leaflet-in-iframe dari `NavigateMap.web.tsx` — artinya **kemungkinan besar masalah yang sama ada juga di alur pencarian rute utama**, belum pernah ketahuan karena testing sejauh ini fokus ke data, bukan visual peta.

## Lingkup

- Cek style/tile URL yang dipakai di `crowd-map.tsx` — ganti ke OpenFreeMap (cek URL style yang dipakai di dashboard yang disisihkan, `Map3DToggle.tsx`, sebagai referensi konfigurasi yang sudah terbukti jalan).
- **Cek juga `NavigateMap.web.tsx`** — kalau pakai sumber tile yang sama (CartoDB tanpa key), perbaiki juga di sana.
- Setelah diganti, verifikasi visual manual (buka browser, lihat langsung) — bukan cuma cek compile/bundle sukses, itu tidak akan menangkap masalah ini seperti yang sudah terbukti kemarin.

## Batasan eksplisit

- Jangan ganti library peta (tetap Leaflet-in-iframe untuk web) — ini cuma ganti sumber tile, bukan rewrite arsitektur.
- Jangan sentuh peta native (`NavigateMap.native.tsx`) di task ini — itu style-nya beda (MapLibre RN langsung, bukan iframe), dicek terpisah kalau memang ada masalah serupa.

## Acceptance criteria

- Peta di `/crowd-map` render bersih tanpa watermark "API KEY REQUIRED", diverifikasi dengan screenshot/observasi langsung di browser.
- Peta di alur pencarian rute utama (pakai `NavigateMap.web.tsx`) dicek juga — kalau ada masalah sama, diperbaiki; kalau ternyata beda sumber tile dan tidak bermasalah, dicatat sebagai temuan (bukan diasumsikan aman tanpa dicek).
