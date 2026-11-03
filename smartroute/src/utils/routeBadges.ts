// src/utils/routeBadges.ts
//
// Hari 2 Task 3: lencana kartu hasil rute — MAKS. SATU per kartu, BUKAN
// filter dan TIDAK mengubah urutan (aturan main no. 2). Fungsi murni supaya
// bisa diuji dengan AQI tiruan (scripts/test-route-badges.mts).
//
// Dihitung dari SELURUH kandidat respons backend, bukan daftar yang sudah
// disaring chip — lencana tidak berpindah-pindah saat chip diganti.
// Tie-break deterministik: urutan backend (rank) lalu route_id.
//
// 1. "Paling hijau": CO₂ estimasi terendah (butuh >= 2 kandidat ber-CO₂).
// 2. Lencana udara (hanya bila ada data AQI yang TIDAK stale):
//    - AQI Baik/Sedang -> "Aktif sehat": rute dengan total jalan kaki
//      "sedang" 800–1.600 m (keputusan Khalifa; TODO:verifikasi rentang).
//    - AQI >= Tidak sehat bagi kelompok sensitif -> "Minim paparan": rute
//      dengan jalan kaki terpendek.
//    Bentrok dengan "Paling hijau": "Paling hijau" menang, lencana udara
//    pindah ke rute berikutnya yang memenuhi syarat (atau tidak dipasang).
// Heuristik sederhana, bukan saran medis.
import type { AqiCategoryKey } from "@/services/airQualityService";
import type { RouteItem } from "@/type";
import { t } from "@/i18n";

export const WALK_MODERATE_MIN_M = 800;
export const WALK_MODERATE_MAX_M = 1600;

export type RouteBadgeKind = "paling_hijau" | "aktif_sehat" | "minim_paparan";

export interface RouteBadge {
  kind: RouteBadgeKind;
  label: string;
}

export const BADGE_LABELS: Record<RouteBadgeKind, string> = {
  get paling_hijau() {
    return t("badge.paling_hijau");
  },
  get aktif_sehat() {
    return t("badge.aktif_sehat");
  },
  get minim_paparan() {
    return t("badge.minim_paparan");
  },
};

type Candidate = Pick<RouteItem, "route_id" | "rank" | "walking_distance_m" | "co2">;

const byRankThenId = (a: Candidate, b: Candidate) => a.rank - b.rank || a.route_id.localeCompare(b.route_id);

export function computeRouteBadges(
  routes: Candidate[],
  air: { category_key: AqiCategoryKey; stale: boolean } | null,
): Record<string, RouteBadge> {
  const badges: Record<string, RouteBadge> = {};

  const withCo2 = routes.filter((r) => r.co2 != null);
  if (withCo2.length >= 2) {
    const greenest = [...withCo2].sort((a, b) => a.co2!.estimate_g - b.co2!.estimate_g || byRankThenId(a, b))[0];
    badges[greenest.route_id] = { kind: "paling_hijau", label: BADGE_LABELS.paling_hijau };
  }

  if (air && !air.stale) {
    const free = routes.filter((r) => !badges[r.route_id]);
    if (air.category_key === "baik" || air.category_key === "sedang") {
      const pick = free
        .filter((r) => r.walking_distance_m >= WALK_MODERATE_MIN_M && r.walking_distance_m <= WALK_MODERATE_MAX_M)
        .sort(byRankThenId)[0];
      if (pick) badges[pick.route_id] = { kind: "aktif_sehat", label: BADGE_LABELS.aktif_sehat };
    } else {
      const pick = [...free].sort((a, b) => a.walking_distance_m - b.walking_distance_m || byRankThenId(a, b))[0];
      if (pick) badges[pick.route_id] = { kind: "minim_paparan", label: BADGE_LABELS.minim_paparan };
    }
  }

  return badges;
}

/** Penjelasan saat lencana diketuk. */
export function badgeExplanation(kind: RouteBadgeKind): string {
  switch (kind) {
    case "paling_hijau":
      return t("badge.paling_hijau.body");
    case "aktif_sehat":
      return t("badge.aktif_sehat.body", { min: WALK_MODERATE_MIN_M, max: WALK_MODERATE_MAX_M });
    case "minim_paparan":
      return t("badge.minim_paparan.body");
  }
}
