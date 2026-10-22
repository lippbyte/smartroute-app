// Kategori resmi rute TransJakarta, langsung dari kolom `route_desc` di
// routes.txt feed GTFS TransJakarta (bukan ditebak dari pola nomor rute).
// Nilai yang ada di feed saat ini: "BRT" (31 rute), "Angkutan Umum
// Integrasi" (63), "Mikrotrans" (98), "Transjabodetabek" (18), "Rusun"
// (17), "Royaltrans" (10), "Bus Wisata" (3).
//
// Pola nomor ("koridor 1-14") sengaja TIDAK dipakai: 17 rute BRT resmi
// bernomor varian (2A, 3F, 13B, L13E, ...) akan salah masuk non-BRT.
//
// Backend hanya meneruskan kategori resmi apa adanya; keputusan label/ikon
// per kategori ada di frontend (src/components/transit/legModes.ts), satu
// tempat.
import { getRoutesInfo, type RouteInfo } from "../lib/gtfsFeed";

// JakLingko = Mikrotrans. Diverifikasi terhadap feed: 98 rute route_desc
// "Mikrotrans" == 98 rute berpola JAK.*, tidak ada selisih satu pun, dan
// semuanya fare_id GR (Rp0) di fare_rules.txt.
export const JAKLINGKO_CATEGORY = "Mikrotrans";

let byRouteId: Map<string, RouteInfo> | undefined;

function routeInfo(routeGtfsId: string | undefined): RouteInfo | undefined {
  if (!routeGtfsId) return undefined;
  if (!byRouteId) {
    byRouteId = new Map(getRoutesInfo().map((r) => [r.routeId, r]));
  }
  // OTP2 memberi gtfsId berprefiks id feed ("1:JAK.79"); routes.txt tidak.
  const raw = routeGtfsId.includes(":")
    ? routeGtfsId.slice(routeGtfsId.indexOf(":") + 1)
    : routeGtfsId;
  return byRouteId.get(raw);
}

/**
 * Hanya bermakna untuk leg BUS — feed TransJakarta satu-satunya feed
 * bermoda BUS di graph, jadi pemanggil wajib menyaring mode dulu supaya
 * route_id feed lain (KRL/MRT) tidak salah dicocokkan.
 */
export function tjRouteCategory(routeGtfsId: string | undefined): string | undefined {
  return routeInfo(routeGtfsId)?.desc || undefined;
}

/**
 * Tarif rute dari fare_rules/fare_attributes feed TransJakarta resmi:
 * Rp3.500 (BRT, feeder, Transjabodetabek, Rusun), Rp0 (Mikrotrans/JakLingko,
 * Bus Wisata), Rp20.000/Rp35.000 (Royaltrans). undefined kalau rute tidak
 * punya fare_rule — pemanggil memperlakukannya sebagai tarif reguler.
 */
export function tjRouteFareIdr(routeGtfsId: string | undefined): number | undefined {
  return routeInfo(routeGtfsId)?.fareIdr;
}
