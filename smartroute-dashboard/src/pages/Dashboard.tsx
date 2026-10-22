// src/pages/Dashboard.tsx
import { useMemo, useState } from "react";
import ViewToggle from "@/components/ui/ViewToggle";
import { useStations } from "@/hooks/useStations";
import { useFlags } from "@/context/FlagContext";
import {
  RiMapPinLine,
  RiUserSharedLine,
  RiTimeLine,
  RiAlertLine,
} from "react-icons/ri";

import KpiCard from "@/components/dashboard/KpiCard";
import FlagSummaryCard from "@/components/dashboard/FlagSummaryCard";
import StationRankingCard, {
  type StationData,
} from "@/components/dashboard/StationRankingCard";
import FleetStatusCard from "@/components/dashboard/FleetStatusCard"; // <-- IMPORT BARU

export default function Dashboard() {
  const { problematicStations, optimalStations } = useFlags();
  const { stations: fetchedStations, isLoading, error } = useStations();
  
  const stations = fetchedStations as StationData[];
  const [selectedCorridor, setSelectedCorridor] = useState<string>("All");

  const corridors = useMemo(() => {
    const list = Array.from(new Set(stations.map((s) => s.corridor)));
    return ["All", ...list];
  }, [stations]);

  const filteredStations = useMemo(() => {
    if (selectedCorridor === "All") return stations;
    return stations.filter((s) => s.corridor === selectedCorridor);
  }, [stations, selectedCorridor]);

  // Kalkulasi KPI
  const totalStations = stations.length;
  const totalPassengers = useMemo(
    () => stations.reduce((acc, curr) => acc + curr.passenger_count, 0),
    [stations]
  );
  const avgDwellTime = useMemo(
    () =>
      totalStations === 0
        ? 0
        : Math.round(
            stations.reduce((acc, curr) => acc + curr.avg_dwell_time_sec, 0) /
              totalStations
          ),
    [stations, totalStations]
  );
  const aiAnomaliesCount = useMemo(
    () => stations.filter((s) => s.ai_anomaly_flag).length,
    [stations]
  );

  // Sorting berdasarkan density score
  const topCrowded = useMemo(() => {
    return [...filteredStations].sort(
      (a, b) => b.density_score - a.density_score
    );
  }, [filteredStations]);

  return (
    <div className="h-screen overflow-hidden bg-dark-1 text-light-1 font-mono p-6 lg:p-8 flex flex-col gap-6 relative">
      <ViewToggle />

      {/* Header */}
      <div className="border-b border-light-1/25 pb-4 pr-48 shrink-0">
        <h1 className="text-xl font-sans font-bold text-light-1">
          Dashboard Kepadatan Halte
        </h1>
        <p className="text-sm text-light-2 mt-1">
          {error
            ? "Gagal terhubung ke server — menampilkan data terakhir"
            : "Ringkasan analisis lalu lintas penumpang dan status halte terkini"}
        </p>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-light-2 text-sm">
          Memuat data stasiun...
        </div>
      ) : (
        <>
          {/* Grid KPI Metrics (Atas) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
            <KpiCard
              title="Total Halte"
              value={totalStations}
              subtitle="Tersebar di seluruh koridor"
              icon={<RiMapPinLine />}
              delay={0}
            />
            <KpiCard
              title="Total Pengunjung"
              value={`${totalPassengers.toLocaleString("id-ID")} orang`}
              subtitle="Orang saat ini"
              icon={<RiUserSharedLine />}
              delay={0.05}
            />
            <KpiCard
              title="Rata-Rata Waktu Tinggal"
              value={`${avgDwellTime} dtk`}
              subtitle="Durasi di area halte"
              icon={<RiTimeLine />}
              delay={0.1}
            />
            <KpiCard
              title="Anomali AI"
              value={aiAnomaliesCount}
              subtitle="Terdeteksi oleh AI"
              icon={<RiAlertLine />}
              delay={0.15}
              valueClassName="text-red-1 font-bold"
              iconContainerClassName="bg-red-1/10 text-red-1"
            />
          </div>

          {/* Layout Utama: Grid 4 Kolom di Desktop */}
          {/* 
            Col 1: Flag Summary (1 kolom)
            Col 2: Fleet Status (1 kolom) -> BARU
            Col 3-4: Station Ranking (2 kolom) -> Tetap lebar
          */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0">
            
            {/* Kolom 1: Flag Summary */}
            <div className="lg:col-span-1 h-full min-h-0">
              <FlagSummaryCard
                problematicCount={problematicStations.length}
                optimalCount={optimalStations.length}
              />
            </div>

            {/* Kolom 2: Fleet Status (Armada) */}
            <div className="lg:col-span-1 h-full min-h-0 hidden lg:flex">
              <FleetStatusCard />
            </div>

            {/* Kolom 3 & 4: Station Ranking */}
            <div className="lg:col-span-2 h-full min-h-0">
              <StationRankingCard
                stations={topCrowded}
                corridors={corridors}
                selectedCorridor={selectedCorridor}
                onSelectCorridor={setSelectedCorridor}
              />
            </div>
            
            {/* Catatan untuk Mobile: 
                Di mobile (grid-cols-1), FleetStatusCard disembunyikan (hidden lg:flex) 
                agar tidak memakan tempat vertikal terlalu banyak, atau Anda bisa 
                menghapus class 'hidden lg:flex' jika ingin tetap muncul di mobile 
                di bawah FlagSummary.
            */}
          </div>
        </>
      )}
    </div>
  );
}