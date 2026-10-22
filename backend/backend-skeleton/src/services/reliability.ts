// Task Backend-05: fills RouteCandidate.reliability from GTFS headway — a
// heuristic/formula, deliberately NOT a machine-learning model (that's the
// scope Model 01/Bayu would have covered; not built for this competition per
// the agreed decision, and there's no historical on-time-performance data
// available publicly to train one on anyway). Purely scheduled-headway based.
import type { OtpItinerary, OtpLeg } from "../lib/otpClient";
import { getHeadwayMinutes } from "../lib/gtfsFeed";

export type ReliabilityRisk = "low" | "medium" | "high";
export interface Reliability {
  score: number;
  risk: ReliabilityRisk;
}

// Threshold rationale (per task brief — documented here, not arbitrary):
// TransJakarta's own service tiers are the actual justification, eyeballed
// from frequencies.txt across the feed:
//   - < 5 min:  BRT corridors (Koridor 1-13) at normal/peak headway — a
//     missed bus barely costs any extra wait -> low risk of a bad connection.
//   - 5-10 min: typical off-peak BRT / better feeder routes — a missed
//     connection costs a noticeable but tolerable wait -> medium risk.
//   - > 10 min: sparse feeder / Mikrotrans routes (many run 10-20+ min
//     headway) — missing the connection can mean a long wait -> high risk.
// These are the exact bucket boundaries specified in the task brief; kept
// here rather than re-derived, since the brief already ties them to real
// TransJakarta service tiers.
const LOW_RISK_MAX_MINUTES = 5;
const MEDIUM_RISK_MAX_MINUTES = 10;

// Per the task brief: when headway data isn't available at all, use 0.5
// (neutral/"don't know yet") rather than guessing low or high. It's labeled
// "medium" risk only because 0.5 happens to be the same score as the
// 5-10 min bucket — this does NOT mean we measured a medium headway, just
// that there's nothing to measure.
const NEUTRAL_RELIABILITY: Reliability = { score: 0.5, risk: "medium" };

export function reliabilityFromHeadwayMinutes(headwayMinutes: number | undefined): Reliability {
  if (headwayMinutes === undefined) return NEUTRAL_RELIABILITY;
  if (headwayMinutes < LOW_RISK_MAX_MINUTES) return { score: 0.9, risk: "low" };
  if (headwayMinutes <= MEDIUM_RISK_MAX_MINUTES) return { score: 0.5, risk: "medium" };
  return { score: 0.1, risk: "high" };
}

// Semua leg bermoda transit (bukan jalan kaki): BUS, RAIL (KRL), SUBWAY
// (MRT), TRAM (LRT). Daftar putih moda per moda baru pernah tertinggal
// (KRL, lalu MRT) — kalau tidak, perjalanan KRL lalu sambung TransJakarta
// terbaca seolah cuma punya satu leg transit alias "tanpa transfer",
// padahal justru titik pindah moda itu yang paling berisiko bagi penumpang.
function transitLegIndexes(legs: OtpLeg[]): number[] {
  const indexes: number[] = [];
  legs.forEach((leg, i) => {
    if (leg.mode !== "WALK") indexes.push(i);
  });
  return indexes;
}

// Headway of the route boarded at this leg's own stop — undefined if either
// the route or the boarding stop isn't a real GTFS entity (shouldn't happen
// for a BUS leg, but the types allow it, so guard rather than assume).
function headwayForBusLeg(leg: OtpLeg, atSecs: number): number | undefined {
  const routeGtfsId = leg.route?.gtfsId;
  const stopGtfsId = leg.from.stop?.gtfsId;
  if (!routeGtfsId || !stopGtfsId) return undefined;
  return getHeadwayMinutes(routeGtfsId, stopGtfsId, atSecs);
}

// `atSecs`: requested departure time-of-day, in seconds since local
// (Jakarta) midnight — picks which frequencies.txt window / stop_times.txt
// neighborhood applies. See routing.ts for how this is derived from
// departure_time.
export function computeReliabilityForItinerary(it: OtpItinerary, atSecs: number): Reliability {
  const transitIdxs = transitLegIndexes(it.legs);

  // No transit leg at all (shouldn't happen for this domain — an all-walk
  // "itinerary" isn't a real transit route) — no headway to measure, so
  // neutral rather than a fabricated low/high.
  if (transitIdxs.length === 0) return NEUTRAL_RELIABILITY;

  if (transitIdxs.length === 1) {
    // Direct route, no transfer — per the task scope, this must still get a
    // real reliability, computed from this leg's own headway (not left
    // undefined just because there's nothing to transfer between).
    return reliabilityFromHeadwayMinutes(headwayForBusLeg(it.legs[transitIdxs[0]], atSecs));
  }

  // Has at least one transfer. The PRD framing here is "risk of missing the
  // connection" — what actually matters at a transfer is how long you'd
  // wait for the NEXT bus if you miss it, i.e. the headway of each
  // connecting (outgoing) BUS leg at its own boarding stop. One value per
  // transfer (transitIdxs.length - 1 transfers for transitIdxs.length bus legs).
  const transferHeadways: number[] = [];
  for (let i = 1; i < transitIdxs.length; i++) {
    const headway = headwayForBusLeg(it.legs[transitIdxs[i]], atSecs);
    if (headway !== undefined) transferHeadways.push(headway);
  }

  // None of the transfers had usable GTFS headway data — neutral, same
  // no-fake-data principle Task Backend-04 uses for crowd_level.
  if (transferHeadways.length === 0) return NEUTRAL_RELIABILITY;

  // Worst-case (highest headway = highest risk) across transfers — mirrors
  // Task Backend-04's worst-case pick across crowd reports: the least
  // reliable transfer point is what actually drives the rider's risk of
  // missing their connection, not the average.
  const worstHeadwayMinutes = Math.max(...transferHeadways);
  return reliabilityFromHeadwayMinutes(worstHeadwayMinutes);
}
