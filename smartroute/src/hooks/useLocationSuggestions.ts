// src/hooks/useLocationSuggestions.ts
//
// Task App-06: debounce + abort untuk autocomplete lokasi. Dipisah jadi
// hook (bukan ditulis langsung di komponen field) karena dipakai dua kali
// persis sama (field "Dari" dan "Tujuan") — satu implementasi, bukan dua
// yang bisa diam-diam berbeda.
import { searchStationSuggestions } from "@/services/stationSearchService";
import {
  PlaceSuggestion,
  rememberPlace,
  searchPlaceSuggestions,
} from "@/utils/geocode";
import { useEffect, useRef, useState } from "react";

// Nominatim juga mengenal halte/stasiun sebagai POI ("Stasiun Manggarai,
// ..."). Kalau sudah ada halte/stasiun kita di titik yang sama (< 150 m) dan
// namanya mirip, saran Nominatim itu disembunyikan supaya tidak dobel.
function dedupePlaces(
  places: PlaceSuggestion[],
  stations: PlaceSuggestion[],
): PlaceSuggestion[] {
  const near = (a: PlaceSuggestion, b: PlaceSuggestion) => {
    const dLat = (a.coordinate.latitude - b.coordinate.latitude) * 111_000;
    const dLng = (a.coordinate.longitude - b.coordinate.longitude) * 110_000;
    return Math.hypot(dLat, dLng) < 150;
  };
  return places.filter(
    (p) =>
      !stations.some(
        (s) =>
          near(p, s) &&
          p.primaryText.toLowerCase().includes(s.primaryText.toLowerCase()),
      ),
  );
}

// Di tengah rentang 500-800ms yang diminta task.
const DEBOUNCE_MS = 600;

const MAX_STATIONS = 4;
const MAX_PLACES = 4;

interface UseLocationSuggestionsResult {
  suggestions: PlaceSuggestion[];
  isLoading: boolean;
}

/**
 * @param query - teks yang sedang diketik user.
 * @param enabled - hanya cari kalau true (field lagi fokus). Tanpa ini,
 *   perubahan `query` yang datang dari luar — auto-isi GPS (App-05), atau
 *   field lain yang baru saja di-set dari tap saran — ikut memicu
 *   pencarian yang tidak diminta siapa pun.
 */
export function useLocationSuggestions(
  query: string,
  enabled: boolean,
): UseLocationSuggestionsResult {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Ketukan baru (atau field kehilangan fokus) -> request lama, kalau
    // masih di tengah jalan, resmi usang. Di-abort supaya hasilnya yang
    // "telat" tidak pernah sampai menimpa suggestions yang lebih baru
    // (acceptance criteria: ganti kata kunci cepat tidak menampilkan hasil
    // basi).
    abortControllerRef.current?.abort();

    if (!enabled || query.trim().length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const timer = setTimeout(() => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Halte/stasiun (backend, cepat) dan alamat (Nominatim, di-throttle
      // 1 req/detik) dicari bersamaan. Halte ditampilkan begitu datang, di
      // ATAS alamat — ala Google Maps. Satu sumber gagal tidak menggagalkan
      // yang lain.
      let stations: PlaceSuggestion[] = [];
      let places: PlaceSuggestion[] = [];
      // Dibatasi supaya daftar tetap pendek (sisanya bisa di-scroll di
      // dropdown): halte/stasiun dulu, baru alamat.
      const publish = () => {
        if (controller.signal.aborted) return;
        setSuggestions([
          ...stations.slice(0, MAX_STATIONS),
          ...dedupePlaces(places, stations).slice(0, MAX_PLACES),
        ]);
      };
      const stationRequest = searchStationSuggestions(query, controller.signal)
        .then((results) => {
          stations = results;
          for (const s of results) rememberPlace(s.displayName, s.coordinate);
          publish();
        })
        .catch((error) => {
          if (!controller.signal.aborted) console.warn("Gagal mencari halte:", error);
        });

      const placeRequest = searchPlaceSuggestions(query, controller.signal).then(
        (results) => {
          places = results;
          publish();
        },
      );

      Promise.all([stationRequest, placeRequest])
        .then(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        })
        .catch((error) => {
          // Ditemukan lewat testing device fisik (dev client, Task App-12):
          // di React Native native (Hermes), fetch yang di-abort TIDAK
          // selalu melempar error dengan .name === "AbortError" seperti
          // spec Fetch web — pesannya bisa "fetch failed: Fetch request
          // has been canceled" dengan .name lain sama sekali, tembus ke
          // console.error dan muncul sebagai LogBox merah walau perilakunya
          // sebenarnya benar (abort yang disengaja). controller.signal.
          // aborted adalah fakta langsung soal APAKAH INI aborted oleh kita
          // sendiri — tidak bergantung tebak-tebak bentuk error yang
          // berbeda-beda antar platform/fetch implementation.
          if (controller.signal.aborted) return;
          console.error("Gagal mengambil saran lokasi:", error);
          publish(); // halte yang sudah datang tetap ditampilkan
          setIsLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, enabled]);

  // Request yang masih menggantung saat komponen unmount (pindah layar
  // sebelum hasil datang) juga harus di-abort, bukan cuma saat ganti query.
  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  return { suggestions, isLoading };
}
