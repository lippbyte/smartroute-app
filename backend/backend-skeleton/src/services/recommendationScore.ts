// Task Backend-06 (Bagian B): combines every per-candidate signal computed
// so far (Task Backend-03's time/cost, Task Backend-04's crowd_level, Task
// Backend-05's reliability) into one ranking number, per the task brief's
// exact formula. Centralized here (not in Task 04/05) because the formula
// needs all four inputs at once and the brief explicitly calls for one
// place to manage it.
//
//   recommendation_score =
//     0.25 * normalized_time +
//     0.15 * normalized_cost +
//     0.35 * crowd_quality +
//     0.25 * reliability_score
//
// Weights are exactly as specified in the task brief (they sum to 1.0):
// crowd (0.35) is weighted highest — a rider's single biggest complaint
// about TransJakarta is overcrowding, and it's this project's only live/
// real data source (Task Backend-04), so the brief leans on it hardest.
// Time (0.25) and reliability (0.25) are next and equal — both matter, but
// neither dominates trip choice the way crowding does. Cost (0.15) is
// lowest because TransJakarta's flat fare (Task Backend-03b) makes cost
// barely vary between candidates in the first place.
import type { RouteCandidate } from "../types/schema";

const WEIGHT_TIME = 0.25;
const WEIGHT_COST = 0.15;
const WEIGHT_CROWD = 0.35;
const WEIGHT_RELIABILITY = 0.25;

// Worst-case travel time for Jakarta transit, per the task brief — used only
// to normalize into [0, 1], not as a real upper bound (a genuinely slower
// trip just clamps to 0 rather than going negative).
const WORST_CASE_TRAVEL_TIME_MINUTES = 120;

// Worst-case fare for a multi-transfer trip, per the task brief. Note:
// Task Backend-03b made cost_idr a flat 3500 regardless of transfer_count
// (TransJakarta's real free-transfer policy), so in practice every
// candidate normalizes to the same normalized_cost today — the formula still
// takes cost_idr as an input in case that flat-fare assumption ever changes
// (e.g. a future premium/Royaltrans fare tier).
const WORST_CASE_COST_IDR = 15000;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// crowd_level -> a [0,1] "quality" score, per the task brief's exact mapping.
// undefined (no crowd report at all for this candidate's stops) maps to the
// same 0.5 neutral used everywhere else in this project for "no data yet" —
// consistent with Task Backend-04/05's no-fake-data principle.
const CROWD_QUALITY: Record<"low" | "moderate" | "high", number> = {
  low: 1.0,
  moderate: 0.5,
  high: 0.0,
};
const CROWD_QUALITY_NEUTRAL = 0.5;

// reliability.score already IS this component (Task Backend-05 produces
// 0.9/0.5/0.1 directly) — undefined uses the same 0.5 neutral fallback.
const RELIABILITY_SCORE_NEUTRAL = 0.5;

// Number of decimal places kept on the final score. Purely cosmetic (keeps
// the JSON response readable instead of a long float tail) — rounding is
// applied before sorting too, so the displayed order always matches the
// displayed numbers (no "0.601 above 0.601" confusion from hidden
// precision).
const SCORE_DECIMAL_PLACES = 3;

function round(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

export function computeRecommendationScore(
  candidate: Pick<RouteCandidate, "travel_time_minutes" | "cost_idr" | "crowd_level" | "reliability">
): number {
  // travel_time_minutes is a { min, max } range (Task Backend-01's schema —
  // deliberately not a single number, see schema.ts), but the formula wants
  // one value to normalize. Using the midpoint is a reasonable single
  // representative of the range without favoring the optimistic or
  // pessimistic extreme.
  const representativeMinutes =
    (candidate.travel_time_minutes.min + candidate.travel_time_minutes.max) / 2;

  const normalizedTime = clamp01(1 - representativeMinutes / WORST_CASE_TRAVEL_TIME_MINUTES);
  const normalizedCost = clamp01(1 - candidate.cost_idr / WORST_CASE_COST_IDR);
  const crowdQuality =
    candidate.crowd_level !== undefined ? CROWD_QUALITY[candidate.crowd_level] : CROWD_QUALITY_NEUTRAL;
  const reliabilityScore = candidate.reliability?.score ?? RELIABILITY_SCORE_NEUTRAL;

  const score =
    WEIGHT_TIME * normalizedTime +
    WEIGHT_COST * normalizedCost +
    WEIGHT_CROWD * crowdQuality +
    WEIGHT_RELIABILITY * reliabilityScore;

  return round(score, SCORE_DECIMAL_PLACES);
}
