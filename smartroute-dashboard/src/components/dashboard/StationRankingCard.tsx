// src/components/dashboard/StationRankingCard.tsx
import { motion } from "motion/react";
import { RiFlagLine, RiCheckboxCircleLine, RiCloseCircleLine, RiSearchLine } from "react-icons/ri";
import { useFlags, type FlagType } from "@/context/FlagContext";
import { useState, useMemo } from "react"; // Tambah useState, useMemo

export interface StationData {
  id: string;
  name: string;
  corridor: string;
  passenger_count: number;
  avg_dwell_time_sec: number;
  bus_arrival_eta_sec: number;
  density_score: number;
  ai_anomaly_flag: boolean;
}

interface StationRankingCardProps {
  stations: StationData[];
  corridors: string[];
  selectedCorridor: string;
  onSelectCorridor: (corridor: string) => void;
}

export default function StationRankingCard({
  stations,
  corridors,
  selectedCorridor,
  onSelectCorridor,
}: StationRankingCardProps) {
  const { problematicStations, optimalStations, addFlag, removeFlag } = useFlags();
  const [searchQuery, setSearchQuery] = useState(""); // State Search

  // Logic Filtering Gabungan (Koridor + Search)
  const filteredStations = useMemo(() => {
    return stations.filter(s => {
      const matchCorridor = selectedCorridor === "All" || s.corridor === selectedCorridor;
      const matchSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.corridor.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCorridor && matchSearch;
    });
  }, [stations, selectedCorridor, searchQuery]);

  const getFlagOf = (stationId: string): FlagType | null => {
    if (problematicStations.find((s) => s.id === stationId)) return "problematic";
    if (optimalStations.find((s) => s.id === stationId)) return "optimal";
    return null;
  };

  const getDbIdOf = (stationId: string): number | undefined => {
    return (
      problematicStations.find((s) => s.id === stationId)?.dbId ??
      optimalStations.find((s) => s.id === stationId)?.dbId
    );
  };

  const handleFlag = async (e: React.MouseEvent, station: StationData, type: FlagType) => {
    e.stopPropagation();
    try {
      await addFlag(station, type);
    } catch (err) {
      console.error("Gagal menyimpan flag:", err);
    }
  };

  const handleUnflag = async (e: React.MouseEvent, stationId: string, type: FlagType) => {
    e.stopPropagation();
    const dbId = getDbIdOf(stationId);
    if (!dbId) return;
    try {
      await removeFlag(dbId, type);
    } catch (err) {
      console.error("Gagal menghapus flag:", err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="bg-dark-1 border border-light-1/25 rounded-xl p-6 flex flex-col gap-4 font-mono h-full min-h-0"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-sans font-bold text-light-1">
            Tingkat Kepadatan Halte
          </h2>
          <p className="text-sm text-light-2 mt-1">
            Daftar halte diurutkan berdasarkan skor kepadatan
          </p>
        </div>

        {/* Controls Area: Search + Filter */}
        <div className="flex flex-col items-stretch gap-3 w-full sm:w-auto">

          {/* Filter Koridor */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-light-2 hidden sm:inline">Koridor:</span>
            <select
              value={selectedCorridor}
              onChange={(e) => onSelectCorridor(e.target.value)}
              className="bg-dark-2 border border-light-1/10 text-light-1 text-sm rounded-md px-3 py-1.5 outline-none focus:border-light-1/30 transition-colors w-full sm:w-auto"
            >
              {corridors.map((c) => (
                <option key={c} value={c} className="bg-dark-1 text-light-1">
                  {c}
                </option>
              ))}
            </select>
          </div>
          
          {/* Search Input */}
          <div className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-light-2 group-focus-within:text-light-1 transition-colors pointer-events-none">
              <RiSearchLine className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Cari halte..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-dark-2 border border-light-1/10 rounded-md pl-9 pr-3 py-1.5 text-sm text-light-1 placeholder:text-light-2/50 focus:outline-none focus:border-light-1/30 transition-all"
            />
          </div>
        </div>
      </div>

      {/* List Halte */}
      <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto pr-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-light-1/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-light-1/20">
        {filteredStations.length === 0 ? (
           <div className="py-8 text-center text-light-2 text-sm">
             Tidak ada halte ditemukan untuk "{searchQuery}"
           </div>
        ) : (
          filteredStations.map((s, idx) => {
            const densityPct = `${Math.trunc(s.density_score * 100)}%`;
            const currentFlag = getFlagOf(s.id);

            return (
              <div
                key={s.id}
                className="group bg-dark-2/40 border border-light-1/10 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-light-1/25 transition-all text-sm shrink-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-light-2 w-5 font-bold">
                    #{idx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-sans font-bold text-sm text-light-1">
                        {s.name}
                      </p>
                      {s.ai_anomaly_flag && (
                        <span className="text-[10px] text-red-1 font-bold bg-red-1/10 px-1 rounded">
                          AI
                        </span>
                      )}
                      {currentFlag === "problematic" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-1/10 text-red-1 font-bold">
                          Bermasalah
                        </span>
                      )}
                      {currentFlag === "optimal" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-1/10 text-green-1 font-bold">
                          Optimal
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-light-2">{s.corridor}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 min-w-56">
                  <div className="text-right">
                    <p className="text-sm font-bold text-light-1">
                      {s.passenger_count} orang
                    </p>
                    <p className="text-xs text-light-2">
                      ETA: {s.bus_arrival_eta_sec} dtk
                    </p>
                  </div>

                  <div className="flex items-center gap-3 w-32">
                    <div className="h-1.5 w-full rounded-2xl bg-dark-2 flex">
                      <motion.div
                        className="h-full bg-light-1 rounded-2xl"
                        initial={{ width: 0 }}
                        animate={{ width: densityPct }}
                      />
                    </div>
                    <span className="text-xs text-light-1 font-mono w-8 text-right">
                      {densityPct}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 sm:transition-opacity">
                    {currentFlag ? (
                      <button
                        onClick={(e) => handleUnflag(e, s.id, currentFlag)}
                        title="Hapus flag"
                        className="p-1.5 rounded-md text-light-2 hover:text-light-1 hover:bg-light-1/10 transition-colors cursor-pointer"
                      >
                        <RiFlagLine className="text-base" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={(e) => handleFlag(e, s, "problematic")}
                          title="Tandai Bermasalah"
                          className="p-1.5 rounded-md text-red-1/70 hover:text-red-1 hover:bg-red-1/10 transition-colors cursor-pointer"
                        >
                          <RiCloseCircleLine className="text-base" />
                        </button>
                        <button
                          onClick={(e) => handleFlag(e, s, "optimal")}
                          title="Tandai Optimal"
                          className="p-1.5 rounded-md text-green-1/70 hover:text-green-1 hover:bg-green-1/10 transition-colors cursor-pointer"
                        >
                          <RiCheckboxCircleLine className="text-base" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}