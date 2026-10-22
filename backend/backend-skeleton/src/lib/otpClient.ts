// Minimal GraphQL client for the OTP2 instance from Task Backend-02/02b.
//
// Task Backend-02b added OSM street data to the graph, so OTP2 can now plan
// a trip from an arbitrary lat/lng directly — it computes its own
// access/egress walk legs, following real streets, instead of us having to
// snap coordinates to the nearest GTFS stop and fake a straight-line walk
// leg (that workaround from Task Backend-03 is gone as of Task Backend-03b).
//
// planTrip's `origin`/`destination` labels flow straight into the walk
// legs' `from`/`to` names in the OTP2 response (verified via GraphQL
// `label` on PlanLabeledLocationInput) — routing.ts passes the same
// formatted coordinate label used for RouteRecommendation.origin/destination
// so leg endpoints and the top-level origin/destination stay consistent.

const OTP2_URL = process.env.OTP2_URL ?? "http://localhost:8080/otp/gtfs/v1";

export class OtpUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "OtpUnavailableError";
  }
}

export class OtpGraphQLError extends Error {
  constructor(message: string, readonly errors: unknown) {
    super(message);
    this.name = "OtpGraphQLError";
  }
}

async function postGraphQL<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(OTP2_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    throw new OtpUnavailableError(
      `Tidak bisa menghubungi OTP2 di ${OTP2_URL}`,
      err
    );
  }

  if (!response.ok) {
    throw new OtpUnavailableError(
      `OTP2 merespons HTTP ${response.status} ${response.statusText}`
    );
  }

  let body: { data?: T; errors?: unknown };
  try {
    body = (await response.json()) as { data?: T; errors?: unknown };
  } catch (err) {
    throw new OtpUnavailableError("Respons OTP2 bukan JSON yang valid", err);
  }

  if (body.errors) {
    throw new OtpGraphQLError("OTP2 mengembalikan GraphQL errors", body.errors);
  }
  if (!body.data) {
    throw new OtpGraphQLError("Respons OTP2 tidak berisi field 'data'", body);
  }

  return body.data;
}

export interface OtpPlace {
  name: string;
  lat: number;
  lon: number;
  // Present only when this leg endpoint is an actual GTFS stop (boarding,
  // alighting, or transfer point) — null for a plain walk endpoint like the
  // raw origin/destination coordinate. Used by Task Backend-04 to match leg
  // endpoints against crowd reports; not exposed on the public RouteLeg.
  stop: { gtfsId: string } | null;
}

export interface OtpLeg {
  mode: string;
  duration: number | null;
  distance: number | null;
  from: OtpPlace;
  to: OtpPlace;
  // `gtfsId` (format "<feedId>:<raw route_id>") added for Task Backend-05 —
  // needed to join a BUS leg back to frequencies.txt/stop_times.txt by the
  // real GTFS route_id, same reasoning as `OtpPlace.stop.gtfsId` above.
  route: { shortName: string | null; longName: string | null; gtfsId: string } | null;
  // Halte yang DILEWATI kendaraan di antara titik naik dan turun (null untuk
  // leg jalan kaki). Dipakai untuk mencocokkan laporan kepadatan terhadap
  // seluruh halte yang dilalui rute, bukan cuma titik naik/turunnya.
  intermediateStops: Array<{ gtfsId: string; name: string; lat: number; lon: number }> | null;
  // Jam naik terjadwal (ISO, sudah WIB). Dipakai tarif LRT Jabodebek, yang
  // berbeda antara jam sibuk hari kerja dan di luarnya.
  start: { scheduledTime: string } | null;
  end: { scheduledTime: string } | null;
  // Untuk navigasi: arah kendaraan ("Lebak Bulus"), bentuk jalur (polyline
  // terenkode Google, presisi 5), dan belokan untuk leg jalan kaki.
  headsign: string | null;
  legGeometry: { points: string } | null;
  steps: Array<{
    distance: number;
    relativeDirection: string | null;
    absoluteDirection: string | null;
    streetName: string | null;
    lat: number;
    lon: number;
  }> | null;
}

export interface OtpItinerary {
  duration: number;
  numberOfTransfers: number;
  walkDistance: number | null;
  legs: OtpLeg[];
}

// Mirrors OTP2's RoutingError type. `inputField` tells us WHICH part of the
// request the error is about (FROM = origin, TO = destination, DATE_TIME,
// VIA) — that's what lets us tell "this coordinate isn't reachable by the
// routing graph" (422, a request problem) apart from "these are both valid
// points but no transit connects them right now" (a legitimate empty
// result, still 200).
export interface OtpRoutingError {
  code: string;
  description: string;
  inputField: "FROM" | "TO" | "DATE_TIME" | "VIA" | null;
}

