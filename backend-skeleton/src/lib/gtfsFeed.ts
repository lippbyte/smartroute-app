// Task Backend-05: reads headway (frequency of service) straight out of the
// static TransJakarta GTFS feed used to build the OTP2 graph (see
// ../../otp2-setup). This is a plain lookup over GTFS text files — no ML, no
// historical on-time-performance data (none is publicly available), per the
// task's explicit constraints.
//
// Two sources, preferred in order:
//   1. frequencies.txt — TransJakarta publishes most routes as
//      frequency-based service, but critically: a single route_id (e.g.
//      route "1", Blok M-Kota) is usually served by SEVERAL overlapping
//      frequency-based trip patterns at once (different sub-blocks/short-
//      turns, each its own trip_id/frequencies.txt row), not one. Verified
//      by hand against this feed: route "1" at its Blok M boarding stop is
//      covered by 13 separate trip patterns with individual headways
//      ranging 6-57 min. A rider boards whichever bus comes first, so the
//      relevant number isn't any single pattern's headway, nor a plain
//      average of them (that overstates the wait a lot) — it's the
//      *combined* headway of all patterns serving that stop, computed the
//      same way parallel independent periodic arrivals combine:
//        combined_headway = 1 / sum(1 / headway_i)
//      (equivalent to combining rates, not periods — same math as parallel
//      resistors). For route "1" at Blok M this gives ~1.1 min combined,
//      matching that corridor's real-world reputation as one of the most
//      frequent BRT lines in Jakarta — a plain average of the 13 patterns
//      would have wrongly given ~20 min and misclassified it as high risk.
//   2. stop_times.txt fallback — for any route/stop not covered by
//      frequencies.txt at all, headway is derived directly from the gaps
//      between consecutive scheduled departures at that stop (this already
//      pools every trip actually serving the stop into one timeline, so no
//      separate combination step is needed here).
//
// Both sources are scoped to trips that actually call at the specific
// boarding stop (via stop_times.txt), not just "any trip of this route_id"
// — a route_id can cover branches/patterns that never visit a given stop,
// which would otherwise pull in irrelevant headway numbers.
//
// The feed is parsed once (lazily, on first lookup) and cached in memory for
// the life of the process — these files don't change at runtime.
import AdmZip from "adm-zip";
import path from "node:path";

// Same feed OTP2's graph was built from. Overridable via env (tests/CI, or a
// differently-arranged checkout) — default assumes the standard
// backend/{backend-skeleton,otp2-setup} layout, two levels up from this
// file's directory whether running from src/ (tsx) or dist/ (tsc build).
const GTFS_ZIP_PATH =
  process.env.GTFS_ZIP_PATH ??
  path.resolve(__dirname, "../../../otp2-setup/data/transjakarta_gtfs.zip");

interface FrequencyWindow {
  startSecs: number;
  endSecs: number;
  headwaySecs: number;
}

// Task Backend-06: one route's static identity + fare, for the LLM
// assistant's GTFS context (see gtfsContext.ts). `fareIdr` comes from a
// clean 1:1 join routes.txt -> fare_rules.txt -> fare_attributes.txt
// (verified by hand: all 240 routes in this feed have exactly one
// unconditional fare_rules row each, no origin/destination-specific fares
// to worry about).
export interface RouteInfo {
  routeId: string;
  shortName: string;
  longName: string;
  desc: string; // e.g. "BRT", "Mikrotrans", "Royaltrans" — route_desc in routes.txt
  fareIdr: number | undefined;
}

// Task Backend-07: a stop's static identity, for joining crowd reports
// (keyed by OTP2 gtfsId) back to a human name + coordinate for the list
// endpoint.
export interface StopInfo {
  stopId: string; // raw GTFS stop_id, no feed prefix
  name: string;
  lat: number;
  lng: number;
}

interface GtfsFeed {
  // trip_id -> every frequencies.txt window declared for that specific trip
  // pattern (a trip can have more than one row, covering different times of
  // day with different headways).
  frequenciesByTrip: Map<string, FrequencyWindow[]>;
  // `${route_id}|${stop_id}` -> every distinct trip_id of that route that
  // actually calls at that stop, per stop_times.txt.
  tripIdsByRouteStop: Map<string, Set<string>>;
  // `${route_id}|${stop_id}` -> sorted scheduled departure times (seconds
  // since midnight; GTFS allows >= 24:00:00 for post-midnight trips) at that
  // stop for that route. Fallback source when frequencies.txt has nothing
  // for the route/stop.
  departuresByRouteStop: Map<string, number[]>;
  // Every route's static identity + fare (Task Backend-06's assistant
  // context) — independent of the headway data above.
  routesInfo: RouteInfo[];
  // raw stop_id (no feed prefix) -> static identity, for Task Backend-07's
  // crowd-density list endpoint.
  stopsById: Map<string, StopInfo>;
}

let cachedFeed: GtfsFeed | null = null;

