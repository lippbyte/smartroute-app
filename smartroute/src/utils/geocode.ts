// src/utils/geocode.ts

import { fetchWithTimeout } from "./withTimeout";

// Nominatim adalah layanan gratis pihak ketiga tanpa jaminan SLA. Di layar
// hasil rute, geocode asal+tujuan berjalan SEBELUM POST /routes — kalau
// Nominatim menggantung, timeout di routeService tidak pernah kebagian
// kesempatan menolong.
const GEOCODE_TIMEOUT_MS = 10_000;
const SUGGESTION_TIMEOUT_MS = 8_000;

export type Coordinate = {
  latitude: number;
  longitude: number;
};

// Cache sederhana di memory, biar nama tempat yang sama
// tidak fetch berulang kali (mengurangi beban ke Nominatim)
const geocodeCache = new Map<string, Coordinate>();

// Cache terpisah untuk arah sebaliknya (koordinat -> nama). Dibulatkan ke 5
// desimal (~1.1m) sebagai key — cukup presisi untuk tujuan cache, dan bikin
// pembacaan GPS yang jitter dikit (kelipatan cm) tetap kena cache yang sama.
const reverseGeocodeCache = new Map<string, string>();

// Antrian sederhana untuk memastikan request Nominatim
// tidak lebih dari 1x per detik (sesuai kebijakan mereka)
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1100; // sedikit di atas 1 detik untuk jaga-jaga

async function throttle() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_INTERVAL_MS - elapsed),
    );
  }
  lastRequestTime = Date.now();
}

/**
 * Geocode satu nama tempat menjadi koordinat lat/lng
 * menggunakan Nominatim (OpenStreetMap), gratis tanpa API key.
 *
 * @param placeName - nama tempat, contoh: "Stasiun Manggarai, Jakarta"
 * @param fallback - koordinat default kalau geocoding gagal (opsional)
 */
