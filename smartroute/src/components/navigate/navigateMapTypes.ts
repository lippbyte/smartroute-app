// Kontrak props peta navigasi, dipakai bersama versi web (Leaflet di iframe)
// dan native (MapLibre). Semua geometri berasal dari backend (OTP2), bukan
// hasil geocode nama halte atau router mobil.
import { Coordinate } from "@/services/mapService";

export interface MapSegment {
  // Satu leg perjalanan. [lng, lat] (urutan GeoJSON).
  coords: [number, number][];
  color: string;
  // Jalan kaki digambar putus-putus, transit garis solid — ala Google Maps.
  dashed: boolean;
}

export interface MapStop {
  lat: number;
  lng: number;
  name: string;
  color: string;
  // endpoint = asal/tujuan akhir, transfer = titik naik/turun/pindah moda
  // (berlabel nama), pass = halte/stasiun yang dilewati (titik kecil).
  kind: "origin" | "destination" | "transfer" | "pass";
  legIndex: number;
}

export interface NavigateMapProps {
  segments: MapSegment[];
  stops: MapStop[];
  // Leg yang sedang dijalani: garisnya ditebalkan, leg lain diredupkan.
  activeLegIndex: number;
  // Kalau tidak mengikuti GPS, kamera membingkai titik-titik ini (leg aktif).
  // [lng, lat].
  focusCoords: [number, number][];
  userLocation?: Coordinate | null;
  isFollowingUser?: boolean;
  // Ruang yang tertutup banner atas & kartu bawah, supaya bingkai kamera
  // tidak jatuh di bawah UI.
  padding: { top: number; bottom: number };
}

export interface NavigateMapHandle {
  flyTo: (center: [number, number], zoom?: number) => void;
}