// Filter moda ditambahkan hanya kalau diminta: OTP2 2.10 crash kalau argumen
// `modes` dikirim null ("modesArgs is null"), jadi tanpa filter argumennya
// harus benar-benar hilang dari query, bukan diisi null.
function planQuery(withModes: boolean): string {
  return `
  query PlanRoute(
    $originLat: CoordinateValue!
    $originLon: CoordinateValue!
    $originLabel: String
    $destLat: CoordinateValue!
    $destLon: CoordinateValue!
    $destLabel: String
    $earliestDeparture: OffsetDateTime!
    $first: Int!
    $searchWindow: Duration
    ${withModes ? "$modes: PlanModesInput!" : ""}
  ) {
    planConnection(
      origin: {
        location: { coordinate: { latitude: $originLat, longitude: $originLon } }
        label: $originLabel
      }
      destination: {
        location: { coordinate: { latitude: $destLat, longitude: $destLon } }
        label: $destLabel
      }
      dateTime: { earliestDeparture: $earliestDeparture }
      first: $first
      searchWindow: $searchWindow
      ${withModes ? "modes: $modes" : ""}
    ) {
      edges {
        node {
          duration
          numberOfTransfers
          walkDistance
          legs {
            mode
            duration
            distance
            from { name lat lon stop { gtfsId } }
            to { name lat lon stop { gtfsId } }
            route { shortName longName gtfsId }
            headsign
            legGeometry { points }
            intermediateStops { gtfsId name lat lon }
            steps { distance relativeDirection absoluteDirection streetName lat lon }
            start { scheduledTime }
            end { scheduledTime }
          }
        }
      }
      routingErrors { code description inputField }
    }
  }
`;
}

interface PlanConnectionResponse {
  planConnection: {
    edges: Array<{ node: OtpItinerary }>;
    routingErrors: OtpRoutingError[];
  };
}

// planConnection pages through DEPARTURE TIME, not through distinct route
// options — asking for `first: N` mostly returns the same itinerary shifted
// by a minute each time (frequency-based service). We over-fetch and dedupe
// by leg pattern in the caller to actually get "top 2-3 route candidates".
// (Kept from Task Backend-03 — independent of the OSM/native-routing fix.)
const OVERFETCH_COUNT = 12;
const SEARCH_WINDOW = "PT3H";

export interface PlanTripResult {
  itineraries: OtpItinerary[];
  routingErrors: OtpRoutingError[];
}

export async function planTrip(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  originLabel: string,
  destLabel: string,
  earliestDeparture: string,
  // Mode transit OTP2 yang boleh dipakai (mis. ["RAIL"]); undefined = semua.
  // Leg jalan kaki tetap selalu diizinkan untuk akses/transfer.
  transitModes?: string[]
): Promise<PlanTripResult> {
  const withModes = !!transitModes?.length;
  const data = await postGraphQL<PlanConnectionResponse>(planQuery(withModes), {
    originLat: origin.lat,
    originLon: origin.lng,
    originLabel,
    destLat: destination.lat,
    destLon: destination.lng,
    destLabel,
    earliestDeparture,
    first: OVERFETCH_COUNT,
    searchWindow: SEARCH_WINDOW,
    ...(withModes
      ? { modes: { transit: { transit: transitModes!.map((mode) => ({ mode })) } } }
      : {}),
  });
  return {
    itineraries: data.planConnection.edges.map((e) => e.node),
    routingErrors: data.planConnection.routingErrors,
  };
}

// Task Backend-08: single source of truth for stop identity (gtfsId/name/
// lat/lng). Before this, Task Backend-07's crowd-reports list sourced stop
// info from gtfsFeed.ts's own stops.txt parse, which returns a DIFFERENT id
// scheme (e.g. "H00219S") than the gtfsId OTP2 uses internally for the same
// physical stop (e.g. "1:G00080") — the exact id `leg.from.stop.gtfsId`/
// `leg.to.stop.gtfsId` above already comes from, and the one routing.ts's
// crowd-level matching (Task Backend-04) already correctly keys off. Two
// independently-derived id schemes for the same stops is the bug; the fix
// is having every feature read stop identity from this one place (OTP2
// itself) instead of maintaining a second, parallel parse — not a mapping
// table between the two.
export interface OtpStop {
  gtfsId: string;
  name: string;
  lat: number;
  lng: number;
}

const STOPS_QUERY = `
  query AllStops {
    stops {
      gtfsId
      name
      lat
      lon
    }
  }
`;

