// Task Backend-03 (baseline) + Task Backend-03b (native lat/lng routing +
// fare fix) + Task Backend-03c (departure_time parameter): turns a raw
// origin/destination coordinate pair into a RouteRecommendation, per the
// schema.ts contract from Task Backend-01.
//
// Pipeline:
//   1. Ask OTP2 for itineraries directly between the raw origin/destination
//      coordinates. As of Task Backend-02b the graph has OSM street data,
//      so OTP2 computes its own access/egress walk legs (following real
//      streets) — no more manual "snap to nearest stop + fake a
//      straight-line walk leg" workaround (that's what Task Backend-03 did,
//      before Task Backend-02b existed; removed here).
//   2. OTP2's planConnection pages through departure time, not distinct
//      routes, so we over-fetch and dedupe by leg pattern to get 2-3 real
//      route candidates (not the same route 3 times, 1 minute apart). Kept
//      as-is from Task Backend-03 — unrelated to the OSM/native-routing fix.
//   3. Transform each itinerary into a RouteCandidate: legs come straight
//      from OTP2 (including its native walk legs), travel_time_minutes is
//      OTP2's scheduled duration as the floor + 15% buffer as the ceiling
//      (schedule uncertainty, not a fake precise number), and cost_idr is
//      a flat Rp 3.500 per itinerary regardless of transfer_count — matches
//      TransJakarta's real 3-hour free-transfer fare policy (Task Backend-03
//      had incorrectly multiplied the fare by paid-leg count) — EXCEPT
//      itineraries with no BUS leg at all (pure walking), which are Rp0
//      (Task Backend-13 fixes a bug where those were also charged Rp3.500).
//      Task Backend-13 also confirmed against the real GTFS fare_attributes/
//      fare_rules that this flat rate is a deliberate simplification, not
//      what the official feed defines — see the note above
//      FARE_PER_ITINERARY_IDR below.
//
// The search time defaults to "now" but can be pinned via the optional
// departure_time request field (Task Backend-03c) — results are genuinely
// time-of-day sensitive (real TransJakarta schedule/headway behavior, found
// while debugging Task Backend-03b), so a demo/rehearsal run needs a way to
// reproduce a specific result instead of getting whatever "now" happens to
// be. The value actually used is echoed back as departure_time on the
// response.
//
// Task Backend-04 adds crowd_level: for every stop a candidate touches
// (boarding, alighting, transfer points — via each leg's from/to GTFS stop
// id), look up the recency-weighted aggregate from crowdDensity.ts and take
// the worst across all of them. Left undefined (never a guessed default)
// when none of those stops has an active report.
//
// Task Backend-05 adds reliability: a headway-based heuristic (not ML, no
// historical on-time data — see reliability.ts for the full rationale and
// documented score/risk thresholds), evaluated at the itinerary's transfer
// point(s) — or the main leg's own headway for a direct/no-transfer route.
//
// Task Backend-06 (Bagian B) adds recommendation_score: once every candidate
// has its crowd_level/reliability filled in above, combine them with time
// and cost into one ranking number (see recommendationScore.ts for the
// weighted formula) and sort routes[] by it, highest first.
import type {
  RouteCandidate,
  RouteLeg,
  RouteRecommendation,
} from "../types/schema";
import {
  planTrip,
  type OtpItinerary,
  type OtpRoutingError,
} from "../lib/otpClient";
import { NoStopNearbyError } from "../lib/errors";
import { getAggregatedCrowdLevel, worstCrowdLevel } from "./crowdDensity";
import { getKrlFare, stationCodeFromGtfsId } from "./krlFares";
import { computeReliabilityForItinerary } from "./reliability";
import { computeRecommendationScore } from "./recommendationScore";

// "+ buffer sekitar 15%" per the task brief, representing schedule
// uncertainty rather than a false single precise number.
const UNCERTAINTY_BUFFER_RATIO = 0.15;

