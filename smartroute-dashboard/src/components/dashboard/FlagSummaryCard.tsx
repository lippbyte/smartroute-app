// src/components/dashboard/FlagSummaryCard.tsx
import { motion, AnimatePresence } from "motion/react";
import {
  RiBarChartGroupedLine,
  RiAlertLine,
  RiCheckDoubleLine,
  RiSearchLine, // Icon baru
} from "react-icons/ri";
import { useState, useEffect, useMemo } from 'react'; // Tambah useMemo
import { getAllFlags, type FlagRow } from "@/services/api";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface FlagSummaryCardProps {
  problematicCount: number;
  optimalCount: number;
}

export default function FlagSummaryCard({
  problematicCount,
  optimalCount,
}: FlagSummaryCardProps) {
  const [isSummary, setIsSummary] = useState(true);
  const [historyData, setHistoryData] = useState<FlagRow[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState(""); // State Search

  useEffect(() => {
    if (!isSummary && historyData.length === 0) {
      // eslint-disable-next-line react-hooks/immutability
      fetchHistory();
    }
  }, [historyData.length, isSummary]);

  async function fetchHistory() {
    try {
      setIsLoadingHistory(true);
      const data = await getAllFlags();
      const sorted = [...data].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setHistoryData(sorted);
    } catch (error) {
      console.error("Gagal ambil riwayat:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  // Logic Filtering Search
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return historyData;
    const lowerQuery = searchQuery.toLowerCase();
    return historyData.filter(flag => 
      flag.station_name.toLowerCase().includes(lowerQuery) ||
      (flag.notes && flag.notes.toLowerCase().includes(lowerQuery)) ||
      flag.flag_type.toLowerCase().includes(lowerQuery)
    );
  }, [historyData, searchQuery]);

  const formatDateShort = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM HH:mm", { locale: localeId });
    } catch {
      return "-";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-dark-1 border border-light-1/25 rounded-xl p-6 flex flex-col gap-4 font-mono h-full" // Gap dikurangi sedikit agar muat search
    >
      <div>
        <h2 className="text-xl font-sans font-bold text-light-1 flex items-center gap-2">
          <RiBarChartGroupedLine className="text-xl" />
          Status Catatan Halte
        </h2>
        <p className="text-sm text-light-2 mt-1">
          {isSummary ? 'Jumlah stasiun dan halte yang sedang ditandai' : 'Riwayat stasiun dan halte yang pernah ditandai'}
        </p>
      </div>

      {/* Input Search - Hanya muncul di mode Riwayat */}
      <AnimatePresence>
        {!isSummary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative overflow-hidden"
          >
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-light-2 pointer-events-none">
              <RiSearchLine className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Cari stasiun atau catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-dark-2 border border-light-1/10 rounded-md pl-9 pr-3 py-2 text-sm text-light-1 placeholder:text-light-2/50 focus:outline-none focus:border-light-1/30 transition-colors"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode='wait'>
        {isSummary ? (
          <motion.div 
            key={'summary'}
            initial={{opacity: 0, y: 20, scale: 0.98 }}
            animate={{opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1]}}}
            exit={{opacity: 0, y: -10, scale: 0.95, transition: {duration: 0.2, ease: "easeIn"}}}
            className="grid grid-cols-2 gap-4 text-sm"
          >
            <div className="bg-red-1/10 border border-red-1/20 rounded-md p-4 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-red-1">
                <RiAlertLine />
                <span>Bermasalah</span>
              </div>
              <span className="text-xl font-bold text-red-1">
                {problematicCount}
              </span>
            </div>

            <div className="bg-green-1/10 border border-green-1/20 rounded-md p-4 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-green-1">
                <RiCheckDoubleLine />
                <span>Optimal</span>
              </div>
              <span className="text-xl font-bold text-green-1">
                {optimalCount}
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={'history'}
            initial={{opacity: 0, y: 20, scale: 0.98 }}
            animate={{opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1]}}}
            exit={{opacity: 0, y: -10, scale: 0.95, transition: {duration: 0.2, ease: "easeIn"}}}
            className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto pr-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-light-1/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-light-1/20 text-sm"
          >
            {isLoadingHistory ? (
               <div className="py-4 text-center text-light-2 animate-pulse">Memuat riwayat...</div>
            ) : filteredHistory.length === 0 ? ( // Gunakan filteredHistory di sini
               <div className="py-4 text-center text-light-2">
                 {searchQuery ? 'Tidak ditemukan hasil cocok' : 'Belum ada riwayat catatan'}
               </div>
            ) : (
              filteredHistory.map((flag) => ( // Map menggunakan filteredHistory
                <div 
                  key={flag.id}
                  className={`p-3 rounded-md border ${
                    flag.active_flag 
                      ? 'border-yellow-500/30 bg-yellow-500/5' 
                      : 'border-light-1/10 bg-dark-2/30 opacity-70'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`font-bold truncate mr-2 ${
                      flag.flag_type === 'problematic' ? 'text-red-1' : 'text-green-1'
                    }`}>
                      {flag.station_name}
                    </span>
                    <span className="text-xs text-light-2 whitespace-nowrap">
                      {formatDateShort(flag.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-light-2">
                     {flag.flag_type === 'problematic' ? (
                       <RiAlertLine className="text-red-1 w-3 h-3 shrink-0" />
                     ) : (
                       <RiCheckDoubleLine className="text-green-1 w-3 h-3 shrink-0" />
                     )}
                     <span className="truncate">
                       {flag.notes || (flag.flag_type === 'problematic' ? 'Ditandai Bermasalah' : 'Ditandai Optimal')}
                     </span>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className='flex flex-col gap-4 mt-auto pt-4 border-t border-light-1/10'>
        <button onClick={() => {
            setIsSummary(!isSummary);
            setSearchQuery(""); // Reset search saat ganti mode
        }} className='w-full py-2 bg-dark-2 hover:bg-light-1/10 text-light-1 rounded-sm text-sm transition-colors border border-light-1/10 cursor-pointer'>
          Mode: {isSummary ? 'Ringkasan' : 'Riwayat'}
        </button>
      </div>
    </motion.div>
  );
}