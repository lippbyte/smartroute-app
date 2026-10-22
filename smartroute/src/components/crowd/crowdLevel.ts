// src/components/crowd/crowdLevel.ts
//
// Task App-03: skema level kepadatan yang dipakai bersama oleh layar
// crowd-map.tsx (legenda) dan kedua implementasi peta
// (CrowdMapView.web.tsx / CrowdMapView.native.tsx) — supaya warna & label
// tidak pernah divergen antar platform.
import { CrowdOverviewStop } from "@/services/crowdService";

export type CrowdLevel = CrowdOverviewStop["level"];

export const LEVEL_LABEL: Record<CrowdLevel, string> = {
  low: "Lengang",
  moderate: "Cukup Padat",
  high: "Padat",
};

export const LEVEL_COLOR: Record<CrowdLevel, string> = {
  low: "#22C55E",
  moderate: "#EAB308",
  high: "#EF4444",
};

const MONTHS_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

// Sengaja tidak pakai Date#toLocaleString("id-ID", ...): di Android, Intl
// bergantung pada bagaimana Hermes dibuild, jadi hasilnya tidak dijamin sama
// dengan web. Formatter manual ini menghasilkan string yang identik dengan
// yang sudah terverifikasi di versi web ("6 Sep 2026, 18.58") di kedua
// platform, tanpa bergantung ke Intl sama sekali.
export function formatReportedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";

  const day = date.getDate();
  const month = MONTHS_ID[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day} ${month} ${year}, ${hours}.${minutes}`;
}
