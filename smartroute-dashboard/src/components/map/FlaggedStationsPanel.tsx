import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { RiArrowDropDownLine } from "react-icons/ri";
import { useFlags, type FlagType } from "@/context/FlagContext";

export default function FlaggedStationPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<FlagType>("problematic");
    const { problematicStations, optimalStations } = useFlags();

    const currentList = activeTab === "problematic" ? problematicStations : optimalStations;

    return (
        <div className="absolute top-6 left-6 z-50 font-mono flex flex-col gap-2">
            {/* Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center w-fit gap-2 bg-dark-1 border border-light-1/25 rounded-md px-4 py-2 text-light-1 shadow-lg cursor-pointer"
            >
                <span className="text-sm tracking-wide">Flagged Stations</span>
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
                            
                            {/* Tabs Filter */}
                            <div className="flex justify-between text-xs">
                                <button 
                                    onClick={() => setActiveTab("problematic")}
                                    className={`py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap w-[calc(50%-4px)] ${
                                        activeTab === "problematic" 
                                            ? "bg-red-1/20 text-red-1 font-bold" 
                                            : "bg-dark-2 text-light-2 hover:text-light-1"
                                    }`}
                                >
                                    Bermasalah ({problematicStations.length})
                                </button>
                                <button 
                                    onClick={() => setActiveTab("optimal")}
                                    className={`py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap w-[calc(50%-4px)] ${
                                        activeTab === "optimal" 
                                            ? "bg-green-1/20 text-green-1 font-bold" 
                                            : "bg-dark-2 text-light-2 hover:text-light-1"
                                    }`}
                                >
                                    Optimal ({optimalStations.length})
                                </button>
                            </div>

                            {/* List Container — tampilan saja, kelola flag dilakukan di Dashboard */}
                            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-light-1/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-light-1/20 transition-colors">
                                {currentList.length === 0 ? (
                                    <p className="text-center text-light-2/50 text-xs py-8 italic">
                                        Belum ada stasiun ditandai
                                    </p>
                                ) : (
                                    currentList.map((station, index) => (
                                        <motion.div
                                            key={station.dbId}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.03 }}
                                            className="flex items-center justify-between"
                                        >
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-light-1 text-sm truncate max-w-40">
                                                    {station.name}
                                                </span>
                                                <span className="text-light-2/60 text-[10px]">
                                                    {station.corridor} • {Math.trunc(station.density_score * 100)}%
                                                </span>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}