// Halte/stasiun untuk autocomplete asal & tujuan — GET /stations/search di
// backend (peron digabung per tempat, lengkap dengan moda & rute yang
// melayani). Ditampilkan di atas saran alamat Nominatim, ala Google Maps.
import { LEG_MODES, legModeFromBackend } from "@/components/transit/legModes";
import { PlaceSuggestion } from "@/utils/geocode";
import { fetchWithTimeout } from "@/utils/withTimeout";
import { API_BASE_URL } from "./apiConfig";

const STATION_SEARCH_TIMEOUT_MS = 8_000;
const MAX_ROUTES_SHOWN = 6;

interface BackendStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  mode: "BUS" | "RAIL" | "SUBWAY" | "TRAM";
  category?: string;
  routes: string[];
}

const PLACE_KIND: Record<string, string> = {
  brt: "Halte TransJakarta",
  feeder: "Halte TransJakarta",
  jaklingko: "Halte JakLingko",
  krl: "Stasiun KRL",
  mrt: "Stasiun MRT",
  lrt: "Stasiun LRT",
};

function toSuggestion(s: BackendStation): PlaceSuggestion {
  const key = legModeFromBackend(s.mode, s.category);
  const style = LEG_MODES[key];
  const kind = PLACE_KIND[key] ?? "Halte";
  const shown = s.routes.slice(0, MAX_ROUTES_SHOWN).join(", ");
  const more = s.routes.length > MAX_ROUTES_SHOWN ? ` +${s.routes.length - MAX_ROUTES_SHOWN}` : "";
  const routesLabel = s.routes.length
    ? `${style.isRail ? "Lin" : "Rute"} ${shown}${more}`
    : "";
  return {
    // Jadi isi field & label di layar hasil/navigasi: "Stasiun MRT Blok M".
    displayName: `${kind} ${s.name}`,
    primaryText: s.name,
    secondaryText: [kind, routesLabel].filter(Boolean).join(" · "),
    coordinate: { latitude: s.lat, longitude: s.lng },
    kind: "station",
    icon: style.icon,
    color: style.color,
  };
}

export async function searchStationSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/stations/search?q=${encodeURIComponent(query.trim())}`,
    {
      signal,
      timeoutMs: STATION_SEARCH_TIMEOUT_MS,
      timeoutMessage: "Pencarian halte timeout.",
    },
  );
  if (!res.ok) throw new Error(`Pencarian halte gagal: ${res.status}`);
  const stations = (await res.json()) as BackendStation[];
  return stations.map(toSuggestion);
}
