// src/utils/currentLocation.ts
//
// Task App-05: auto-isi field "Dari" lewat GPS saat layar pencarian rute
// dibuka. Sekali baca posisi (getCurrentPositionAsync) — BUKAN
// live-tracking berkelanjutan (watchPositionAsync), itu scope terpisah
// (App-06). Pola permintaan izin di sini mengikuti yang sudah dipakai
// navigate.tsx: minta sekali, kalau ditolak diamkan saja (tidak retry, tidak
// dialog error) supaya app tetap sepenuhnya bisa dipakai manual.
import * as Location from "expo-location";
import { Coordinate, reverseGeocode } from "./geocode";

export interface CurrentLocationResult {
  label: string;
  coordinate: Coordinate;
}

// Reverse geocode ke Nominatim biasanya < 1-2 detik, tapi itu layanan
// gratis pihak ketiga tanpa SLA — tidak boleh bikin user menunggu field
// "Dari" tanpa batas kalau lagi lambat/timeout. Setelah ini, tetap isi
// field dengan koordinat mentah daripada dibiarkan kosong (per task).
const REVERSE_GEOCODE_TIMEOUT_MS = 6000;

function formatCoordinateFallback(coordinate: Coordinate): string {
  return `Lokasi Anda saat ini (${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)})`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/**
 * Minta izin lokasi, baca posisi GPS sekali, lalu reverse-geocode jadi nama
 * lokasi yang enak dibaca.
 *
 * @returns null kalau izin ditolak atau GPS gagal dibaca sama sekali —
 *   pemanggil membiarkan field kosong di kasus ini, sesuai batasan eksplisit
 *   task ("jangan paksa izin"). Kalau posisi berhasil didapat tapi reverse
 *   geocode gagal/lambat, tetap mengembalikan hasil (bukan null) dengan
 *   `label` berupa fallback koordinat — field tidak boleh dibiarkan kosong
 *   di kasus itu.
 */
export async function getCurrentLocationLabel(): Promise<CurrentLocationResult | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;

  let position: Location.LocationObject;
  try {
    position = await Location.getCurrentPositionAsync({});
  } catch (error) {
    console.error("Gagal membaca lokasi GPS:", error);
    return null;
  }

  const coordinate: Coordinate = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };

  const name = await withTimeout(
    reverseGeocode(coordinate),
    REVERSE_GEOCODE_TIMEOUT_MS,
  );

  return {
    label: name ?? formatCoordinateFallback(coordinate),
    coordinate,
  };
}

/**
 * Task App-15: varian ringan getCurrentLocationLabel() untuk layar "Halte
 * Terdekat" — cuma butuh koordinat untuk dikirim ke GET /nearby-stops,
 * TIDAK butuh nama lokasi yang enak dibaca, jadi tidak perlu reverse-geocode
 * (yang sekadar akan membuang waktu & panggil Nominatim untuk sesuatu yang
 * tidak dipakai). Pola izin (minta sekali, diam kalau ditolak) sama persis
 * dengan getCurrentLocationLabel.
 *
 * @returns null kalau izin ditolak atau GPS gagal dibaca — pemanggil yang
 *   menentukan pesan error untuk kasus ini (task ini sengaja tidak
 *   mengasumsikan satu bentuk pesan untuk semua pemanggil, sama seperti
 *   reverseGeocode() di atas untuk kegagalan reverse-geocode).
 */
export async function getCurrentCoordinate(): Promise<Coordinate | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;

  try {
    const position = await Location.getCurrentPositionAsync({});
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch (error) {
    console.error("Gagal membaca lokasi GPS:", error);
    return null;
  }
}
