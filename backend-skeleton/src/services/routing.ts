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
// (boarding, alighting, transfer points, and every stop passed in between —
// see collectStopIds), look up the recency-weighted aggregate from crowdDensity.ts and take
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
  type OtpLeg,
  type OtpRoutingError,
} from "../lib/otpClient";
import { NoStopNearbyError } from "../lib/errors";
import { getAggregatedCrowdLevel, worstCrowdLevel } from "./crowdDensity";
import { getKrlFare, stationCodeFromGtfsId } from "./krlFares";
import { getMrtFare } from "./mrtFares";
import { getLrtFare } from "./lrtFares";
import { decodePolyline } from "../lib/polyline";
import { tjRouteCategory, tjRouteFareIdr } from "./tjRouteCategory";
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
// Diputuskan (setelah laporan Backend-13): tarif per rute kini dibaca dari
// GTFS itu sendiri (tjRouteFareIdr) — GR gratis, PP/PP3 Royaltrans per naik.
// Konstanta ini tinggal dipakai untuk tap-in reguler FP/FP2, satu kali per
// perjalanan. Lihat computeFareIdr.
const FARE_PER_ITINERARY_IDR = 3500;

// 4 opsi di layar hasil (diminta user 22 Sep 2026; sebelumnya 3).
const MAX_CANDIDATES = 4;

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
  // SENGAJA tidak dipotong di sini. Dulu dipotong ke MAX_CANDIDATES berdasarkan
  // durasi, SEBELUM skor rekomendasi (yang memperhitungkan tarif, kepadatan,
  // keandalan) dihitung — rute murah yang sedikit lebih lambat tersingkir
  // tanpa pernah dinilai. Pemotongan kini terjadi sesudah penilaian, di
  // computeRouteRecommendation.
  return [...bestByPattern.values()].sort((a, b) => a.duration - b.duration);
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

// Satu sumber daftar moda transit untuk routing.ts. Menambah moda baru ke
// graph (dulu RAIL/KRL, sekarang SUBWAY/MRT) cukup diubah di sini — bukan di
// setiap kondisi `mode === ...` yang tersebar dan gampang terlewat satu.
const TRANSIT_MODES = new Set(["BUS", "RAIL", "SUBWAY", "TRAM"]);

