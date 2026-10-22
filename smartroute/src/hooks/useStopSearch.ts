// src/hooks/useStopSearch.ts
//
// Task App-07: debounce + abort untuk pencarian halte (submit laporan
// kepadatan). Struktur sengaja sama persis dengan useLocationSuggestions
// (App-06) — debounce 600ms, guard <3 karakter, abort request lama saat
// query berubah — tapi dipisah jadi hook sendiri karena sumber datanya beda
// total (searchStops/OTP2 gtfsId, bukan searchPlaceSuggestions/Nominatim)
// dan dipakai di alur yang tidak berkaitan dengan pencarian rute.
import { StopSearchResult, searchStops } from "@/services/crowdService";
import { useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 600;

interface UseStopSearchResult {
  results: StopSearchResult[];
  isLoading: boolean;
}

export function useStopSearch(query: string): UseStopSearchResult {
  const [results, setResults] = useState<StopSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortControllerRef.current?.abort();

    if (query.trim().length < 3) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const timer = setTimeout(() => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      searchStops(query, controller.signal)
        .then((stops) => {
          setResults(stops);
          setIsLoading(false);
        })
        .catch((error) => {
          // Sama seperti useLocationSuggestions.ts (App-06) — di native,
          // error abort tidak selalu ber-.name "AbortError" seperti spec
          // web, jadi cek langsung status signal-nya sendiri, bukan
          // menebak dari bentuk error. Ditemukan lewat testing device
          // fisik (Task App-12).
          if (controller.signal.aborted) return;
          console.error("Gagal mencari halte:", error);
          setResults([]);
          setIsLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  return { results, isLoading };
}
