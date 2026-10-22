// src/services/nearbyStopsService.ts
//
// Data layer for Task App-15 ("Halte Terdekat") — calls the real GET
// /nearby-stops endpoint from Task Backend-11. Pola fetch-wrapper sama
// persis dengan crowdService.ts (custom Error subclass, cek network-error
// vs status non-ok, dst) supaya konsisten satu gaya di seluruh services/.
import { API_BASE_URL } from "./apiConfig";
import { TransitMode } from "@/components/transit/transitMode";
import { fetchWithTimeout, RequestTimeoutError } from "@/utils/withTimeout";

// Kueri radius kecil, dijawab cepat oleh backend.
const NEARBY_TIMEOUT_MS = 8_000;
// /all-stops mengembalikan SELURUH halte 4 moda se-Jakarta sekaligus —
// payload-nya jauh lebih besar dari /nearby-stops, jadi 8 detik terlalu
// ketat untuknya (ini yang membedakannya dari konstanta di atas).
const ALL_STOPS_TIMEOUT_MS = 15_000;

// Mirrors backend/backend-skeleton/src/services/nearbyStops.ts's NearbyStop
// by hand — sama alasan seperti CrowdOverviewStop di crowdService.ts (dua
// proyek terpisah, tidak satu workspace).
export interface NearbyStop {
  name: string;
  mode: TransitMode;
  distance_m: number;
  lat: number;
  lng: number;
}

export class NearbyStopsFetchError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "NearbyStopsFetchError";
  }
}

/**
 * Ambil daftar halte/stasiun 4 moda terdekat dari satu titik (biasanya
 * lokasi GPS user). `radiusM` opsional — backend sendiri yang punya default
 * (1500m) & batas atas (5000m), lihat routes/nearbyStops.ts.
 */
export async function fetchNearbyStops(
  lat: number,
  lng: number,
  radiusM?: number,
): Promise<NearbyStop[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  });
  if (radiusM !== undefined) params.set("radius", String(radiusM));

  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_BASE_URL}/nearby-stops?${params.toString()}`, {
      timeoutMs: NEARBY_TIMEOUT_MS,
      timeoutMessage: "Pencarian halte terdekat timeout. Coba lagi.",
    });
  } catch (err) {
    if (err instanceof RequestTimeoutError) throw new NearbyStopsFetchError(err.message, err);
    throw new NearbyStopsFetchError(
      `Tidak bisa menghubungi backend di ${API_BASE_URL}. Pastikan server backend jalan.`,
      err,
    );
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    throw new NearbyStopsFetchError("Response backend bukan JSON yang valid.", err);
  }

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as { message?: unknown }).message)
        : `Backend mengembalikan status ${res.status}.`;
    throw new NearbyStopsFetchError(message);
  }

  return body as NearbyStop[];
}

// Perluasan dari Task App-15 (diminta user langsung): SEMUA halte se-Jakarta
// tanpa filter jarak, dari GET /all-stops. Mirrors backend/backend-skeleton/
// src/services/allStops.ts's TransitStop by hand — sama alasan seperti
// NearbyStop di atas.
export interface TransitStop {
  name: string;
  mode: TransitMode;
  lat: number;
  lng: number;
}

/**
 * @param modes - opsional, subset moda yang ingin diambil. Kalau tidak
 *   diisi, backend sendiri yang default ke 4 moda semua (lihat
 *   routes/allStops.ts) — sengaja tidak diduplikasi di sini.
 */
export async function fetchAllStops(modes?: TransitMode[]): Promise<TransitStop[]> {
  const params = new URLSearchParams();
  if (modes && modes.length > 0) params.set("modes", modes.join(","));
  const query = params.toString();

  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_BASE_URL}/all-stops${query ? `?${query}` : ""}`, {
      timeoutMs: ALL_STOPS_TIMEOUT_MS,
      timeoutMessage: "Memuat daftar halte timeout. Coba lagi.",
    });
  } catch (err) {
    if (err instanceof RequestTimeoutError) throw new NearbyStopsFetchError(err.message, err);
    throw new NearbyStopsFetchError(
      `Tidak bisa menghubungi backend di ${API_BASE_URL}. Pastikan server backend jalan.`,
      err,
    );
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    throw new NearbyStopsFetchError("Response backend bukan JSON yang valid.", err);
  }

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as { message?: unknown }).message)
        : `Backend mengembalikan status ${res.status}.`;
    throw new NearbyStopsFetchError(message);
  }

  return body as TransitStop[];
}
