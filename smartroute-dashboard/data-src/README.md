# Data jaringan dashboard Moda

`public/data/network.json` dibangun dari:

| Bagian | Sumber | Lisensi |
|---|---|---|
| Rute, halte, geometri, dan frekuensi bus/BRT | GTFS TransJakarta, `backend/otp2-setup/data/transjakarta_gtfs.zip` | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), © PT Transportasi Jakarta |
| Geometri rel (`rail_segments.json`) | Ekstrak OpenStreetMap `jabodetabek.osm.pbf` (4 Sep 2026) | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), © OpenStreetMap contributors ([hak cipta](https://www.openstreetmap.org/copyright)) |
| Jadwal dan stasiun rel | GTFS KRL, MRT, LRT Jabodebek di `backend/otp2-setup/data/`, disusun tim dari jadwal terbitan umum; koordinat stasiun dari OpenStreetMap | Koordinat ODbL 1.0. Lisensi jadwal belum dipastikan. |

## Kewajiban ODbL

Geometri rel adalah basis data turunan OpenStreetMap. Selama ditampilkan atau dibagikan:

- Cantumkan “© OpenStreetMap contributors” dan tautan ke halaman hak cipta OSM. Sudah ada di atribusi peta dan dialog Tentang & Atribusi.
- Tawarkan data turunan di bawah ODbL. `rail_segments.json` dan `network.json` tersedia di repo, dan dialog Tentang menautkan unduhannya.
- Geometri ini tidak disalin dari bundel aplikasi mana pun.

## Membangun ulang

```bash
# Hanya jika ekstrak OSM atau daftar stasiun berubah. Butuh `pip install osmium`.
# jabodetabek.osm.pbf tidak terlacak di git karena ukurannya 165 MB.
python scripts/extract_rail_geometry.py ../backend/otp2-setup/data

# Tanpa dependensi tambahan.
python scripts/build_network.py
```

Lama berhenti di `scripts/build_network.py` harus sama dengan `src/simulation/constants.ts`.