export async function geocodePlace(
  placeName: string,
  fallback?: Coordinate,
): Promise<Coordinate | null> {
  // Cek cache dulu
  if (geocodeCache.has(placeName)) {
    return geocodeCache.get(placeName)!;
  }

  try {
    await throttle();

    // Tambahkan konteks "Jakarta, Indonesia" biar hasil lebih akurat
    // untuk nama-nama halte/stasiun yang bisa ambigu
    const query = encodeURIComponent(`${placeName}, Jakarta, Indonesia`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

    const response = await fetchWithTimeout(url, {
      headers: {
        // WAJIB diisi sesuai kebijakan Nominatim — ganti dengan nama app kamu
        "User-Agent": "SmartRouteAI/1.0 (contact: yourgithub-or-email)",
      },
      timeoutMs: GEOCODE_TIMEOUT_MS,
      timeoutMessage: `Geocoding "${placeName}" timeout.`,
    });

    if (!response.ok) {
      throw new Error(`Geocoding gagal: ${response.status}`);
    }

    const results = await response.json();

    if (results.length === 0) {
      console.warn(`Nominatim: tidak ditemukan hasil untuk "${placeName}"`);
      return fallback ?? null;
    }

    const coordinate: Coordinate = {
      latitude: parseFloat(results[0].lat),
      longitude: parseFloat(results[0].lon),
    };

    geocodeCache.set(placeName, coordinate);
    return coordinate;
  } catch (error) {
    console.error(`Error geocoding "${placeName}":`, error);
    return fallback ?? null;
  }
}

// Nominatim's own `display_name` is the full postal-style address ("Jalan
// Palatehan, Blok K, Melawai, Kebayoran Baru, Jakarta Selatan, Daerah
// Khusus Ibukota Jakarta, 12130, Indonesia") — accurate, but nothing like
// the short "Jalan Palatehan, Melawai" style Gojek/Grab/Google Maps show
// (this task's explicit UX target). Reverse's response includes a
// structured `address` object alongside display_name, so we can pick the
// two most locally-relevant fields ourselves — still one Nominatim call,
// no extra dependency.
function buildShortLabel(result: {
  display_name?: string;
  name?: string;
  address?: Record<string, string>;
}): string | null {
  const addr = result.address;
  const primary = addr?.road ?? addr?.pedestrian ?? result.name;
  const area =
    addr?.suburb ?? addr?.village ?? addr?.neighbourhood ?? addr?.city_district ?? addr?.city;

  if (primary && area && primary !== area) return `${primary}, ${area}`;
  if (primary) return primary;
  if (area) return area;
  return result.display_name ?? null;
}

/**
 * Kebalikan dari geocodePlace: koordinat GPS menjadi nama lokasi yang bisa
 * dibaca manusia (dipakai Task App-05 untuk auto-isi field "Dari"). Pakai
 * endpoint /reverse Nominatim yang sama seperti /search — masih layanan
 * gratis-tanpa-key yang sama, throttle & User-Agent yang sama.
 *
 * @param coordinate - koordinat GPS pengguna
 * @returns nama lokasi ringkas ("Jalan ..., <area>"), atau null kalau
 *   gagal/tidak ada hasil sama sekali — pemanggil yang menentukan fallback
 *   (task ini sengaja tidak mengasumsikan satu bentuk fallback untuk semua
 *   pemanggil).
 */
export async function reverseGeocode(
  coordinate: Coordinate,
): Promise<string | null> {
  const cacheKey = `${coordinate.latitude.toFixed(5)},${coordinate.longitude.toFixed(5)}`;
  if (reverseGeocodeCache.has(cacheKey)) {
    return reverseGeocodeCache.get(cacheKey)!;
  }

  try {
    await throttle();

    const url =
      `https://nominatim.openstreetmap.org/reverse?` +
      `lat=${coordinate.latitude}&lon=${coordinate.longitude}&format=json`;

    const response = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "SmartRouteAI/1.0 (contact: yourgithub-or-email)",
      },
      timeoutMs: GEOCODE_TIMEOUT_MS,
      timeoutMessage: "Mencari nama lokasi dari GPS timeout.",
    });

    if (!response.ok) {
      throw new Error(`Reverse geocoding gagal: ${response.status}`);
    }

    const result = await response.json();
    const name = buildShortLabel(result);

    if (!name) {
      console.warn(
        `Nominatim: tidak ada hasil reverse geocode untuk (${coordinate.latitude}, ${coordinate.longitude})`,
      );
      return null;
    }

    reverseGeocodeCache.set(cacheKey, name);
    return name;
  } catch (error) {
    console.error(
      `Error reverse geocoding (${coordinate.latitude}, ${coordinate.longitude}):`,
      error,
    );
    return null;
  }
}

export interface PlaceSuggestion {
  // String Nominatim `display_name` APA ADANYA, tidak diringkas seperti
  // buildShortLabel — ini yang jadi nilai field kalau saran ini di-tap, DAN
  // jadi cache key yang di-priming di bawah. Harus persis sama dengan yang
  // nantinya dikirim ke geocodePlace() di layar hasil rute, supaya cache
  // itu kena (tidak geocode ulang, dan koordinatnya dijamin identik — bukan
  // hasil pencarian top-1 yang berpotensi beda).
  displayName: string;
  // Untuk tampilan dropdown 2-baris ala Gojek/Google Maps: nama jalan/POI
  // tebal di atas, sisa alamat abu-abu di bawah. Dropdown butuh ini karena
  // display_name penuh terlalu panjang untuk satu baris list kecil — beda
  // kebutuhan dari buildShortLabel (App-05) yang meringkas untuk field
  // tunggal, bukan daftar.
  primaryText: string;
  secondaryText: string;
  coordinate: Coordinate;
  // "station" = halte/stasiun dari GTFS backend (lihat
  // services/stationSearchService.ts), "place" = alamat/POI Nominatim.
  kind?: "station" | "place";
  icon?: string; // nama Ionicons
  color?: string;
}

/**
 * Label ringkas untuk judul layar: alamat Nominatim penuh ("Jalan
 * Palatehan, Blok K, Melawai, Kebayoran Baru, Jakarta Selatan, ...") dipotong
 * ke dua bagian pertama. Nama halte/stasiun kita tidak berkoma, jadi utuh.
 */