function buildRouteId(it: OtpItinerary, fallbackIndex: number, usedIds: Set<string>): string {
  const transitRouteNames = it.legs
    .filter((l) => TRANSIT_MODES.has(l.mode))
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

// Setiap halte GTFS yang dilalui itinerary: titik naik, turun, transfer, DAN
// semua halte yang dilewati kendaraan di antaranya. Dulu hanya titik naik/
// turun — sehingga rute yang melintas halte padat tanpa berhenti di sana
// tidak pernah kena penalti, padahal narasi produknya "halte yang dilewati
// rute". Contoh nyatanya: 7F+3 melintasi Kwitang, tapi laporan padat di
// Kwitang hanya menghukum 2A yang kebetulan naik dari sana.
// Titik jalan kaki mentah (koordinat asal/tujuan) tidak punya `stop`, jadi
// otomatis tidak ikut.
function collectStopIds(it: OtpItinerary): string[] {
  const ids = new Set<string>();
  for (const leg of it.legs) {
    if (leg.from.stop) ids.add(leg.from.stop.gtfsId);
    for (const stop of leg.intermediateStops ?? []) ids.add(stop.gtfsId);
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
  // TransJakarta, per tarif rute di GTFS resmi (fare_rules/fare_attributes):
  //   - Rp0 (JakLingko/Mikrotrans, Bus Wisata): gratis, tidak memicu tap-in.
  //   - premium > Rp3.500 (Royaltrans Rp20.000/Rp35.000): layanan terpisah
  //     dengan tap-in sendiri, jadi dikenakan per naik.
  //   - sisanya (Rp3.500: BRT, feeder, Transjabodetabek, Rusun): SATU kali
  //     Rp3.500 untuk seluruh perjalanan, sesuai transfer gratis 3 jam.
  // Rute tanpa fare_rule diperlakukan sebagai reguler (perilaku lama).
  let regularTapIn = false;
  for (const leg of it.legs) {
    if (leg.mode !== "BUS") continue;
    const fare = tjRouteFareIdr(leg.route?.gtfsId);
    if (fare === 0) continue;
    if (fare !== undefined && fare > FARE_PER_ITINERARY_IDR) total += fare;
    else regularTapIn = true;
  }
  if (regularTapIn) total += FARE_PER_ITINERARY_IDR;
  for (const journey of gatedJourneys(it, "RAIL")) {
    const fare = getKrlFare(journey.from, journey.to);
    if (fare !== undefined) total += fare;
    else console.warn(`Tarif KRL tidak ditemukan untuk ${journey.from} -> ${journey.to}`);
  }
  // MRT: operator dan gerbang terpisah dari KRL, jadi tarifnya dijumlahkan
  // di atas tarif KRL/TransJakarta. Tarif integrasi JakLingko TIDAK
  // diasumsikan — belum ada sumbernya.
  for (const journey of gatedJourneys(it, "SUBWAY")) {
    const fare = getMrtFare(journey.from, journey.to);
    if (fare !== undefined) total += fare;
    else console.warn(`Tarif MRT tidak ditemukan untuk ${journey.from} -> ${journey.to}`);
  }
  // LRT Jabodebek: gerbang sendiri, tarif per pasangan stasiun yang
  // bergantung jam naik (jam sibuk hari kerja vs di luarnya).
  for (const journey of gatedJourneys(it, "TRAM")) {
    const fare = getLrtFare(journey.from, journey.to, journey.boardingTime);
    if (fare !== undefined) total += fare;
    else console.warn(`Tarif LRT tidak ditemukan untuk ${journey.from} -> ${journey.to} @ ${journey.boardingTime}`);
  }
  return total;
}

// Satu "perjalanan bergerbang" = rangkaian leg bermoda `mode` yang ditempuh
// tanpa keluar gerbang. KRL dan MRT sama-sama tap-in/tap-out, tarifnya
// dihitung SEKALI dari stasiun masuk ke stasiun keluar — pindah kereta di
// dalam area berbayar (mis. ganti lin KRL di Manggarai) TIDAK menambah
// tarif. Menjumlahkan tarif per leg akan memahalkan rute transfer secara
// keliru: Bekasi->Manggarai->Jayakarta sempat terhitung Rp6.000 padahal
// tarif aslinya Rp4.000.
//
// Leg transit dengan moda LAIN di tengah berarti penumpang keluar gerbang,
// jadi leg sesudahnya dihitung sebagai perjalanan baru. Dulu hanya BUS yang
// memutus perjalanan KRL; begitu MRT masuk graph, rute KRL -> MRT -> KRL
// akan terhitung SATU perjalanan KRL dari stasiun pertama sampai terakhir,
// padahal penumpangnya tap-out, naik MRT, lalu tap-in lagi.
function gatedJourneys(
  it: OtpItinerary,
  mode: "RAIL" | "SUBWAY" | "TRAM"
): Array<{ from: string; to: string; boardingTime?: string }> {
  const journeys: Array<{ from: string; to: string; boardingTime?: string }> = [];
  let current: { from: string; to: string; boardingTime?: string } | null = null;

  for (const leg of it.legs) {
    if (leg.mode !== mode && leg.mode !== "WALK") {
      if (current) journeys.push(current);
      current = null;
      continue;
    }
    if (leg.mode !== mode) continue; // leg WALK di antara kereta = transfer dalam stasiun
    const from = leg.from.stop?.gtfsId;
    const to = leg.to.stop?.gtfsId;
    if (!from || !to) continue;
    const fromCode = stationCodeFromGtfsId(from);
    const toCode = stationCodeFromGtfsId(to);
    if (current) current.to = toCode;
    else current = { from: fromCode, to: toCode, boardingTime: leg.start?.scheduledTime };
  }
  if (current) journeys.push(current);
  return journeys;
}

// Feed KRL/MRT/LRT kita tidak punya shapes.txt, jadi OTP2 memberi garis
// lurus 2 titik dari stasiun naik ke stasiun turun. Garis itu dilewatkan
// stasiun-stasiun antara supaya di peta mengikuti urutan jalur sebenarnya
// (bukan memotong kota secara diagonal). Bus TransJakarta sudah punya shape.
function legPath(l: OtpLeg): Array<[number, number]> | undefined {
  const decoded = l.legGeometry?.points ? decodePolyline(l.legGeometry.points) : undefined;
  const stops = l.intermediateStops ?? [];
  if (l.mode !== "WALK" && stops.length > 0 && (!decoded || decoded.length <= 2)) {
    return [
      [l.from.lat, l.from.lon],
      ...stops.map((s): [number, number] => [s.lat, s.lon]),
      [l.to.lat, l.to.lon],
    ];
  }
  return decoded;
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
      TRANSIT_MODES.has(l.mode) ? l.route?.shortName ?? undefined : undefined,
    route_category: l.mode === "BUS" ? tjRouteCategory(l.route?.gtfsId) : undefined,
    from: l.from.name,
    to: l.to.name,
    from_coord: { lat: l.from.lat, lng: l.from.lon },
    to_coord: { lat: l.to.lat, lng: l.to.lon },
    headsign: l.headsign ?? undefined,
    path: legPath(l),
    stops_passed:
      l.mode === "WALK"
        ? undefined
        : (l.intermediateStops ?? []).map((s) => ({ name: s.name, lat: s.lat, lng: s.lon })),
    walk_steps:
      l.mode === "WALK"
        ? (l.steps ?? []).map((s) => ({
            distance_m: Math.round(s.distance),
            direction: s.relativeDirection ?? "CONTINUE",
            street: s.streetName ?? "",
            // Titik awal belokan — dipakai layar navigasi untuk tahu belokan
            // mana yang berikutnya dari posisi GPS.
            lat: s.lat,
            lng: s.lon,
          }))
        : undefined,
    depart_at: l.start?.scheduledTime,
    arrive_at: l.end?.scheduledTime,
    distance_m: l.distance != null ? Math.round(l.distance) : undefined,
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
  departureTime?: string,
  // Filter moda transit OTP2; undefined/kosong = semua moda.
  modes?: string[]
): Promise<RouteRecommendation> {
  const originLabel = formatCoordLabel(origin);
  const destLabel = formatCoordLabel(destination);
  const effectiveDeparture = departureTime ?? nowInJakartaIso();

  const { itineraries, routingErrors } = await planTrip(
    origin,
    destination,
    originLabel,
    destLabel,
    effectiveDeparture,
    modes
  );

  const unreachableSide = findUnreachableSide(routingErrors);
  if (unreachableSide) {
    throw new NoStopNearbyError(
      unreachableSide,
      unreachableSide === "origin" ? origin : destination
    );
  }

  let pool = itineraries;
  let candidates = dedupeItineraries(pool);

  // planConnection berhalaman per JAM BERANGKAT, bukan per variasi rute.
  // Moda yang cepat dan rapat (LRT tiap ~4-8 menit) bisa menghabiskan seluruh
  // hasil dengan pola yang sama persis — Bekasi -> Blok M turun dari 3
  // kandidat ke 1 (12x "LRT > 13B") begitu LRT masuk graph. Kalau pola unik
  // kurang dari MAX_CANDIDATES dan pengguna tidak memfilter moda, cari lagi
  // dengan tiap moda transit yang sudah terpakai dikecualikan satu per satu.
  // Pencarian tambahan HANYA terjadi saat kandidat kurang, jadi rute yang
  // sudah punya 3 pola berbeda tidak berubah sama sekali.
  if (!modes?.length && candidates.length < MAX_CANDIDATES) {
    const used = new Set(
      candidates.flatMap((it) => it.legs.map((l) => l.mode)).filter((m) => TRANSIT_MODES.has(m))
    );
    for (const dominant of used) {
      const others = [...TRANSIT_MODES].filter((m) => m !== dominant);
      const extra = await planTrip(origin, destination, originLabel, destLabel, effectiveDeparture, others);
      pool = pool.concat(extra.itineraries);
      candidates = dedupeItineraries(pool);
      if (candidates.length >= MAX_CANDIDATES) break;
    }
  }

  const atSecs = jakartaTimeOfDaySeconds(effectiveDeparture);
  const usedIds = new Set<string>();
  const routes = candidates
    .map((it, index) => buildRouteCandidate(it, index, usedIds, atSecs))
    // Task Backend-06 AC: routes[] ordered by recommendation_score,
    // highest (most recommended) first.
    .sort((a, b) => b.recommendation_score - a.recommendation_score)
    // Dipotong SESUDAH dinilai: skornya absolut per kandidat (konstanta
    // normalisasi tetap di recommendationScore.ts), jadi menilai seluruh pool
    // tidak menggeser skor siapa pun — cuma memastikan rute yang tersingkir
    // memang yang skornya kalah, bukan yang kebetulan sedikit lebih lambat.
    .slice(0, MAX_CANDIDATES);

  return {
    request_id: crypto.randomUUID(),
    origin: { name: originLabel, lat: origin.lat, lng: origin.lng },
    destination: { name: destLabel, lat: destination.lat, lng: destination.lng },
    routes,
    departure_time: effectiveDeparture,
    generated_at: new Date().toISOString(),
  };
}
