// src/utils/stopActions.ts
//
// Dua aksi halte yang sama di Halte Terdekat, Peta Semua Halte, dan Asisten
// AI — satu tempat supaya ketiga fitur itu benar-benar tersambung ke alur
// cari-rute dengan cara yang identik.
import type { useRouter } from "expo-router";
import { Coordinate } from "./geocode";

type Router = ReturnType<typeof useRouter>;

export interface StopTarget {
  name: string;
  lat: number;
  lng: number;
}

// Label field "Dari" saat berangkat dari posisi GPS.
export const MY_LOCATION_LABEL = "Lokasi saya";

export function formatCoordParam(lat: number, lng: number): string {
  return `${lat},${lng}`;
}

export function parseCoordParam(value?: string): Coordinate | null {
  const m = value?.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
}

/**
 * Cari rute dari posisi user ke halte. Untuk halte yang dekat, mesin rute
 * ikut mengembalikan opsi jalan kaki murni lengkap dengan langkah belok,
 * yang lalu bisa dibuka di layar navigasi seperti rute biasa.
 */
export function openWalkToStop(router: Router, from: Coordinate, stop: StopTarget) {
  router.push({
    pathname: "/route",
    params: {
      origin: MY_LOCATION_LABEL,
      originCoord: formatCoordParam(from.latitude, from.longitude),
      destination: stop.name,
      destinationCoord: formatCoordParam(stop.lat, stop.lng),
    },
  });
}

/** Buka Beranda dengan halte ini terisi sebagai titik berangkat. */
export function openDepartFromStop(router: Router, stop: StopTarget) {
  router.navigate({
    pathname: "/",
    params: {
      fromStop: stop.name,
      fromStopCoord: formatCoordParam(stop.lat, stop.lng),
    },
  });
}
