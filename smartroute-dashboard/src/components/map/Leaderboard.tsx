import { motion, AnimatePresence } from "motion/react";
import { useState, useMemo } from "react";
import { useStations } from "@/hooks/useStations";
import { RiArrowDropDownLine } from "react-icons/ri";

type SortOrder = "desc" | "asc";

export default function Leaderboard() {
    const [isOpen, setIsOpen] = useState(false);
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
    const { stations } = useStations();

    // Urutkan stasiun berdasarkan density_score
    const sortedStations = useMemo(() => {
        return [...stations].sort((a, b) => {
            return sortOrder === "desc" 
                ? b.density_score - a.density_score 
                : a.density_score - b.density_score;
        });
    }, [stations, sortOrder]);

    const getDensityPercent = (score: number) => `${Math.trunc(score * 100)}%`;

    return (
        <div className="absolute top-19 right-6 z-50 font-mono flex flex-col gap-2">
            {/* Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-dark-1 w-fit self-end border border-light-1/25 rounded-md px-4 py-2 text-light-1 shadow-lg cursor-pointer"
            >
                <span className="text-sm tracking-wide">Leaderboard</span>
                <RiArrowDropDownLine 
                    className={`transition-transform duration-300 ease-in-out text-lg ${isOpen ? "rotate-0" : "-rotate-180"}`} 
                />
            </motion.button>

            {/* Dropdown Content */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="bg-dark-1 border border-light-1/25 rounded-xl p-4 w-72 shadow-xl flex flex-col gap-3">
                            
                            {/* Sort Controls */}
                            <div className="flex justify-between text-xs">
                                <button 
                                    onClick={() => setSortOrder("desc")}
                                    className={`py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap w-[calc(50%-4px)] ${
                                        sortOrder === "desc" 
                                            ? "bg-light-1 text-dark-1 font-bold" 
                                            : "bg-dark-2 text-light-2 hover:text-light-1"
                                    }`}
                                >
                                    Terpadat ↓
                                </button>
                                <button 
                                    onClick={() => setSortOrder("asc")}
                                    className={`py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap w-[calc(50%-4px)] ${
                                        sortOrder === "asc" 
                                            ? "bg-light-1 text-dark-1 font-bold" 
                                            : "bg-dark-2 text-light-2 hover:text-light-1"
                                    }`}
                                >
                                    Tersedikit ↑
                                </button>
                            </div>

                            {/* ✅ Station List dengan Custom Scrollbar Minimalis */}
                            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-light-1/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-light-1/20 transition-colors">
                                {sortedStations.map((station, index) => (
                                    <motion.div
                                        key={station.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.03 }}
                                        className="flex flex-col gap-1"
                                    >
                                        <div className="flex justify-between items-end text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="text-light-2 text-xs w-4">{index + 1}.</span>
                                                <span className="text-light-1 truncate max-w-35">
                                                    {station.name}
                                                </span>
                                            </div>
                                            <span className="text-light-2 text-xs whitespace-nowrap">
                                                {getDensityPercent(station.density_score)}
                                            </span>
                                        </div>
                                        
                                        {/* Progress Bar Mini */}
                                        <div className="h-1 rounded-full bg-dark-2 overflow-hidden ml-6">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: getDensityPercent(station.density_score) }}
                                                transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.03 + 0.1 }}
                                                className="h-full bg-light-1 rounded-full"
                                            />
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}