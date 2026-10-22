// Teks instruksi perjalanan (detail rute & layar navigasi) dari data leg
// backend. Satu tempat supaya kalimat di detail dan di navigasi sama persis.
import { legModeStyle } from "@/components/transit/legModes";
import { Leg } from "@/type";

export type LatLng = { latitude: number; longitude: number };

export function formatClock(iso?: string): string | null {
  if (!iso) return null;
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

export function isWalkLeg(leg: Leg): boolean {
  return leg.mode.toLowerCase() === "walk";
}

export function legDurationMin(leg: Leg): number | null {
  if (!leg.depart_at || !leg.arrive_at) return null;
  const ms = Date.parse(leg.arrive_at) - Date.parse(leg.depart_at);
  return Number.isFinite(ms) ? Math.max(1, Math.round(ms / 60000)) : null;
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

// OTP2 memberi nama generik untuk ruas tanpa nama di OSM.
const GENERIC_STREETS: Record<string, string> = {
  sidewalk: "trotoar",
  path: "jalan setapak",
  footway: "jalan setapak",
  "service road": "jalan akses",
  steps: "tangga",
  footbridge: "jembatan penyeberangan",
  bridge: "jembatan",
  "open area": "area terbuka",
  platform: "peron",
  underpass: "terowongan penyeberangan",
  corridor: "lorong",
  road: "jalan",
  track: "jalan tanah",
  "bike path": "jalur sepeda",
  "parking aisle": "area parkir",
};

export function streetLabel(street: string): string {
  const s = street.trim();
  // Ruas OSM tanpa nama kadang bocor sebagai id mentah
  // ("way 1249875201 from 0") — lebih baik tanpa nama sama sekali.
  if (/^way \d+/i.test(s) || /^osm:/i.test(s)) return "";
  return GENERIC_STREETS[s.toLowerCase()] ?? s;
}

const DIRECTION_TEXT: Record<string, string> = {
  DEPART: "Mulai jalan",
  CONTINUE: "Lurus terus",
  LEFT: "Belok kiri",
  RIGHT: "Belok kanan",
  SLIGHTLY_LEFT: "Serong kiri",
  SLIGHTLY_RIGHT: "Serong kanan",
  HARD_LEFT: "Belok tajam ke kiri",
  HARD_RIGHT: "Belok tajam ke kanan",
  UTURN_LEFT: "Putar balik",
  UTURN_RIGHT: "Putar balik",
  CIRCLE_CLOCKWISE: "Masuk bundaran",
  CIRCLE_COUNTERCLOCKWISE: "Masuk bundaran",
  ELEVATOR: "Naik/turun lift",
  ENTER_STATION: "Masuk stasiun",
  EXIT_STATION: "Keluar stasiun",
  FOLLOW_SIGNS: "Ikuti petunjuk arah",
};

// Nama Ionicons untuk panah belokan di banner navigasi.
const DIRECTION_ICON: Record<string, string> = {
  DEPART: "walk",
  CONTINUE: "arrow-up",
  LEFT: "arrow-back",
  RIGHT: "arrow-forward",
  SLIGHTLY_LEFT: "arrow-up",
  SLIGHTLY_RIGHT: "arrow-up",
  HARD_LEFT: "arrow-back",
  HARD_RIGHT: "arrow-forward",
  UTURN_LEFT: "return-down-back",
  UTURN_RIGHT: "return-down-forward",
  CIRCLE_CLOCKWISE: "refresh",
  CIRCLE_COUNTERCLOCKWISE: "refresh",
  ELEVATOR: "swap-vertical",
  ENTER_STATION: "enter-outline",
  EXIT_STATION: "exit-outline",
  FOLLOW_SIGNS: "signpost-outline",
};

export function directionIcon(direction: string): string {
  return DIRECTION_ICON[direction] ?? "arrow-up";
}

export function walkStepText(step: { direction: string; street: string }): string {
  const verb = DIRECTION_TEXT[step.direction] ?? "Lanjutkan";
  const street = streetLabel(step.street);
  if (!street) return verb;
  if (step.direction === "DEPART") return `${verb} lewat ${street}`;
  if (step.direction === "CONTINUE") return `${verb} di ${street}`;
  return `${verb} ke ${street}`;
}

/**
 * "TransJakarta 4", "KRL Cikarang", "MRT" — nama rute kereta 1 huruf (MRT
 * "M") tidak menambah informasi; koridor bus 1 karakter ("4") tetap penting.
 */
export function serviceLabel(leg: Leg): string {
  if (!leg.service) return leg.mode;
  if (legModeStyle(leg.mode).isRail && leg.service.length <= 1) return leg.mode;
  return `${leg.mode} ${leg.service}`;
}

/** "Naik TransJakarta 13B arah Puri Beta" / "Naik MRT arah Lebak Bulus". */
export function boardText(leg: Leg): string {
  const what = serviceLabel(leg);
  return leg.headsign ? `Naik ${what} arah ${leg.headsign}` : `Naik ${what}`;
}

/** Jumlah pemberhentian dari naik sampai turun (termasuk halte turun). */
export function stopCount(leg: Leg): number | null {
  return leg.stops_passed ? leg.stops_passed.length + 1 : null;
}

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
