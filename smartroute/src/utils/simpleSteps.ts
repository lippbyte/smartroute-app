// src/utils/simpleSteps.ts
//
// Hari 3 Task 2: kalimat langkah navigasi yang LUGAS — satu kalimat
// perintah + satu kalimat keterangan — untuk "Mode sederhana" (kognitif/
// neurodivergen) dan "Peringatan teks besar" (tunarungu).
import { legModeStyle } from "@/components/transit/legModes";
import type { Leg } from "@/type";
import { boardText, formatDistance, isWalkLeg, stopCount } from "@/utils/navInstructions";

export interface PlainStep {
  title: string;
  detail: string;
}

export function plainStep(leg: Leg, isLastLeg: boolean, opts?: { onBoard?: boolean; stopsRemaining?: number | null }): PlainStep {
  if (isWalkLeg(leg)) {
    const dist = leg.distance_m ? formatDistance(leg.distance_m) : null;
    return {
      title: isLastLeg ? `Jalan kaki ke tujuan: ${leg.to}` : `Jalan kaki ke ${leg.to}`,
      detail: dist ? `Jaraknya sekitar ${dist}.` : "Ikuti jalan menuju titik berikutnya.",
    };
  }
  const place = legModeStyle(leg.mode).isRail ? "stasiun" : "halte";
  if (opts?.onBoard) {
    const left = opts.stopsRemaining;
    return {
      title: `Turun di ${leg.to}`,
      detail: left != null ? `Tinggal ${left} ${place} lagi. Tetap di dalam kendaraan.` : "Tetap di dalam kendaraan sampai sana.",
    };
  }
  const n = stopCount(leg);
  return {
    title: `${boardText(leg)}`,
    detail: `Naik di ${leg.from}. Turun di ${leg.to}${n != null ? ` (${n} ${place})` : ""}.`,
  };
}