export function shortPlaceLabel(label: string): string {
  // "Lokasi Anda saat ini (-6.2, 106.8)" — koma di dalam kurung bukan pemisah.
  if (label.includes("(")) return label;
  const parts = label.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.slice(0, 2).join(", ") || label;
}

/**
 * Catat koordinat sebuah label yang sudah pasti (saran yang di-tap, lokasi
 * GPS, Tujuan Cepat) supaya geocodePlace(label) tidak menebak ulang lewat
 * pencarian teks — tebakan itu bisa jatuh ke tempat lain yang senama.
 */
export function rememberPlace(label: string, coordinate: Coordinate): void {
  geocodeCache.set(label, coordinate);
}

function splitDisplayName(displayName: string): {
  primaryText: string;
  secondaryText: string;
} {
  const [first, ...rest] = displayName.split(",").map((s) => s.trim());
  return { primaryText: first || displayName, secondaryText: rest.join(", ") };
}

const MIN_SUGGESTION_QUERY_LENGTH = 3;

/**
 * Cari beberapa saran lokasi sekaligus untuk autocomplete (Task App-06) —
 * beda dari geocodePlace yang cuma mengembalikan satu hasil teratas untuk
 * submit final. Dipanggil dari input yang di-debounce, BUKAN tiap huruf
 * (pemanggil yang bertanggung jawab atas debounce; fungsi ini sendiri tidak
 * tahu soal keystroke).
 *
 * @param query - kueri mentah dari input user. Query < 3 karakter langsung
 *   dibalas array kosong tanpa memanggil Nominatim sama sekali (batasan
 *   eksplisit task — jangan buang kuota request untuk hasil yang biasanya
 *   tidak berguna).
 * @param signal - AbortSignal opsional. Pemanggil membatalkan request lama
 *   dengan meng-abort signal ini kalau user lanjut mengetik — fetch()
 *   sendiri yang menangani pembatalan (reject dengan AbortError), fungsi
 *   ini meneruskannya apa adanya ke pemanggil lewat throw, bukan menelannya
 *   jadi array kosong (supaya pemanggil bisa membedakan "abort" dari
 *   "benar-benar tidak ada hasil").
 */
export async function searchPlaceSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_SUGGESTION_QUERY_LENGTH) return [];

  await throttle();

  // Request bisa saja sudah usang persis waktu throttle() selesai
  // menunggu (user lanjut mengetik selama itu) — jangan sampai lanjut
  // fetch percuma kalau sudah pasti dibuang pemanggil.
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const encodedQuery = encodeURIComponent(`${trimmed}, Jakarta, Indonesia`);
  const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=5`;

  const response = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": "SmartRouteAI/1.0 (contact: yourgithub-or-email)",
    },
    signal,
    timeoutMs: SUGGESTION_TIMEOUT_MS,
    timeoutMessage: "Pencarian saran lokasi timeout.",
  });

  if (!response.ok) {
    throw new Error(`Autocomplete gagal: ${response.status}`);
  }

  const results = await response.json();

  const suggestions: PlaceSuggestion[] = results.map(
    (r: { display_name: string; lat: string; lon: string }) => {
      const coordinate: Coordinate = {
        latitude: parseFloat(r.lat),
        longitude: parseFloat(r.lon),
      };
      // Priming cache geocodePlace — lihat catatan di PlaceSuggestion.displayName.
      geocodeCache.set(r.display_name, coordinate);
      return {
        displayName: r.display_name,
        coordinate,
        kind: "place" as const,
        ...splitDisplayName(r.display_name),
      };
    },
  );

  return suggestions;
}

/**
 * Geocode banyak nama tempat sekaligus secara berurutan
 * (bukan paralel, karena Nominatim membatasi 1 request/detik).
 *
 * @param placeNames - array nama tempat
 */
export async function geocodeMultiplePlaces(
  placeNames: string[],
): Promise<(Coordinate | null)[]> {
  const results: (Coordinate | null)[] = [];

  for (const name of placeNames) {
    const coord = await geocodePlace(name);
    results.push(coord);
  }

  return results;
}
