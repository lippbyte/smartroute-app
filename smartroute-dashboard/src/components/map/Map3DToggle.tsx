// src/components/map/Map3DToggle.tsx
import { useState, useEffect, useRef } from "react";
import { Map, type MapRef } from "@/components/ui/map";
import { motion } from "motion/react";
import { RiBuilding4Line, RiMapPinLine } from "react-icons/ri";

interface Map3DToggleProps {
  center: [number, number];
  zoom: number;
  children?: React.ReactNode;
}

export default function Map3DToggle({ center, zoom, children }: Map3DToggleProps) {
  const mapRef = useRef<MapRef>(null);
  const [is3D, setIs3D] = useState(false);

  const style3D = "https://tiles.openfreemap.org/styles/liberty";

  // Batas wilayah Jakarta
  const jakartaBounds: [[number, number], [number, number]] = [
    [106.5, -6.4], 
    [107.1, -6.0], 
  ];

  useEffect(() => {
    if (!mapRef.current) return;

    mapRef.current.easeTo({
      pitch: is3D ? 60 : 0,
      bearing: is3D ? -17.6 : 0,
      duration: 800,
      easing: (t) => t * (2 - t),
    });
  }, [is3D]);

  return (
    <div className="relative h-full w-full">
      {/* Pastikan MapControls tidak menabrak tombol 3D */}
      <Map
        ref={mapRef}
        center={center}
        zoom={zoom}
        minZoom={12}
        maxBounds={jakartaBounds}
        styles={{
          light: is3D ? style3D : undefined,
          dark: is3D ? style3D : undefined,
        }}
        projection={is3D ? { type: "globe" } : undefined}
      >
        {/* Paksa MapControls tetap di kanan agar tidak bentrok dengan tombol 3D di kiri */}
        <div className="pointer-events-none absolute inset-0">
           {/* Kita asumsikan children berisi MapControls. 
               Jika MapControls punya prop position, set ke 'bottom-right' */}
           {children}
        </div>
      </Map>

      {/* Tombol Toggle 3D - Dipaksa ke Kiri Bawah dengan z-index Tinggi */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIs3D(!is3D)}
        // ✅ Perubahan Kunci:
        // 1. Gunakan left-6 bottom-6 eksplisit
        // 2. Tambah z-[60] agar pasti di atas MapControls (biasanya z-10 atau z-20)
        // 3. Tambah pointer-events-auto agar bisa diklik meski ada overlay
        className="absolute bottom-6 left-6 z-60 flex items-center gap-2 px-4 py-2 rounded-lg border shadow-lg backdrop-blur-md transition-all font-mono text-sm pointer-events-auto
          bg-dark-1/90 text-light-1 border-light-1/25 hover:bg-dark-1
          data-[active=true]:bg-light-1 data-[active=true]:text-dark-1 data-[active=true]:border-light-1/50 data-[active=true]:font-bold"
        data-active={is3D}
      >
        {is3D ? <RiMapPinLine /> : <RiBuilding4Line />}
        <span>{is3D ? "Mode 2D" : "Mode 3D"}</span>
      </motion.button>
    </div>
  );
}