import { motion, AnimatePresence } from "motion/react";
import { useStations } from "@/hooks/useStations";
import { IoIosClose } from "react-icons/io";
import { useState } from "react";
import { RiArrowDropDownLine } from "react-icons/ri";
import { useFlags, type FlagType } from "@/context/FlagContext";

interface StationDetailProps {
    closeStationDetail: () => void;
    getIsStationDetailOpen: () => boolean;
    getSelectedStation: () => number;
}

export default function StationDetail(props: StationDetailProps) {
    const { stations } = useStations();
    const station = stations[props.getSelectedStation()];
    const [isButtonsOpen, setIsButtonOpen] = useState(false);
    const { addFlag, problematicStations, optimalStations } = useFlags();
    const [isSaving, setIsSaving] = useState(false);

    const currentFlag: FlagType | null = station
        ? problematicStations.find((s) => s.id === station.id)
            ? "problematic"
            : optimalStations.find((s) => s.id === station.id)
            ? "optimal"
            : null
        : null;

    const handleFlag = async (type: FlagType) => {
        if (!station || isSaving || currentFlag === type) return;
        setIsSaving(true);
        try {
            await addFlag(station, type);
            setIsButtonOpen(false);
        } catch (err) {
            console.error("Gagal menyimpan flag:", err);
        } finally {
            setIsSaving(false);
        }
    };

    if (!station) return null;

    const densityPercent = `${Math.trunc(station.density_score * 100)}%`;

    return (
        <AnimatePresence>
            {props.getIsStationDetailOpen() && (
                <motion.div 
                className="fixed inset-0 bg-dark-1/50 backdrop-blur-xs flex justify-center items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}>
                    <motion.div 
                    className="relative min-w-90 font-mono bg-dark-1 rounded-xl border border-light-1/25 p-6 flex flex-col gap-6 text-light-1"
                    initial={{ y: 20 }}
                    animate={{ y: 0 }}
                    exit={{ y: 20 }}>
                        <div className="flex flex-col items-center gap-1">
                            <p className="text-xl font-sans font-bold">{station.name}</p>
                            <p className="text-sm text-light-2">{station.corridor}</p>
                            <p className="text-light-2 text-center text-sm">{station.coordinates[0]} {station.coordinates[1]}</p>
                            {station.ai_anomaly_flag && <p className="text-red-600 font-bold text-center text-sm">AI Anomaly</p>}
                        </div>
                        <div className="capitalize text-sm flex flex-col gap-2">
                            <div className="flex justify-between">
                                <p className="text-light-2">Level Kepadatan</p>
                                <p>{station.density_level}</p>
                            </div>
                            <div className="flex justify-between">
                                <p className="text-light-2">Jumlah Pengunjung</p>
                                <p>{station.passenger_count} orang</p>
                            </div>
                            <div className="flex justify-between">
                                <p className="text-light-2">Waktu Tinggal</p>
                                <p>{station.avg_dwell_time_sec} dtk</p>
                            </div>
                            <div className="flex justify-between">
                                <p className="text-light-2">Waktu Tunggu</p>
                                <p>{station.bus_arrival_eta_sec} dtk</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-4">
                                <div className="h-1.5 w-full rounded-2xl bg-dark-2 flex">
                                    <motion.div
                                    className="h-full bg-light-1 rounded-2xl"
                                    initial={{ width: 0 }}
                                    animate={{ width: densityPercent }}
                                    exit={{ width: 0 }}/>
                                </div>
                                <p className="text-sm">{densityPercent}</p>
                            </div>
                            <p className="text-sm text-light-2 self-center">Tingkat Kepadatan</p>
                            <button className="flex gap-2 items-center justify-center text-light-2 mt-3" onClick={() => setIsButtonOpen(!isButtonsOpen)}>
                                <p className="text-sm">
                                    {currentFlag === "problematic" && "Ditandai Bermasalah"}
                                    {currentFlag === "optimal" && "Ditandai Optimal"}
                                    {!currentFlag && "Aksi"}
                                </p>
                                <RiArrowDropDownLine 
                                className="transition-transform duration-300 ease-in-out"
                                style={{ transform: `rotate(${isButtonsOpen ? 0 : -180}deg)` }} />
                            </button>
                            <AnimatePresence>
                                {isButtonsOpen && (
                                    <motion.div 
                                    className="flex gap-4 text-sm"
                                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                    animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                                    exit={{ opacity: 0, height: 0, marginTop: 0 }}>
                                        <motion.button 
                                            onClick={() => handleFlag("problematic")}
                                            disabled={isSaving || currentFlag === "problematic"}
                                            className="bg-red-1/10 text-red-1 py-2 flex-1 rounded-sm hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                            Bermasalah
                                        </motion.button>
                                        <motion.button 
                                            onClick={() => handleFlag("optimal")}
                                            disabled={isSaving || currentFlag === "optimal"}
                                            className="bg-green-1/10 text-green-1 py-2 flex-1 rounded-sm hover:bg-green-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                            Optimal
                                        </motion.button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    <IoIosClose className="absolute right-2 top-2 text-2xl text-light-2" onClick={() => {props.closeStationDetail(); setIsButtonOpen(false)}}/>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}