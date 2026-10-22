// src/components/dashboard/FleetStatusCard.tsx
import { motion } from "motion/react";
import { useEffect, useState, useMemo } from "react"; // Tambah useMemo
import { getFleets, type FleetData } from "@/services/api";
import { 
  RiBusLine, 
  RiSubwayLine, 
  RiTrainLine, 
  RiRoadMapLine,
  RiFlashlightLine,
  RiSearchLine // Icon baru
} from "react-icons/ri";

export default function FleetStatusCard() {
  const [fleets, setFleets] = useState<FleetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(""); // State Search

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getFleets();
        setFleets(data);
      } catch (err) {
        console.error("Gagal ambil data armada", err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
    
    // Auto-refresh setiap 15 detik
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Logic Filtering Search
  const filteredFleets = useMemo(() => {
    if (!searchQuery.trim()) return fleets;
    const lowerQuery = searchQuery.toLowerCase();
    return fleets.filter(fleet => 
      fleet.unit_name.toLowerCase().includes(lowerQuery) ||
      fleet.transport_type.toLowerCase().includes(lowerQuery) ||
      fleet.assigned_corridor.toLowerCase().includes(lowerQuery) ||
      fleet.unit_id.toLowerCase().includes(lowerQuery)
    );
  }, [fleets, searchQuery]);

  // Helper untuk ikon berdasarkan tipe
  const getIcon = (type: string) => {
    switch(type) {
      case 'busway': return <RiBusLine className="w-3.5 h-3.5 text-blue-400" />;
      case 'mrt': return <RiSubwayLine className="w-3.5 h-3.5 text-yellow-400" />;
      case 'lrt': return <RiTrainLine className="w-3.5 h-3.5 text-purple-400" />;
      case 'krl': return <RiFlashlightLine className="w-3.5 h-3.5 text-red-400" />;
      default: return <RiRoadMapLine className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  // Helper untuk label moda singkat
  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'busway': return 'TJ';
      case 'mrt': return 'MRT';
      case 'lrt': return 'LRT';
      case 'krl': return 'KRL';
      default: return type.toUpperCase();
    }
  };

  // Urutkan hasil yang sudah difilter: Active dulu, baru stopped
  const sortedFleets = [...filteredFleets].sort((a, b) => {
    if (a.current_status === b.current_status) {
      return a.unit_name.localeCompare(b.unit_name);
    }
    return a.current_status === 'active' ? -1 : 1;
  });

  // Batasi tampilan agar tidak terlalu panjang (misal 8 teratas dari hasil filter)
  const displayFleets = sortedFleets.slice(0, 8);
  const remainingCount = sortedFleets.length - displayFleets.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="bg-dark-1 border border-light-1/25 rounded-xl p-6 flex flex-col gap-4 font-mono h-full"
    >
      {/* Header */}
      <div>
        <h2 className="text-xl font-sans font-bold text-light-1 flex items-center gap-2">
          <RiRoadMapLine className="text-xl" />
          Status Armada
        </h2>
        <p className="text-sm text-light-2 mt-1">
          {fleets.filter(f => f.current_status === 'active').length} unit beroperasi • {fleets.length} total armada
        </p>
      </div>

      {/* Input Search */}
      <div className="relative group">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-light-2 group-focus-within:text-light-1 transition-colors pointer-events-none">
          <RiSearchLine className="w-4 h-4" />
        </div>
        <input
          type="text"
          placeholder="Cari unit / koridor..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-dark-2 border border-light-1/10 rounded-md pl-9 pr-3 py-2 text-sm text-light-1 placeholder:text-light-2/50 focus:outline-none focus:border-light-1/30 transition-colors"
        />
      </div>

      {/* List Container */}
      <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto pr-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-light-1/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-light-1/20 text-sm">
        
        {loading ? (
          <div className="py-4 text-center text-light-2 animate-pulse">Memuat data armada...</div>
        ) : sortedFleets.length === 0 ? (
          <div className="py-4 text-center text-light-2">
            {searchQuery ? `Tidak ditemukan armada "${searchQuery}"` : 'Tidak ada data armada'}
          </div>
        ) : (
          <>
            {displayFleets.map((fleet) => (
              <div 
                key={fleet.unit_id}
                className={`p-3 rounded-md border flex items-center justify-between gap-3 transition-colors ${
                  fleet.current_status === 'active' 
                    ? 'border-green-500/20 bg-green-500/5' 
                    : 'border-light-1/10 bg-dark-2/30 opacity-60'
                }`}
              >
                {/* Kiri: Info Unit */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0">
                    {getIcon(fleet.transport_type)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-light-1 truncate text-xs">
                      {fleet.unit_name}
                    </span>
                    <span className="text-[10px] text-light-2 flex items-center gap-1">
                      <span className={`px-1 py-0.5 rounded bg-black/20 ${
                        fleet.transport_type === 'busway' ? 'text-blue-300' :
                        fleet.transport_type === 'mrt' ? 'text-yellow-300' :
                        fleet.transport_type === 'lrt' ? 'text-purple-300' : 'text-red-300'
                      }`}>
                        {getTypeLabel(fleet.transport_type)}
                      </span>
                      <span className="truncate">{fleet.assigned_corridor}</span>
                    </span>
                  </div>
                </div>

                {/* Kanan: Status & Speed */}
                <div className="flex flex-col items-end shrink-0">
                  <span className={`text-xs font-bold flex items-center gap-1 ${
                    fleet.current_status === 'active' ? 'text-green-400' : 'text-gray-500'
                  }`}>
                    {fleet.current_status === 'active' ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                        {fleet.current_speed_kmh} km/h
                      </>
                    ) : (
                      'Standby'
                    )}
                  </span>
                  <span className="text-[10px] text-light-2 mt-0.5">
                    Load: {fleet.current_load}/{fleet.passenger_capacity}
                  </span>
                </div>
              </div>
            ))}

            {/* Indikator jika masih ada data lain hasil filter */}
            {remainingCount > 0 && (
              <div className="py-2 text-center text-xs text-light-2 border-t border-light-1/5 mt-1">
                +{remainingCount} armada lainnya tidak ditampilkan
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}