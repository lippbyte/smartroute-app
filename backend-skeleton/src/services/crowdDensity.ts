// Task Backend-04: crowd-sourced density reports + recency-weighted
// aggregation.
//
// This is the only source of live/real-time data the team actually owns —
// no government API is real-time (all confirmed static/historical earlier).
// Model 0 (CV) is NOT a data source here — that stays a separate showcase,
// per the agreed decision; this module is fed exclusively by user reports.
//
// Storage is in-memory (a Map, process-lifetime only) — no database, no
// auth, no anti-spam/duplicate-report protection. That's a deliberate scope
// cut for the MVP per the task brief, not an oversight; documented as a
// known limitation in the README rather than solved here.

import { clusterMembersOf } from "./stopClusters";

export type CrowdLevel = "low" | "moderate" | "high";

export interface CrowdReport {
  stop_id: string;
  level: CrowdLevel;
  reported_at: Date;
}

// 15 minutes, per the task brief's explicit "starting point, boleh
// disesuaikan" — a report older than this no longer contributes at all.
const AGGREGATION_WINDOW_MS = 15 * 60 * 1000;

// Laporan semuda ini langsung menjadi status halte, tanpa dirata-rata dengan
// laporan lain (lihat getAggregatedCrowdLevel).
const FRESH_REPORT_WINS_MS = 2 * 60 * 1000;

// Ordinal score so "worse" has a well-defined meaning for both the
// recency-weighted average and the cross-stop worst-case pick.
const LEVEL_SCORE: Record<CrowdLevel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
};
const SCORE_TO_LEVEL: CrowdLevel[] = ["low", "moderate", "high"]; // index = score - 1

const reportsByStop = new Map<string, CrowdReport[]>();

export function recordCrowdReport(
  stopId: string,
  level: CrowdLevel,
  reportedAt: Date = new Date()
): CrowdReport {
  const report: CrowdReport = { stop_id: stopId, level, reported_at: reportedAt };
  const existing = reportsByStop.get(stopId);
  if (existing) {
    existing.push(report);
  } else {
    reportsByStop.set(stopId, [report]);
  }
  return report;
}

// Recency-weighted aggregation over the last AGGREGATION_WINDOW_MS: each
// report's weight decays linearly from ~1 (just reported) to 0 (right at the
// window edge), so a stale "penuh" from 14 minutes ago doesn't outweigh a
// fresh "lengang" from 30 seconds ago. Returns undefined when there is no
// report at all inside the window — callers must NOT substitute a default,
// per the task's explicit no-fake-data constraint.
//
// Laporan disimpan per peron (stop_id yang benar-benar dilaporkan, supaya peta
// kepadatan tetap menampilkan peron itu), tapi DIBACA per halte: laporan dari
// peron mana pun dalam klaster yang sama ikut dihitung. Tanpa ini, laporan di
// satu dari enam peron "Monumen Nasional" tidak berpengaruh ke rute yang
// lewat peron sebelahnya — lihat stopClusters.ts.
export function getAggregatedCrowdLevel(
  stopId: string,
  now: Date = new Date()
): CrowdLevel | undefined {
  const reports = clusterMembersOf(stopId).flatMap((id) => reportsByStop.get(id) ?? []);
  if (reports.length === 0) return undefined;

  // Laporan yang BARU SAJA masuk dipakai apa adanya (tidak dirata-rata).
  // Dilaporkan user 23 Sep 2026: melapor "Lengang" di halte yang barusan
  // dilaporkan "Padat" menghasilkan "Cukup Padat" — rata-rata dari dua
  // laporan yang sama-sama segar — sehingga status terlihat tidak pernah
  // berubah setelah melapor. Kondisi halte bisa berubah dalam hitungan
  // menit, jadi laporan paling baru adalah bukti terbaik tentang keadaan
  // SEKARANG; rata-rata berbobot di bawah tetap dipakai untuk laporan yang
  // sudah lebih lama.
  const newest = reports.reduce((a, b) => (b.reported_at > a.reported_at ? b : a));
  const newestAgeMs = now.getTime() - newest.reported_at.getTime();
  if (newestAgeMs >= 0 && newestAgeMs <= FRESH_REPORT_WINS_MS) return newest.level;

  let weightedSum = 0;
  let totalWeight = 0;
  for (const report of reports) {
    const ageMs = now.getTime() - report.reported_at.getTime();
    if (ageMs < 0 || ageMs > AGGREGATION_WINDOW_MS) continue; // outside the window, or clock skew
    const weight = 1 - ageMs / AGGREGATION_WINDOW_MS;
    weightedSum += weight * LEVEL_SCORE[report.level];
    totalWeight += weight;
  }

  if (totalWeight === 0) return undefined; // every report on file has aged out

  const roundedScore = Math.min(3, Math.max(1, Math.round(weightedSum / totalWeight)));
  return SCORE_TO_LEVEL[roundedScore - 1];
}

export interface ActiveCrowdReport {
  stop_id: string;
  level: CrowdLevel;
  reported_at: Date; // most recent report on file for this stop
}

// Task Backend-07: every stop that currently has an active (in-window)
// aggregate — the map-overview list endpoint's data source. Reuses
// getAggregatedCrowdLevel per stop rather than duplicating the recency-decay
// math, so the two endpoints can never disagree on what counts as "active".
// A stop whose newest report has already aged out of the window is left out
// entirely, same as GET /crowd-reports/:stop_id returning null for it.
export function listActiveCrowdReports(now: Date = new Date()): ActiveCrowdReport[] {
  const active: ActiveCrowdReport[] = [];
  for (const [stopId, reports] of reportsByStop) {
    const level = getAggregatedCrowdLevel(stopId, now);
    if (level === undefined) continue;
    const latestReportedAt = reports.reduce(
      (latest, r) => (r.reported_at > latest ? r.reported_at : latest),
      reports[0].reported_at
    );
    active.push({ stop_id: stopId, level, reported_at: latestReportedAt });
  }
  return active;
}

// Worst-case among every stop a route candidate touches (boarding,
// alighting, and transfer points) — per the task brief, transfer points are
// the most relevant spot for crowd concern under the PRD framing, so this is
// never just the origin stop. Returns undefined (never a guessed default)
// when none of the given stops has an active report — same no-fake-data
// principle as Task Backend-03.
export function worstCrowdLevel(
  levels: Array<CrowdLevel | undefined>
): CrowdLevel | undefined {
  let worst: CrowdLevel | undefined;
  for (const level of levels) {
    if (level === undefined) continue;
    if (worst === undefined || LEVEL_SCORE[level] > LEVEL_SCORE[worst]) {
      worst = level;
    }
  }
  return worst;
}
