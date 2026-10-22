// src/services/mapService.ts

export type Coordinate = { latitude: number; longitude: number };

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_URL = "https://router.project-osrm.org/route/v1";
const USER_AGENT = "SmartRouteApp/1.0";

/**
 * Geocode nama tempat ke koordinat via Nominatim
 */
export async function geocodePlace(query: string): Promise<Coordinate | null> {
  try {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query + ", Jakarta, Indonesia")}&format=json&limit=1`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    const json = await res.json();

    if (json[0]?.lat && json[0]?.lon) {
      return {
        latitude: parseFloat(json[0].lat),
        longitude: parseFloat(json[0].lon),
      };
    }
    return null;
  } catch (err) {
    console.error(`[Geocode] Error:`, err);
    return null;
  }
}

/**
 * Fetch Polyline (Walk/Bus -> API, MRT/KRL -> Straight Line)
 */
async function fetchSegmentPolyline(
  start: Coordinate,
  end: Coordinate,
  mode: string,
): Promise<[number, number][] | null> {
  try {
    // Normalisasi mode ke lowercase untuk pengecekan yang aman
    const normalizedMode = mode.toLowerCase();

    // 1. Logika Khusus Rel (KRL, MRT, LRT, Train) -> Garis Lurus
    if (["krl", "mrt", "lrt", "train"].includes(normalizedMode)) {
      console.log(`[Route] Mode ${mode} detected: Using straight line (Rail)`);
      return [
        [start.longitude, start.latitude],
        [end.longitude, end.latitude],
      ];
    }

    // 2. Logika Jalan Raya / Trotoar (Walk, Bus, JakLingko, TransJakarta)
    // Walk -> foot, Lainnya -> driving
    const profile = normalizedMode === "walk" ? "foot" : "driving";

    const waypoints = `${start.longitude},${start.latitude};${end.longitude},${end.latitude}`;
    const url = `https://router.project-osrm.org/route/v1/${profile}/${waypoints}?overview=full&geometries=geojson`;

    console.log(`[Route] Fetching OSRM (${profile}) for ${mode}...`);

    const res = await fetch(url, {
      headers: { "User-Agent": "SmartRouteApp/1.0" },
    });

    // Cek apakah response OK sebelum parse JSON
    if (!res.ok) {
      console.warn(`[Route] OSRM HTTP Error: ${res.status}`);
      // Jangan langsung return null, biarkan jatuh ke fallback di bawah
    } else {
      const json = await res.json();

      if (json.code === "Ok" && json.routes?.[0]?.geometry) {
        console.log(`[Route] ✅ OSRM Success for ${mode}`);
        return json.routes[0].geometry.coordinates;
      } else {
        console.warn(`[Route] OSRM Logic Error: ${json.message || json.code}`);
      }
    }

    // 3. Fallback Garis Lurus (Hanya jika API benar-benar gagal)
    console.warn(`[Route] ⚠️ Fallback to straight line for ${mode}`);
    return [
      [start.longitude, start.latitude],
      [end.longitude, end.latitude],
    ];
  } catch (err) {
    console.error(`[Route] Segment error for ${mode}:`, err);
    // Fallback jika terjadi exception (network error, dll)
    return [
      [start.longitude, start.latitude],
      [end.longitude, end.latitude],
    ];
  }
}
