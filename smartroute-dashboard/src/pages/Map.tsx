import { MapControls, MapMarker, MarkerContent, MarkerPopup, MarkerTooltip } from "@/components/ui/map";
import { useStations } from "@/hooks/useStations";
import { motion } from "motion/react";
import { useState } from "react";
import StationDetail from "@/components/map/StationDetail";
import Leaderboard from "@/components/map/Leaderboard";
import FlaggedStationsPanel from "@/components/map/FlaggedStationsPanel";
import Map3DToggle from "@/components/map/Map3DToggle";
import ViewToggle from "@/components/ui/ViewToggle";
import DigitalClock from "@/components/ui/DigitalClock";
import LogoutButton from "@/components/ui/LogoutButton";

function getHeatmapColor(score: number): string {
  if (score >= 0.9) return "oklch(68% 0.16 25)";
  if (score >= 0.7) return "oklch(74% 0.13 55)";
  if (score >= 0.4) return "oklch(80% 0.10 95)";
  return "oklch(76% 0.09 165)";
}

export default function Map() {
  const [isStationDetailOpen, setIsStationDetailOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState(Number(null));
  const { stations } = useStations();

  function openStationDetail(index: number) {
    setIsStationDetailOpen(true);
    setSelectedStation(index);
  }

  const closeStationDetail = () => setIsStationDetailOpen(false);
  const getIsStationDetailOpen = () => isStationDetailOpen;
  const getSelectedStation = () => selectedStation;

  return (
    <div className="bg-dark-1 overflow-hidden relative">
      {/* Component ViewToggle yang kini sudah self-positioned */}
      <ViewToggle />
      <DigitalClock />
      <LogoutButton />

      <div className="hidden md:block h-screen w-full relative">
        <Map3DToggle center={[106.816666, -6.200000]} zoom={11}>
          <MapControls />
          {stations.map((item, index) => (
            <MapMarker key={item.id} longitude={item.coordinates[1]} latitude={item.coordinates[0]}>
              <MarkerContent>
                <div className="relative flex items-center justify-center">
                  <div
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      width: "32px",
                      height: "32px",
                      backgroundColor: getHeatmapColor(item.density_score),
                      opacity: 0.4 + item.density_score * 0.4,
                      filter: `blur(${10 + item.density_score * 12}px)`,
                      transform: "translate(-50%, -50%)",
                      top: "50%",
                      left: "50%",
                    }}
                  />
                  <motion.div
                    className="relative z-10 w-3 rounded-full aspect-square border border-dark-1/20 cursor-pointer"
                    animate={{ scale: 1.25 }}
                    style={{
                      backgroundColor: getHeatmapColor(item.density_score),
                      boxShadow: `0 0 ${6 + item.density_score * 12}px ${getHeatmapColor(item.density_score)}`,
                    }}
                    transition={{
                      repeat: Infinity,
                      repeatType: "mirror",
                      duration: 2,
                      ease: "linear",
                    }}
                  />
                </div>
              </MarkerContent>
              <MarkerTooltip className="font-mono text-xs border border-light-1/25 bg-dark-1 text-light-1 px-2 py-1 rounded">
                {item.name}
              </MarkerTooltip>
              <MarkerPopup className="bg-dark-1 border border-light-1/25 p-3 rounded-lg shadow-xl">
                <div className="space-y-2 flex flex-col">
                  <div>
                    <p className="text-sm font-bold font-sans text-light-1">{item.name}</p>
                    <p className="text-xs font-mono text-light-2 mt-1">
                      Kepadatan: <span className="text-light-1 font-semibold">{item.density_level}</span>
                    </p>
                    <p className="text-xs font-mono text-light-2">
                      Pengunjung: <span className="text-light-1 font-semibold">{item.passenger_count} orang</span>
                    </p>
                  </div>
                  <button
                    className="w-full bg-dark-2 hover:bg-light-1/10 border border-light-1/15 text-light-1 font-bold font-mono text-xs py-1.5 rounded-md transition-colors cursor-pointer"
                    onClick={() => openStationDetail(index)}
                  >
                    Lihat Lengkap →
                  </button>
                </div>
              </MarkerPopup>
            </MapMarker>
          ))}
        </Map3DToggle>
      </div>

      <StationDetail
        closeStationDetail={closeStationDetail}
        getIsStationDetailOpen={getIsStationDetailOpen}
        getSelectedStation={getSelectedStation}
      />
      <Leaderboard />
      <FlaggedStationsPanel />

      <div className="flex md:hidden w-full h-screen justify-center items-center text-sm font-mono p-4 text-center text-light-1">
        Buka website di desktop untuk mengakses peta interaktif.
      </div>
    </div>
  );
}