// src/utils/a11yDisplay.ts
//
// Hari 3 Task 2: tampilan info aksesibilitas kursi roda di kartu & layar
// hasil. Fungsi murni (diuji di scripts/test-assistive-settings.mts).
// Keputusan Khalifa: "tinggi" tetap ada di backend, tetapi TIDAK
// ditampilkan selama data perjalanan/armada belum lengkap; bahasa
// "tercatat ... (menurut data GTFS)"; tidak menyaring/mengurutkan; bila
// SEMUA kandidat rendah, layar menyatakannya terus terang.
import type { RouteItem } from "@/type";

export interface ConfidenceDisplay {
  label: string;
  bg: string;
  fg: string;
  icon: "close-circle" | "help-circle" | "checkmark-circle" | "ellipse-outline";
}

export function confidenceDisplay(info: NonNullable<RouteItem["accessibility"]>): ConfidenceDisplay {
  const level = info.confidence === "tinggi" && info.trip_data !== "lengkap" ? "sedang" : info.confidence;
  switch (level) {
    case "rendah":
      return { label: "Kursi roda: ada halte tercatat tak bisa diakses", bg: "#FEF2F2", fg: "#991B1B", icon: "close-circle" };
    case "tidak_diketahui":
      return { label: "Kursi roda: data tidak lengkap", bg: "#F4F4F0", fg: "#404040", icon: "help-circle" };
    case "sedang":
      return { label: "Kursi roda: halte tercatat bisa · data armada belum ada", bg: "#FEF3C7", fg: "#78350F", icon: "ellipse-outline" };
    case "tinggi":
      return { label: "Kursi roda: halte & armada tercatat bisa", bg: "#D1FAE5", fg: "#065F46", icon: "checkmark-circle" };
  }
}

/** Teks banner di atas daftar saat info aksesibilitas aktif. */
export function a11yBanner(routes: Pick<RouteItem, "accessibility">[]): { general: string; allLow: string | null } {
  const withInfo = routes.filter((r) => r.accessibility);
  const allLow = withInfo.length > 0 && withInfo.every((r) => r.accessibility!.confidence === "rendah");
  return {
    general: "Data aksesibilitas belum lengkap untuk sebagian halte/stasiun.",
    allLow: allLow
      ? "Semua rute yang ditemukan melewati setidaknya satu halte yang tercatat tidak bisa diakses kursi roda (menurut data GTFS). Pertimbangkan meminta bantuan petugas, atau ketuk tiap rute untuk melihat halte mana."
      : null,
  };
}
