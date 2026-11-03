import { useCallback, useEffect, useState } from "react";
import type { Network } from "@/simulation/types";

interface UseNetworkResult {
  network: Network | null;
  error: string | null;
  retry: () => void;
}

/** Memuat data jaringan statis. Data ini berkas publik, tidak butuh backend. */
export function useNetwork(): UseNetworkResult {
  const [network, setNetwork] = useState<Network | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}data/network.json`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Network;
        if (!Array.isArray(data.patterns) || data.patterns.length === 0) throw new Error("data kosong");
        setNetwork(data);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        console.error("Gagal memuat data jaringan:", err);
        setError("Data jaringan gagal dimuat. Periksa koneksi lalu coba lagi.");
      }
    })();
    return () => ctrl.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((a) => a + 1);
  }, []);

  return { network, error, retry };
}
