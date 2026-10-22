// Pencarian halte/stasiun untuk autocomplete asal & tujuan (ala Google Maps:
// halte/stasiun tampil lebih dulu, alamat/jalan dari Nominatim menyusul di
// frontend).
//
// OTP2 menyimpan tiap PERON sebagai stop sendiri ("Blok M Jalur 2", "Blok M
// Jalur 3", ...), dan satu halte BRT bisa punya 5+ stop. Ditampilkan mentah,
// daftar saran penuh duplikat. Di sini peron dengan nama dasar & moda yang
// sama dan berdekatan digabung jadi satu tempat, lengkap dengan daftar
// rute/koridor yang melayaninya.
import { searchOtpStopsWithRoutes, type OtpStopWithRoutes } from "../lib/otpClient";
import { haversineM } from "./stopClusters";
import { tjRouteCategory } from "./tjRouteCategory";

export interface StationSearchResult {
  id: string; // gtfsId stop pertama di kelompok
  name: string;
  lat: number;
  lng: number;
  // Sama dengan RouteLeg.mode, supaya frontend memakai pemetaan ikon/label
  // yang sama (legModeFromBackend).
  mode: "BUS" | "RAIL" | "SUBWAY" | "TRAM";
  // Kategori TransJakarta (route_desc) yang paling "utama" di halte ini —
  // BRT kalau ada rute BRT, dst. Hanya untuk mode BUS.
  category?: string;
  routes: string[]; // nama pendek rute/koridor, mis. ["1", "6M", "7B"]
}

const MAX_RESULTS = 6;
// Peron satu halte berjarak puluhan meter; halte beda tempat yang kebetulan
// senama (mis. "Pasar Minggu" BRT vs mikrotrans) biasanya ratusan meter.
const MERGE_RADIUS_M = 350;

const MODES = new Set(["BUS", "RAIL", "SUBWAY", "TRAM"]);

// Urutan kategori TJ dari yang paling "halte besar": halte BRT lebih mungkin
// yang dimaksud user daripada titik mikrotrans senama.
const CATEGORY_PRIORITY = [
  "BRT",
  "Angkutan Umum Integrasi",
  "Transjabodetabek",
  "Royaltrans",
  "Rusun",
  "Bus Wisata",
  "Mikrotrans",
];

function baseName(name: string): string {
  return name
    .replace(/\s+(Jalur|Arah|Peron|Platform|Pintu)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface Group {
  name: string;
  mode: StationSearchResult["mode"];
  stops: OtpStopWithRoutes[];
}

function matchRank(name: string, q: string): number {
  const n = name.toLowerCase();
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.split(/\s+/).some((w) => w.startsWith(q))) return 2;
  return 3;
}

const MODE_RANK: Record<StationSearchResult["mode"], number> = {
  RAIL: 0,
  SUBWAY: 0,
  TRAM: 0,
  BUS: 1,
};

export async function searchStations(query: string): Promise<StationSearchResult[]> {
  const q = query.trim().toLowerCase();
  const stops = await searchOtpStopsWithRoutes(query.trim());

  const groups: Group[] = [];
  for (const stop of stops) {
    const mode = (stop.vehicleMode ?? "BUS").toUpperCase();
    if (!MODES.has(mode)) continue;
    const name = baseName(stop.name);
    const existing = groups.find(
      (g) =>
        g.mode === mode &&
        g.name.toLowerCase() === name.toLowerCase() &&
        haversineM(g.stops[0], stop) <= MERGE_RADIUS_M,
    );
    if (existing) existing.stops.push(stop);
    else groups.push({ name, mode: mode as Group["mode"], stops: [stop] });
  }

  const results = groups.map((g) => {
    const routeNames = new Set<string>();
    const categories = new Set<string>();
    for (const s of g.stops) {
      for (const r of s.routes) {
        if (r.shortName) routeNames.add(r.shortName);
        if (g.mode === "BUS") {
          const c = tjRouteCategory(r.gtfsId);
          if (c) categories.add(c);
        }
      }
    }
    const category = CATEGORY_PRIORITY.find((c) => categories.has(c)) ?? [...categories][0];
    const lat = g.stops.reduce((sum, s) => sum + s.lat, 0) / g.stops.length;
    const lng = g.stops.reduce((sum, s) => sum + s.lng, 0) / g.stops.length;
    const result: StationSearchResult = {
      id: g.stops[0].gtfsId,
      name: g.name,
      lat,
      lng,
      mode: g.mode,
      category,
      routes: [...routeNames].sort((a, b) => a.localeCompare(b, "id", { numeric: true })),
    };
    return result;
  });

  const catRank = (r: StationSearchResult) => {
    const i = r.category ? CATEGORY_PRIORITY.indexOf(r.category) : -1;
    return i < 0 ? CATEGORY_PRIORITY.length : i;
  };
  results.sort(
    (a, b) =>
      matchRank(a.name, q) - matchRank(b.name, q) ||
      MODE_RANK[a.mode] - MODE_RANK[b.mode] ||
      catRank(a) - catRank(b) ||
      b.routes.length - a.routes.length ||
      a.name.localeCompare(b.name),
  );
  return results.slice(0, MAX_RESULTS);
}