// Flat TransJakarta fare per itinerary — TransJakarta's real fare policy is
// one flat tap-in charge with free transfers for 3 hours, so this does NOT
// scale with transfer_count (Task Backend-03b fixes Task Backend-03's bug
// of charging per paid leg).
//
// Task Backend-13 checked this against the real GTFS fare_attributes.txt/
// fare_rules.txt (otp2-setup/data/transjakarta_gtfs.zip, the file OTP2 is
// actually built from) — the official feed does NOT define one flat rate
// across all routes:
//   - fare_id FP  (Rp3.500, unlimited transfers/3h): 116 routes — regular
//     koridor/feeder routes, matches this constant.
//   - fare_id FP2 (Rp3.500, but only 1 transfer instead of unlimited): 13
//     routes.
//   - fare_id GR  (Rp0, free): 101 routes — nearly all "JAK.*" Mikrotrans
//     routes plus BW1/BW2/BW4.
//   - fare_id PP  (Rp20.000): 9 routes; PP3 (Rp35.000): 1 route (S14) —
//     premium/express services.
//   - fare_id PP2 (Rp25.000) is defined in fare_attributes.txt but not
//     referenced by any row in fare_rules.txt (currently unused).
// So Rp3.500 is only correct for FP/FP2 routes (the majority, and likely
// everything reachable by the current TransJakarta+JakLingko demo corridor)
// — but a candidate whose leg(s) run on a GR route should be free, and one
// on a PP/PP3 route should cost far more than Rp3.500. Left as the flat
// value here per the task's explicit instruction not to change fare logic
// without a discussed decision first — implementing real per-route lookup
// needs a route_id -> fare_id map (from fare_rules.txt) joined against each
// leg's OTP2 route id, which is a real scope change, not a one-line fix.
const FARE_PER_ITINERARY_IDR = 3500;

const MAX_CANDIDATES = 3;

interface Coordinate {
  lat: number;
  lng: number;
}

function formatCoordLabel(coord: Coordinate): string {
  return `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}`;
}

