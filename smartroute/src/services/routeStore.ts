// Penyimpanan sementara (memori) rute yang sedang dilihat — layar detail &
// navigasi mengambil rute dari sini lewat route_id, bukan dari JSON di
// parameter URL. Sejak leg membawa geometri jalur (ratusan titik), JSON
// satu rute bisa puluhan KB: terlalu besar untuk URL di web, dan di-parse
// ulang tiap render.
//
// Isinya hilang kalau app/tab browser dimuat ulang — layar yang membaca
// wajib menangani `undefined` (minta user mencari ulang).
import { RouteItem } from "@/type";

export interface StoredRoute {
  route: RouteItem;
  originName: string;
  destinationName: string;
}

const store = new Map<string, StoredRoute>();

export function putRoute(entry: StoredRoute): void {
  store.set(entry.route.route_id, entry);
}

export function getRoute(routeId: string | undefined): StoredRoute | undefined {
  return routeId ? store.get(routeId) : undefined;
}
