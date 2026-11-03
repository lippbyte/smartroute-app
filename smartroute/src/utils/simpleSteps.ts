// src/utils/simpleSteps.ts
//
// Hari 3 Task 2: kalimat langkah navigasi yang LUGAS — satu kalimat
// perintah + satu kalimat keterangan — untuk "Mode sederhana" (kognitif/
// neurodivergen) dan "Peringatan teks besar" (tunarungu).
import { legModeStyle } from "@/components/transit/legModes";
import type { Leg } from "@/type";
import { boardText, formatDistance, isWalkLeg, stopCount } from "@/utils/navInstructions";
import { stopWord, t } from "@/i18n";

export interface PlainStep {
  title: string;
  detail: string;
}

export function plainStep(leg: Leg, isLastLeg: boolean, opts?: { onBoard?: boolean; stopsRemaining?: number | null }): PlainStep {
  if (isWalkLeg(leg)) {
    const dist = leg.distance_m ? formatDistance(leg.distance_m) : null;
    return {
      title: isLastLeg ? t("nav.simple.walkDest", { place: leg.to }) : t("nav.walkTo", { place: leg.to }),
      detail: dist ? t("nav.simple.distance", { distance: dist }) : t("nav.simple.follow"),
    };
  }
  const isRail = legModeStyle(leg.mode).isRail;
  if (opts?.onBoard) {
    const left = opts.stopsRemaining;
    return {
      title: t("nav.getOff", { place: leg.to }),
      detail: left != null ? t("nav.simple.left", { n: left, unit: stopWord(isRail, left) }) : t("nav.simple.stay"),
    };
  }
  const n = stopCount(leg);
  return {
    title: `${boardText(leg)}`,
    detail: t("nav.simple.boardAt", { from: leg.from, to: leg.to, count: n != null ? ` (${n} ${stopWord(isRail, n)})` : "" }),
  };
}
