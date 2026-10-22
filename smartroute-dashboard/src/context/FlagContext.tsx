// src/context/FlagContext.tsx
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { createFlag, getActiveFlags, deactivateFlag, type FlagRow, type FlagType as ApiFlagType } from "@/services/api";

// 1. Definisikan tipe data stasiun secara eksplisit (ganti 'any')
// Sesuaikan field-nya dengan isi stations.json kamu
export interface StationData {
  id: string;
  name: string;
  corridor: string;
  density_score: number;
  [key: string]: any; // Hanya gunakan ini jika ada field dinamis lain, tapi hindari jika bisa
}

export type FlagType = ApiFlagType;

// dbId = id baris di tabel station_flags (dipakai untuk hapus/deactivate)
// id = id stasiun (dipakai untuk tampilan & cek "apakah stasiun ini sedang di-flag")
export interface FlaggedStation {
  id: string;
  dbId: number;
  name: string;
  corridor: string;
  density_score: number;
  flaggedAt: Date;
}

interface FlagContextType {
  problematicStations: FlaggedStation[];
  optimalStations: FlaggedStation[];
  isLoading: boolean;
  error: string | null;
  addFlag: (station: StationData, type: FlagType) => Promise<void>;
  removeFlag: (dbId: number, type: FlagType) => Promise<void>;
  refetch: () => Promise<void>;
}

const FLAGGED_BY = "dashboard-user";

const FlagContext = createContext<FlagContextType | undefined>(undefined);

function mapRowToFlaggedStation(row: FlagRow): FlaggedStation {
  return {
    id: row.station_id,
    dbId: row.id,
    name: row.station_name,
    corridor: row.route_or_line,
    density_score: row.density_score != null ? Number(row.density_score) : 0,
    flaggedAt: new Date(row.created_at),
  };
}

export function FlagProvider({ children }: { children: ReactNode }) {
  const [problematicStations, setProblematic] = useState<FlaggedStation[]>([]);
  const [optimalStations, setOptimal] = useState<FlaggedStation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Satu-satunya sumber kebenaran: selalu ambil ulang dari server.
  // Tidak ada lagi mutasi state manual (push/filter) yang rawan drift dari database.
  const refetch = useCallback(async () => {
    try {
      const [problematicRows, optimalRows] = await Promise.all([
        getActiveFlags("problematic"),
        getActiveFlags("optimal"),
      ]);
      setProblematic(problematicRows.map(mapRowToFlaggedStation));
      setOptimal(optimalRows.map(mapRowToFlaggedStation));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data flag");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const addFlag = async (station: StationData, type: FlagType) => {
    await createFlag({
      station_id: station.id,
      flag_type: type,
      flagged_by: FLAGGED_BY,
    });
    await refetch();
  };

  const removeFlag = async (dbId: number, _type: FlagType) => {
    await deactivateFlag(dbId);
    await refetch();
  };

  return (
    <FlagContext.Provider
      value={{ problematicStations, optimalStations, isLoading, error, addFlag, removeFlag, refetch }}
    >
      {children}
    </FlagContext.Provider>
  );
}

export function useFlags() {
  const context = useContext(FlagContext);
  if (!context) throw new Error("useFlags must be used within a FlagProvider");
  return context;
}