function nowInJakartaIso(): string {
  // Jakarta (WIB) is a fixed UTC+7, no DST — safe to hardcode the offset.
  const jakarta = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${jakarta.getUTCFullYear()}-${pad(jakarta.getUTCMonth() + 1)}-${pad(jakarta.getUTCDate())}` +
    `T${pad(jakarta.getUTCHours())}:${pad(jakarta.getUTCMinutes())}:${pad(jakarta.getUTCSeconds())}+07:00`
  );
}

// The GTFS feed's schedule times are plain Jakarta wall-clock ("HH:MM:SS",
// no timezone math needed since departure_time is already required to carry
// the +07:00 offset — see validation.ts) — this just pulls the clock
// portion out to match against frequencies.txt/stop_times.txt windows.
function jakartaTimeOfDaySeconds(iso: string): number {
  const m = /T(\d{2}):(\d{2}):(\d{2})/.exec(iso);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function patternKey(it: OtpItinerary): string {
  return it.legs.map((l) => `${l.mode}:${l.route?.shortName ?? ""}`).join(">");
}

// planConnection returns near-duplicate itineraries (same route, departure
// time shifted a minute) far more often than distinct routes — this keeps
// only the fastest itinerary per distinct leg pattern.
function dedupeItineraries(itineraries: OtpItinerary[]): OtpItinerary[] {
  const bestByPattern = new Map<string, OtpItinerary>();
  for (const it of itineraries) {
    const key = patternKey(it);
    const existing = bestByPattern.get(key);
    if (!existing || it.duration < existing.duration) {
      bestByPattern.set(key, it);
    }
  }
  return [...bestByPattern.values()]
    .sort((a, b) => a.duration - b.duration)
    .slice(0, MAX_CANDIDATES);
}

// Routing-error codes that mean "this coordinate itself can't be reached by
// the routing graph" (outside the OSM/GTFS coverage area, or too far from
// any usable street/stop) — a request problem, mapped to 422. Anything else
// (e.g. NO_TRANSIT_CONNECTION, OUTSIDE_SERVICE_PERIOD) means both points are
// valid but no route was found between them right now, which is a
// legitimate empty result, not an error.
const UNREACHABLE_LOCATION_CODES = new Set([
  "LOCATION_NOT_FOUND",
  "OUTSIDE_BOUNDS",
  "NO_STOPS_IN_RANGE",
]);

function findUnreachableSide(
  routingErrors: OtpRoutingError[]
): "origin" | "destination" | null {
  for (const err of routingErrors) {
    if (!UNREACHABLE_LOCATION_CODES.has(err.code)) continue;
    if (err.inputField === "FROM") return "origin";
    if (err.inputField === "TO") return "destination";
  }
  return null;
}

function buildRouteId(it: OtpItinerary, fallbackIndex: number, usedIds: Set<string>): string {
  const transitRouteNames = it.legs
    .filter((l) => l.mode === "BUS" || l.mode === "RAIL")
    .map((l) => l.route?.shortName ?? "?");
  const base =
    transitRouteNames.length > 0 ? transitRouteNames.join("+") : `route-${fallbackIndex + 1}`;

  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix++;
  }
  usedIds.add(id);
  return id;
}

// Every GTFS stop this itinerary touches — boarding, alighting, and transfer
// points alike (a transfer shows up as the `to` of one leg and the `from` of
// the next, both included here). Plain walk endpoints (raw origin/
// destination coordinates) have no `stop`, so they're naturally excluded.
function collectStopIds(it: OtpItinerary): string[] {
  const ids = new Set<string>();
  for (const leg of it.legs) {
    if (leg.from.stop) ids.add(leg.from.stop.gtfsId);
    if (leg.to.stop) ids.add(leg.to.stop.gtfsId);
  }
  return [...ids];
}

// Tarif satu itinerary, dijumlahkan per operator (lihat catatan di
// buildRouteCandidate dan di atas FARE_PER_ITINERARY_IDR):
//   - ada leg BUS (TransJakarta)  -> satu kali Rp3.500, tidak peduli
//     berapa kali transfer (kebijakan transfer gratis 3 jam).
//   - tiap leg RAIL (KRL)         -> tarif jarak sesuai pasangan stasiun
//     naik/turun, dari matriks resmi KCI.
//   - tidak ada leg transit sama sekali -> Rp0.
//
// Kalau satu leg KRL pasangan stasiunnya tidak ada di matriks (mis. stasiun
// yang ada di jadwal tapi tidak ada di daftar tarif resmi — Grogol adalah
// contoh nyatanya), leg itu TIDAK dihitung dan itinerary-nya ditandai lewat
// nilai kembalian, supaya angka yang tampil tidak diam-diam terlalu murah.
function computeFareIdr(it: OtpItinerary): number {
  let total = 0;
  if (it.legs.some((l) => l.mode === "BUS")) {
    total += FARE_PER_ITINERARY_IDR;
  }
  for (const journey of krlJourneys(it)) {
    const fare = getKrlFare(journey.from, journey.to);
    if (fare !== undefined) total += fare;
    else console.warn(`Tarif KRL tidak ditemukan untuk ${journey.from} -> ${journey.to}`);
  }
  return total;
}

// Satu "perjalanan KRL" = rangkaian leg RAIL yang ditempuh tanpa keluar
// gerbang. KRL pakai sistem tap-in/tap-out, tarifnya dihitung SEKALI dari
// stasiun masuk ke stasiun keluar — pindah kereta di dalam area berbayar
// (mis. ganti lin di Manggarai) TIDAK menambah tarif. Menjumlahkan tarif
// per leg akan memahalkan rute transfer secara keliru: Bekasi->Manggarai->
// Jayakarta sempat terhitung Rp6.000 padahal tarif aslinya Rp4.000.
//
// Leg BUS di tengah berarti penumpang keluar gerbang, jadi leg RAIL
// sesudahnya dihitung sebagai perjalanan baru (tap-in lagi).
function krlJourneys(it: OtpItinerary): Array<{ from: string; to: string }> {
  const journeys: Array<{ from: string; to: string }> = [];
  let current: { from: string; to: string } | null = null;

  for (const leg of it.legs) {
    if (leg.mode === "BUS") {
      if (current) journeys.push(current);
      current = null;
      continue;
    }
    if (leg.mode !== "RAIL") continue; // leg WALK di antara kereta = transfer dalam stasiun
    const from = leg.from.stop?.gtfsId;
    const to = leg.to.stop?.gtfsId;
    if (!from || !to) continue;
    const fromCode = stationCodeFromGtfsId(from);
    const toCode = stationCodeFromGtfsId(to);
    if (current) current.to = toCode;
    else current = { from: fromCode, to: toCode };
  }
  if (current) journeys.push(current);
  return journeys;
}

function buildRouteCandidate(
  it: OtpItinerary,
  index: number,
  usedIds: Set<string>,
  atSecs: number
): RouteCandidate {
  const legs: RouteLeg[] = it.legs.map((l) => ({
    mode: l.mode as RouteLeg["mode"], // validated against the schema before the response leaves the service
    route_name:
      l.mode === "BUS" || l.mode === "RAIL" ? l.route?.shortName ?? undefined : undefined,
    from: l.from.name,
    to: l.to.name,
  }));

  const crowdLevel = worstCrowdLevel(collectStopIds(it).map((id) => getAggregatedCrowdLevel(id)));
  const reliability = computeReliabilityForItinerary(it, atSecs);

  // Task Backend-13: itineraries with no transit leg at all (pure walking,
  // e.g. origin/destination close enough that OTP2 offers a walk-only
  // option) never tap in to anything, so they cost Rp0.
  //
  // KRL integration (Track 1 sprint H10-14): fares are now per operator,
  // because that is how a passenger actually pays — one flat TransJakarta
  // tap-in for the whole TransJakarta portion (free transfers for 3 hours),
  // PLUS a separate distance-based KRL fare per KRL leg. A trip touching
  // both is charged both, which is what really happens at the gate.
  const costIdr = computeFareIdr(it);

  // it.duration is OTP2's own scheduled total, native access/egress walk
  // legs included — no more manually adding synthetic walk time on top.
  const minMinutes = Math.round(it.duration / 60);
  const maxMinutes = Math.ceil(minMinutes * (1 + UNCERTAINTY_BUFFER_RATIO));

  const walkingDistanceM = Math.round(
    it.walkDistance ??
      it.legs.filter((l) => l.mode === "WALK").reduce((sum, l) => sum + (l.distance ?? 0), 0)
  );

  const travelTimeMinutes = { min: minMinutes, max: maxMinutes };

  return {
    route_id: buildRouteId(it, index, usedIds),
    legs,
    travel_time_minutes: travelTimeMinutes,
    transfer_count: it.numberOfTransfers,
    walking_distance_m: walkingDistanceM,
    cost_idr: costIdr,
    crowd_level: crowdLevel,
    reliability,
    recommendation_score: computeRecommendationScore({
      travel_time_minutes: travelTimeMinutes,
      cost_idr: costIdr,
      crowd_level: crowdLevel,
      reliability,
    }),
  };
}

export async function computeRouteRecommendation(
  origin: Coordinate,
  destination: Coordinate,
  // Task Backend-03c: optional pin for the search time. Undefined -> "now",
  // same as before this task (AC: default behavior must not change).
  departureTime?: string
): Promise<RouteRecommendation> {
  const originLabel = formatCoordLabel(origin);
  const destLabel = formatCoordLabel(destination);
  const effectiveDeparture = departureTime ?? nowInJakartaIso();

  const { itineraries, routingErrors } = await planTrip(
    origin,
    destination,
    originLabel,
    destLabel,
    effectiveDeparture
  );

  const unreachableSide = findUnreachableSide(routingErrors);
  if (unreachableSide) {
    throw new NoStopNearbyError(
      unreachableSide,
      unreachableSide === "origin" ? origin : destination
    );
  }

  const candidates = dedupeItineraries(itineraries);

  const atSecs = jakartaTimeOfDaySeconds(effectiveDeparture);
  const usedIds = new Set<string>();
  const routes = candidates
    .map((it, index) => buildRouteCandidate(it, index, usedIds, atSecs))
    // Task Backend-06 AC: routes[] ordered by recommendation_score,
    // highest (most recommended) first.
    .sort((a, b) => b.recommendation_score - a.recommendation_score);

  return {
    request_id: crypto.randomUUID(),
    origin: { name: originLabel, lat: origin.lat, lng: origin.lng },
    destination: { name: destLabel, lat: destination.lat, lng: destination.lng },
    routes,
    departure_time: effectiveDeparture,
    generated_at: new Date().toISOString(),
  };
}