interface StopsResponse {
  stops: Array<{ gtfsId: string; name: string; lat: number; lon: number }>;
}

// ~7800 stops for this feed, doesn't change without a graph rebuild —
// cached after the first successful fetch, same lazy-once pattern as
// gtfsFeed.ts's own cache (just backed by a live OTP2 query instead of a
// local file parse, so it can't diverge from what OTP2 itself uses).
let cachedStops: Map<string, OtpStop> | null = null;

async function loadStops(): Promise<Map<string, OtpStop>> {
  if (cachedStops) return cachedStops;
  const data = await postGraphQL<StopsResponse>(STOPS_QUERY, {});
  const map = new Map<string, OtpStop>();
  for (const s of data.stops) {
    map.set(s.gtfsId, { gtfsId: s.gtfsId, name: s.name, lat: s.lat, lng: s.lon });
  }
  cachedStops = map;
  return map;
}

/**
 * Look up a stop's name/coordinate by its OTP2 gtfsId.
 *
 * @returns undefined for an unknown gtfsId (typo, or a stop_id that was
 *   never a real OTP2 stop) — caller drops it rather than showing a
 *   fabricated name/coordinate, same as before this task.
 * @throws OtpUnavailableError | OtpGraphQLError on the first call if OTP2
 *   itself can't be reached — same errors POST /routes already surfaces,
 *   so callers can handle both the same way.
 */
export async function getOtpStopInfo(gtfsId: string): Promise<OtpStop | undefined> {
  const stops = await loadStops();
  return stops.get(gtfsId);
}

/**
 * Task Backend-11: semua stop TransJakarta + JakLingko (mikrotrans) yang
 * dimuat OTP2 — dipakai untuk filter jarak di /nearby-stops. Reuse cache
 * yang sama dengan getOtpStopInfo/searchOtpStops (loadStops()), jadi tidak
 * ada query GraphQL tambahan kalau salah satu fungsi lain sudah pernah
 * memanggilnya lebih dulu.
 */
export async function getAllOtpStops(): Promise<OtpStop[]> {
  const stops = await loadStops();
  return [...stops.values()];
}

const SEARCH_STOPS_QUERY = `
  query SearchStops($name: String!) {
    stops(name: $name) {
      gtfsId
      name
      lat
      lon
    }
  }
`;

// Task App-07: lets the crowd-report UI search for a halte by name and get
// back a real OTP2 gtfsId to report against — reusing App-06's Nominatim
// autocomplete wouldn't work here, since Nominatim doesn't know about GTFS
// stop identity at all (it returns arbitrary OSM places, no gtfsId). This
// query is the same `stops(name: ...)` OTP2 exposes; verified case-
// insensitive substring match (e.g. "kalider" -> "Kalideres").
const MAX_SEARCH_RESULTS = 8;

const SEARCH_STOPS_WITH_ROUTES_QUERY = `
  query SearchStopsWithRoutes($name: String!) {
    stops(name: $name) {
      gtfsId
      name
      lat
      lon
      vehicleMode
      routes { gtfsId shortName }
    }
  }
`;

export interface OtpStopWithRoutes extends OtpStop {
  vehicleMode: string | null;
  routes: Array<{ gtfsId: string; shortName: string | null }>;
}

// Pencarian tempat (autocomplete asal/tujuan): sama dengan searchOtpStops,
// tapi tanpa batas 8 dan dengan moda + rute yang melayani tiap stop, supaya
// peron-peron satu halte bisa digabung dan diberi label koridornya.
export async function searchOtpStopsWithRoutes(query: string): Promise<OtpStopWithRoutes[]> {
  const data = await postGraphQL<{
    stops: Array<{
      gtfsId: string;
      name: string;
      lat: number;
      lon: number;
      vehicleMode: string | null;
      routes: Array<{ gtfsId: string; shortName: string | null }> | null;
    }>;
  }>(SEARCH_STOPS_WITH_ROUTES_QUERY, { name: query });
  return data.stops.map((s) => ({
    gtfsId: s.gtfsId,
    name: s.name,
    lat: s.lat,
    lng: s.lon,
    vehicleMode: s.vehicleMode,
    routes: s.routes ?? [],
  }));
}

export async function searchOtpStops(query: string): Promise<OtpStop[]> {
  const data = await postGraphQL<StopsResponse>(SEARCH_STOPS_QUERY, { name: query });
  return data.stops.slice(0, MAX_SEARCH_RESULTS).map((s) => ({
    gtfsId: s.gtfsId,
    name: s.name,
    lat: s.lat,
    lng: s.lon,
  }));
}
