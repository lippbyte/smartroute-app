// src/hooks/useStations.ts
import { useEffect, useRef, useState, useCallback } from "react";
import { getStations, type StationData } from "@/services/api";

const POLL_INTERVAL_MS = 15000; // fetch ulang tiap 15 detik (backend update tiap 30 detik)

interface UseStationsResult {
  stations: StationData[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useStations(): UseStationsResult {
  const [stations, setStations] = useState<StationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFirstLoad = useRef(true);

  const fetchStations = useCallback(async () => {
    try {
      const data = await getStations();
      setStations(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data stasiun");
    } finally {
      if (isFirstLoad.current) {
        setIsLoading(false);
        isFirstLoad.current = false;
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStations();
    const interval = setInterval(fetchStations, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStations]);

  return { stations, isLoading, error, refetch: fetchStations };
}