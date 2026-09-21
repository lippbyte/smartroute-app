// src/data/mrtLrtStations.ts
//
// Task Backend-11: data statis stasiun MRT & LRT Jakarta — tidak ada GTFS
// publik untuk keduanya (beda dari TransJakarta/JakLingko yang sudah dimuat
// OTP2), jadi dikurasi manual dan dicross-check ke sumber jelas per
// batasan eksplisit task ("jangan asumsi angka tanpa cek").
//
// SUMBER & METODE VERIFIKASI (dicek langsung, bukan dari ingatan):
// - Jumlah & urutan stasiun: WebSearch ke berita/situs resmi jakartamrt.co.id
//   dan artikel berita peresmian LRT (CNN Indonesia, Kompas, ANTARA) per
//   tanggal pengerjaan task ini.
// - Koordinat: OpenStreetMap Overpass API, query terstruktur
//   node["railway"="station"]["network"="MRT Jakarta"/"LRT Jakarta"] —
//   BUKAN pencarian teks Nominatim yang fuzzy (banyak nama stasiun MRT
//   punya suffix sponsor yang sering berganti dan tidak selalu match).
//   5 stasiun LRT yang baru dibuka (belum konsisten ke-tag network di OSM)
//   diverifikasi via Nominatim dengan match eksplisit "Stasiun LRT <nama>"
//   di display_name-nya, dan disilangkan ke landmark independen (Taman
//   Proklamasi) untuk stasiun yang jaraknya terlihat janggal.
//
// MRT JAKARTA — 13 stasiun, jalur Utara-Selatan (Lebak Bulus <-> Bundaran
// HI), SATU-SATUNYA jalur yang beroperasi saat ini. Fase 2A (7 stasiun
// baru: Thamrin, Monas, Harmoni, Sawah Besar, Mangga Besar, Glodok, Kota)
// SENGAJA TIDAK dimasukkan — masih konstruksi, target operasi 2027/2029,
// memasukkannya akan menyesatkan (mengarahkan user ke stasiun yang belum
// menerima penumpang).
//
// LRT JAKARTA — 11 stasiun, jalur Kelapa Gading <-> Manggarai. Perpanjangan
// Velodrome-Manggarai (5 stasiun baru: Rawamangun, Pramuka, Matraman,
// Proklamasi, Manggarai) DIMASUKKAN — sudah diresmikan Presiden 26 Agustus
// 2026 dan beroperasi penuh 05.00-24.00 WIB (dikonfirmasi lewat berita
// peresmian, bukan cuma "ditargetkan"). Catatan: ini "LRT Jakarta" (operator
// PT LRT Jakarta/Jakpro) — BEDA dari "LRT Jabodebek" (operator KAI, jalur
// Cawang-Dukuh Atas-Harjamukti-Jatimulya dst.), yang tidak termasuk scope
// task ini.
export interface StaticTransitStation {
  name: string;
  lat: number;
  lon: number;
}

export const MRT_STATIONS: StaticTransitStation[] = [
  { name: "Lebak Bulus", lat: -6.2892744, lon: 106.7749355 },
  { name: "Fatmawati", lat: -6.2924511, lon: 106.7924644 },
  { name: "Cipete Raya", lat: -6.2783596, lon: 106.7973159 },
  { name: "Haji Nawi", lat: -6.2666947, lon: 106.7973262 },
  { name: "Blok A", lat: -6.2557793, lon: 106.7971403 },
  { name: "Blok M", lat: -6.2444643, lon: 106.7981332 },
  { name: "ASEAN", lat: -6.2387737, lon: 106.7984457 },
  { name: "Senayan", lat: -6.2267337, lon: 106.8024926 },
  { name: "Istora Mandiri", lat: -6.22239, lon: 106.8086229 },
  { name: "Bendungan Hilir", lat: -6.2150263, lon: 106.8179484 },
  { name: "Setiabudi", lat: -6.2090648, lon: 106.8216945 },
  { name: "Dukuh Atas", lat: -6.2007957, lon: 106.822788 },
  { name: "Bundaran HI", lat: -6.1918644, lon: 106.8230084 },
];

export const LRT_STATIONS: StaticTransitStation[] = [
  { name: "Kelapa Gading", lat: -6.1572135, lon: 106.9142091 },
  { name: "Boulevard Utara", lat: -6.1594082, lon: 106.906024 },
  { name: "Boulevard Selatan", lat: -6.1691934, lon: 106.8998732 },
  { name: "Pulomas", lat: -6.1773105, lon: 106.8933929 },
  { name: "Equestrian", lat: -6.1835534, lon: 106.8913536 },
  { name: "Velodrome", lat: -6.1921316, lon: 106.8911771 },
  { name: "Rawamangun", lat: -6.1931512, lon: 106.882571 },
  { name: "Pramuka", lat: -6.1920211, lon: 106.8707263 },
  { name: "Matraman", lat: -6.2021682, lon: 106.8501232 },
  { name: "Proklamasi", lat: -6.203243, lon: 106.8494169 },
  { name: "Manggarai", lat: -6.2086283, lon: 106.8456205 },
];
