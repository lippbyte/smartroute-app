import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { RiDashboardLine, RiMapPinLine } from "react-icons/ri";

export default function ViewToggle() {
  const location = useLocation();
  const navigate = useNavigate();

  // Tentukan mode aktif berdasarkan pathname
  const currentPath = location.pathname;
  const isMap = currentPath.includes("/map");

  return (
    <div className="fixed top-6 right-6 z-100 flex items-center bg-dark-2/90 backdrop-blur border border-light-1/15 rounded-lg p-1 font-mono text-sm shadow-xl">
      {/* Tombol Dashboard */}
      <button
        onClick={() => navigate("/")}
        className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer select-none ${
          !isMap ? "text-dark-1 font-bold" : "text-light-2 hover:text-light-1"
        }`}
      >
        {!isMap && (
          <motion.div
            layoutId="viewToggleBackground"
            className="absolute inset-0 bg-light-1 rounded-md"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <RiDashboardLine className="relative z-10 text-sm" />
        <span className="relative z-10 text-sm">Dashboard</span>
      </button>

      {/* Tombol Peta Interaktif */}
      <button
        onClick={() => navigate("/map")}
        className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer select-none ${
          isMap ? "text-dark-1 font-bold" : "text-light-2 hover:text-light-1"
        }`}
      >
        {isMap && (
          <motion.div
            layoutId="viewToggleBackground"
            className="absolute inset-0 bg-light-1 rounded-md"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <RiMapPinLine className="relative z-10 text-sm" />
        <span className="relative z-10 text-sm">Peta Interaktif</span>
      </button>
    </div>
  );
}