// Minimal CSV parser — handles quoted fields (with embedded commas/escaped
// quotes) per the GTFS/CSV spec. None of the columns we read
// (frequencies.txt, trips.txt, stop_times.txt) actually contain quoted
// commas in this feed, but parsing correctly is cheap and avoids a silent
// column-misalignment bug if that ever changes.
function parseCsvLines(content: string): string[][] {
  const rows: string[][] = [];
  const lines = content.split(/\r\n|\n/);
  for (const line of lines) {
    if (line.length === 0) continue;
    const fields: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur);
    rows.push(fields);
  }
  return rows;
}

function parseCsvRecords(content: string): Record<string, string>[] {
  const rows = parseCsvLines(content);
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    header.forEach((col, i) => {
      record[col] = row[i] ?? "";
    });
    return record;
  });
}

function gtfsTimeToSeconds(value: string): number | null {
  const m = /^(\d{1,3}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function readZipEntry(zip: AdmZip, fileName: string): string {
  const entry = zip.getEntry(fileName);
  if (!entry) {
    throw new Error(`GTFS feed di ${GTFS_ZIP_PATH} tidak punya file ${fileName}`);
  }
  return entry.getData().toString("utf-8");
}

function loadFeed(): GtfsFeed {
  if (cachedFeed) return cachedFeed;

  const zip = new AdmZip(GTFS_ZIP_PATH);

  // trip_id -> route_id, needed because both frequencies.txt and
  // stop_times.txt key by trip_id, not route_id.
  const tripRouteMap = new Map<string, string>();
  for (const trip of parseCsvRecords(readZipEntry(zip, "trips.txt"))) {
    if (trip.trip_id && trip.route_id) tripRouteMap.set(trip.trip_id, trip.route_id);
  }

  const frequenciesByTrip = new Map<string, FrequencyWindow[]>();
  for (const row of parseCsvRecords(readZipEntry(zip, "frequencies.txt"))) {
    const startSecs = gtfsTimeToSeconds(row.start_time);
    const endSecs = gtfsTimeToSeconds(row.end_time);
    const headwaySecs = Number(row.headway_secs);
    if (!row.trip_id || startSecs === null || endSecs === null || !Number.isFinite(headwaySecs)) {
      continue;
    }
    const list = frequenciesByTrip.get(row.trip_id) ?? [];
    list.push({ startSecs, endSecs, headwaySecs });
    frequenciesByTrip.set(row.trip_id, list);
  }

  const tripIdsByRouteStop = new Map<string, Set<string>>();
  const departuresByRouteStop = new Map<string, number[]>();
  for (const row of parseCsvRecords(readZipEntry(zip, "stop_times.txt"))) {
    const routeId = tripRouteMap.get(row.trip_id);
    if (!routeId || !row.stop_id) continue;
    const key = `${routeId}|${row.stop_id}`;

    const trips = tripIdsByRouteStop.get(key) ?? new Set<string>();
    trips.add(row.trip_id);
    tripIdsByRouteStop.set(key, trips);

    const depSecs = gtfsTimeToSeconds(row.departure_time || row.arrival_time);
    if (depSecs === null) continue;
    const list = departuresByRouteStop.get(key) ?? [];
    list.push(depSecs);
    departuresByRouteStop.set(key, list);
  }
  for (const list of departuresByRouteStop.values()) {
    list.sort((a, b) => a - b);
  }

  // fare_id -> price (IDR), for the routesInfo join below.
  const fareByFareId = new Map<string, number>();
  for (const row of parseCsvRecords(readZipEntry(zip, "fare_attributes.txt"))) {
    const price = Number(row.price);
    if (row.fare_id && Number.isFinite(price)) fareByFareId.set(row.fare_id, price);
  }
  // route_id -> fare_id (one row per route in this feed — no conditional
  // origin/destination fares, checked by hand against fare_rules.txt).
  const fareIdByRouteId = new Map<string, string>();
  for (const row of parseCsvRecords(readZipEntry(zip, "fare_rules.txt"))) {
    if (row.route_id && row.fare_id) fareIdByRouteId.set(row.route_id, row.fare_id);
  }

  const routesInfo: RouteInfo[] = parseCsvRecords(readZipEntry(zip, "routes.txt")).map((row) => {
    const fareId = fareIdByRouteId.get(row.route_id);
    return {
      routeId: row.route_id,
      shortName: row.route_short_name,
      longName: row.route_long_name,
      desc: row.route_desc,
      fareIdr: fareId !== undefined ? fareByFareId.get(fareId) : undefined,
    };
  });

  // Task Backend-07: stop_id -> name/lat/lng, for joining crowd reports back
  // to something displayable. Rows with a missing/non-numeric coordinate are
  // skipped rather than kept with a fabricated 0,0 — this feed doesn't
  // actually have any (checked by hand), but silently keeping a broken row
  // would violate the no-fake-data principle held since Task Backend-03.
  const stopsById = new Map<string, StopInfo>();
  for (const row of parseCsvRecords(readZipEntry(zip, "stops.txt"))) {
    const lat = Number(row.stop_lat);
    const lng = Number(row.stop_lon);
    if (!row.stop_id || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    stopsById.set(row.stop_id, { stopId: row.stop_id, name: row.stop_name, lat, lng });
  }

  cachedFeed = { frequenciesByTrip, tripIdsByRouteStop, departuresByRouteStop, routesInfo, stopsById };
  return cachedFeed;
}

// Task Backend-06: force the (otherwise lazy) parse to happen now, so it
// runs once at server startup rather than stalling the first request that
// needs it (headway lookup, or the assistant's route list) — see index.ts.
export function preloadGtfsFeed(): void {
  loadFeed();
}

// Every route's static identity + fare — used by the LLM assistant to build
// its GTFS context (gtfsContext.ts). Not used by the headway/reliability
// path above.
export function getRoutesInfo(): RouteInfo[] {
  return loadFeed().routesInfo;
}

// OTP2's `gtfsId` fields are "<feedId>:<raw GTFS id>" (e.g. "1:B03282P"),
// but frequencies.txt/stop_times.txt/trips.txt use the raw id with no feed
// prefix — strip it before joining back to the static feed.
function stripFeedPrefix(gtfsId: string): string {
  const idx = gtfsId.indexOf(":");
  return idx === -1 ? gtfsId : gtfsId.slice(idx + 1);
}

// Task Backend-07: a stop's static name + coordinate, for the crowd-density
// list endpoint. Accepts the same OTP2 gtfsId format as getHeadwayMinutes
// below ("<feedId>:<raw stop_id>") and strips the feed prefix before joining
// against stops.txt. Returns undefined for an unknown/malformed id — e.g. a
// crowd report submitted (no validation against real stops, per Task
// Backend-04's explicit scope cut) for a stop_id that isn't actually in this
// feed; the caller should skip it rather than invent a name/coordinate.
export function getStopInfo(stopGtfsId: string): StopInfo | undefined {
  return loadFeed().stopsById.get(stripFeedPrefix(stopGtfsId));
}

// Combines several concurrently-running trip patterns' headways into one
// effective "wait for whichever comes first" headway — see the module
// comment above for why this is 1/sum(1/h_i) rather than a plain average.
function combineHeadwaysSecs(headwaySecs: number[]): number | undefined {
  const rateSum = headwaySecs.reduce((sum, h) => (h > 0 ? sum + 1 / h : sum), 0);
  if (rateSum <= 0) return undefined;
  return 1 / rateSum;
}

// ±2 hours around the requested departure time — wide enough to find a
// handful of scheduled departures even on a sparse feeder route, narrow
// enough to not blend peak and off-peak headway into one meaningless
// average. Falls back to the whole day's departures if the window alone
// doesn't have at least 2 (see getHeadwayMinutes).
const STOP_TIMES_WINDOW_SECS = 2 * 60 * 60;

// Returns the effective headway in minutes for a route at a specific stop,
// at a given time-of-day (seconds since local midnight) — or undefined if
// the feed has no usable data for that combination at all.
export function getHeadwayMinutes(
  routeGtfsId: string,
  stopGtfsId: string,
  atSecs: number
): number | undefined {
  const feed = loadFeed();
  const routeId = stripFeedPrefix(routeGtfsId);
  const stopId = stripFeedPrefix(stopGtfsId);
  const key = `${routeId}|${stopId}`;

  const tripIds = feed.tripIdsByRouteStop.get(key);
  if (tripIds && tripIds.size > 0) {
    const allWindows: FrequencyWindow[] = [];
    for (const tripId of tripIds) {
      const windows = feed.frequenciesByTrip.get(tripId);
      if (windows) allWindows.push(...windows);
    }
    if (allWindows.length > 0) {
      const matching = allWindows.filter((w) => atSecs >= w.startSecs && atSecs < w.endSecs);
      // Outside every declared window (e.g. a request right at service
      // open/close) — fall back to combining every window regardless of
      // time-of-day rather than claiming "no data" when these patterns
      // clearly do run frequency service.
      const pool = matching.length > 0 ? matching : allWindows;
      const combinedSecs = combineHeadwaysSecs(pool.map((w) => w.headwaySecs));
      if (combinedSecs !== undefined) return combinedSecs / 60;
    }
  }

  const departures = feed.departuresByRouteStop.get(key);
  if (!departures || departures.length < 2) return undefined;

  const nearby = departures.filter((d) => Math.abs(d - atSecs) <= STOP_TIMES_WINDOW_SECS);
  const sample = nearby.length >= 2 ? nearby : departures;

  const gaps: number[] = [];
  for (let i = 1; i < sample.length; i++) gaps.push(sample[i] - sample[i - 1]);
  if (gaps.length === 0) return undefined;

  const avgGapSecs = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
  return avgGapSecs / 60;
}
