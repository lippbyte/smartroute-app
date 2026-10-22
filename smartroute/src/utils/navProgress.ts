// Posisi user di sepanjang jalur leg (dari GPS), untuk instruksi navigasi:
// belokan berikutnya, sisa halte, sisa jarak. Semua berbasis geometri leg
// dari backend (OTP2), tanpa panggilan jaringan.
import { Leg } from "@/type";
import { haversineM, LatLng } from "./navInstructions";

// Lebih jauh dari ini dari jalur leg = user dianggap tidak sedang di jalur
// (mis. demo dari laptop di tempat lain) — instruksi kembali ke awal leg.
export const OFF_ROUTE_M = 250;

export function legPath(leg: Leg): LatLng[] {
  if (leg.path && leg.path.length >= 2) {
    return leg.path.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
  }
  if (leg.from_coord && leg.to_coord) {
    return [
      { latitude: leg.from_coord.lat, longitude: leg.from_coord.lng },
      { latitude: leg.to_coord.lat, longitude: leg.to_coord.lng },
    ];
  }
  return [];
}

export function cumulativeDistances(path: LatLng[]): number[] {
  const out = [0];
  for (let i = 1; i < path.length; i++) out.push(out[i - 1] + haversineM(path[i - 1], path[i]));
  return out;
}

export function nearestVertex(path: LatLng[], p: LatLng): { index: number; dist: number } {
  let index = 0;
  let dist = Infinity;
  path.forEach((q, i) => {
    const d = haversineM(p, q);
    if (d < dist) {
      dist = d;
      index = i;
    }
  });
  return { index, dist };
}

export interface LegProgress {
  onRoute: boolean;
  // Jarak tersisa sampai ujung leg (meter), dan fraksi leg yang sudah lewat.
  remainingM: number;
  fraction: number;
  // Leg jalan kaki: indeks walk_steps berikutnya + jarak ke sana.
  nextStepIndex: number | null;
  distToNextStepM: number | null;
  // Leg transit: sisa pemberhentian sampai halte turun (termasuk halte turun).
  stopsRemaining: number | null;
  // Leg transit: user sudah bergerak menjauh dari halte naik (sedang di
  // kendaraan) — ganti instruksi dari "Naik ..." ke "Turun di ...".
  onBoard: boolean;
}

export function computeLegProgress(leg: Leg, user: LatLng | null): LegProgress {
  const path = legPath(leg);
  const cum = cumulativeDistances(path);
  const total = cum[cum.length - 1] ?? leg.distance_m ?? 0;
  const near = user && path.length ? nearestVertex(path, user) : null;
  const onRoute = !!near && near.dist <= OFF_ROUTE_M;
  const at = onRoute ? cum[near!.index] : 0;
  const remainingM = Math.max(0, total - at);
  const fraction = total > 0 ? at / total : 0;

  const indexOf = (lat?: number, lng?: number) =>
    lat != null && lng != null ? nearestVertex(path, { latitude: lat, longitude: lng }).index : -1;
  const userIdx = onRoute ? near!.index : -1;

  let nextStepIndex: number | null = null;
  let distToNextStepM: number | null = null;
  if (leg.walk_steps?.length) {
    const steps = leg.walk_steps;
    // Belokan pertama yang posisinya masih di depan user. Tanpa GPS di jalur:
    // mulai dari langkah pertama.
    let k = 0;
    if (onRoute) {
      k = steps.findIndex((s) => indexOf(s.lat, s.lng) > userIdx);
      if (k === -1) k = steps.length; // semua belokan sudah lewat
    }
    if (k < steps.length) {
      nextStepIndex = k;
      const stepIdx = indexOf(steps[k].lat, steps[k].lng);
      distToNextStepM = stepIdx >= 0 ? Math.max(0, cum[stepIdx] - at) : null;
    }
  }

  let stopsRemaining: number | null = null;
  let onBoard = false;
  if (leg.stops_passed) {
    const passedIdx = leg.stops_passed.map((s) => indexOf(s.lat, s.lng));
    const ahead = passedIdx.filter((i) => i > userIdx).length;
    stopsRemaining = ahead + 1; // + halte turun
    onBoard = onRoute && at > 150;
  }

  return { onRoute, remainingM, fraction, nextStepIndex, distToNextStepM, stopsRemaining, onBoard };
}
