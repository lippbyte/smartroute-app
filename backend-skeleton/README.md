# backend-skeleton — SmartRoute AI

Express + TypeScript wrapper around the OTP2 instance from `otp2-setup/`.
Implements the schema contract from Task Backend-01 (`src/types/schema.ts`).

## Endpoints

- `GET /health` → `{ "status": "ok" }`
- `POST /routes` — body `{ origin: {lat,lng}, destination: {lat,lng}, departure_time?: string }`,
  returns a `RouteRecommendation` (see `src/types/schema.ts`).
  - `departure_time` is optional, ISO 8601 with an explicit offset (e.g.
    `"2026-09-10T20:17:00+07:00"`). Omitted → search uses "now". The value
    actually used is echoed back as `departure_time` on the response, so a
    demo/rehearsal run can prove exactly which schedule window a result came
    from — see [Task Backend-03c](#task-backend-03c-departure_time-parameter) below for why this exists.
  - `crowd_level` on each `RouteCandidate` — see [Task Backend-04](#task-backend-04-crowd-sourced-density) below.
  - `reliability` on each `RouteCandidate` — see [Task Backend-05](#task-backend-05-reliability-headway-based-heuristic-not-ml) below.
  - `recommendation_score` on each `RouteCandidate`, and `routes[]` sorted by
    it descending — see [Task Backend-06](#task-backend-06-recommendation_score--llm-assistant) below.
- `POST /crowd-reports` — body `{ stop_id: string, level: "low" | "moderate" | "high" }`.
  Stores the report with the server-received timestamp. Returns `201` with
  the stored report, or `400 invalid_request` if the body doesn't match.
- `GET /crowd-reports/:stop_id` — debug/testing helper, returns
  `{ stop_id, level }` where `level` is the current recency-weighted
  aggregate for that stop, or `null` if there's no active report.
- `GET /crowd-reports` — map-overview list of every stop with an active
  report. See [Task Backend-07](#task-backend-07-crowd-density-list-endpoint) below.
- `POST /assistant/ask` — body `{ question: string, context?: { origin?: {lat,lng}, destination?: {lat,lng} } }`,
  returns `{ answer: string }`. See [Task Backend-06](#task-backend-06-recommendation_score--llm-assistant) below.

## `/routes` error responses

| HTTP | `error`                   | When                                                                 |
|------|----------------------------|-----------------------------------------------------------------------|
| 400  | `invalid_request`          | Body fails Zod validation (missing/malformed origin or destination) |
| 422  | `no_nearby_stop`           | OTP2's `routingErrors` says origin or destination is unreachable by the routing graph (`LOCATION_NOT_FOUND` / `OUTSIDE_BOUNDS` / `NO_STOPS_IN_RANGE`) |
| 502  | `otp2_unavailable`         | Can't reach the OTP2 HTTP endpoint, or it returns a non-2xx status  |
| 502  | `otp2_graphql_error`       | OTP2 responds but with GraphQL `errors`                             |
| 500  | `internal_schema_mismatch` | The built response fails validation against `RouteRecommendationSchema` before being sent — rejected rather than forwarded broken |

A 200 with `routes: []` is a *valid* response: both points are reachable but
OTP2 found no route between them (e.g. `NO_TRANSIT_CONNECTION`,
`OUTSIDE_SERVICE_PERIOD` with `inputField: DATE_TIME`) — that's not an error
condition, just an empty result.

## Task Ops-02: exposing this to a phone (ngrok)

The Android APK's `EXPO_PUBLIC_API_BASE_URL` is baked in at EAS build time
(`smartroute/eas.json`) — it can't be changed without a rebuild. Earlier
builds pointed it at this machine's LAN IP, which broke every single time
the WiFi network changed (a real, repeated problem during rehearsal — see
`Laporan_Simulasi_Runbook_Rehearsal_Demo.md`). ngrok fixes this: a static
domain that stays the same regardless of which network this laptop is on,
so one APK build keeps working across WiFi changes — even over the phone's
own cellular data, no shared network with the laptop required at all.

### Before every rehearsal/demo session

1. Make sure this backend (`npm run dev`, port 3000) and OTP2 are both
   running — see `otp2-setup/README.md`'s own checklist for OTP2.
2. Start the tunnel, pointed at the **reserved static domain** (check
   [dashboard.ngrok.com/domains](https://dashboard.ngrok.com/domains) for
   the exact current name — it's a randomly-generated
   `<word>-<word>-<word>.ngrok-free.dev`, not something you pick):
   ```bash
   ngrok http 3000 --url https://<your-reserved-domain>.ngrok-free.dev
   ```
3. Quick health check from anywhere (should print `{"status":"ok"}`):
   ```bash
   curl https://<your-reserved-domain>.ngrok-free.dev/health
   ```
4. If the APK's baked-in URL doesn't match the domain above (e.g. a new
   domain was reserved since the last build), rebuild:
   `smartroute/eas.json` → `build.preview.env.EXPO_PUBLIC_API_BASE_URL` →
   the current ngrok URL, then `eas build --platform android --profile preview`.

### Gotchas hit while setting this up (so the next person doesn't lose an hour to them)

- **ngrok agent version.** A stale local `ngrok.exe` fails with
  `ERR_NGROK_121` ("agent version too old") even though the authtoken is
  valid — the account requires a modern agent. `ngrok version` should show
  `3.20.0` or newer; if not, redownload from
  [ngrok.com/download](https://ngrok.com/download).
- **`--url` needs an exact reserved domain.** `--url https://<name>.ngrok-free.app`
  fails with `ERR_NGROK_313` ("only paid plans may create custom
  subdomains") if `<name>.ngrok-free.app` was never actually reserved on
  the dashboard — free accounts can only use a domain they've explicitly
  reserved, not an arbitrary name. Copy the exact domain from the
  dashboard rather than typing a name you'd like to use; it's also worth
  double-checking the TLD — ngrok hands out both `.ngrok-free.app` and
  `.ngrok-free.dev` depending on when/how the domain was created.
- **Windows Defender.** The official `ngrok-v3-stable-windows-amd64.zip`
  from `bin.equinox.io`/`ngrok.com` gets flagged and silently blocked by
  Windows Defender on some machines (a known false-positive class for
  tunneling tools) — `Permission denied` on download or extraction, no
  clear virus warning shown. Fix (needs an Administrator PowerShell):
  ```powershell
  Add-MpPreference -ExclusionPath "<folder you're downloading/extracting into>"
  ```

### Security note (per this task's explicit constraint)

`POST /crowd-reports` and `POST /routes` have **no authentication** — while
the tunnel is up, anyone with the URL can call every endpoint. **Stop the
tunnel (Ctrl+C) as soon as the session/rehearsal/demo is done** — don't
leave it running in the background. Never post the URL anywhere public or
share it outside the team.

## Task Backend-03b: native lat/lng routing (replaces the Task Backend-03 workaround)

Task Backend-03's graph (built in Task Backend-02) had no OSM street data, so
`/routes` couldn't ask OTP2 to plan from a raw coordinate — it snapped
origin/destination to the nearest GTFS stop via `stopsByRadius` and bolted on
a synthetic straight-line walk leg. Task Backend-02b added OSM data to the
graph, so Task Backend-03b removed that workaround: `otpClient.ts` now calls
`planConnection` with the raw lat/lng directly (`PlanCoordinateInput`), and
OTP2 computes its own access/egress walk legs over real streets.

Also fixed in the same task: `cost_idr` was wrongly computed as
`3500 × paid-leg-count` (so a 2-transfer trip cost 3× a direct one). It's now
a flat `3500` per itinerary, matching TransJakarta's real fare policy (one
tap-in, free transfers within 3 hours) — `cost_idr` no longer depends on
`transfer_count`.

The leg-pattern dedupe logic (over-fetch `planConnection` and collapse
near-duplicate itineraries that only differ by a minute of departure time) is
unchanged — that was an independent fix, unrelated to the OSM/native-routing
change.

### Reference numbers: before (Task Backend-03) vs after (Task Backend-03b)

**Correction (2026-09-04):** the first version of this table compared a
Task-03 run captured at 20:17 WIB against a Task-03b run captured at ~22:31
WIB the next day — different departure times, not a controlled comparison.
At 22:31 WIB the Kalideres–PGC `3F` feeder corridor simply isn't running
(confirmed independently: even the *old* stop-to-stop query loses that
pattern at that hour), so the apparent "2-transfer → 3/4-transfer" change for
that route was a time-of-day service-frequency artifact, not a routing-quality
regression from switching to native lat/lng routing. Verified by querying
OTP2 directly both ways (stop-to-stop and native coordinate) at three fixed
times (09:00, 20:17, 22:31) — at 09:00 and 20:17 both methods find the
*identical* candidate set; at 22:31 both methods lose it identically. The
table below is redone with both sides pinned to the same fixed departure
time (`2026-09-05T09:00:00+07:00`) for a genuine apples-to-apples diff — "old"
numbers are the Task-03 snap-to-stop + synthetic-walk-leg logic, reconstructed
and run directly against OTP2 at that same timestamp (not the live `/routes`
code, which no longer contains that logic).

**Blok M → Kota** (`{lat:-6.243312,lng:106.80175}` → `{lat:-6.13679,lng:106.8149}`)

| | Before (synthetic snap) | After (native OTP2) |
|---|---|---|
| candidates | 1 (`1`) | 1 (`1`) |
| travel_time_minutes | 76–88 | 76–88 |
| walking_distance_m | 579 | 583 |
| transfer_count | 0 | 0 |
| cost_idr | 3500 | 3500 |

Same route, same timing, walking distance within 4 m (straight-line snap vs.
real street routing — expected minor difference, not a quality change).
`cost_idr` happens to match here because this itinerary only ever had one
paid leg — see Kalideres–PGC below for where the fare bug actually mattered.

**Kalideres → PGC** (`{lat:-6.154412,lng:106.7055}` → `{lat:-6.2619,lng:106.8657}`)

| | Before | After |
|---|---|---|
| candidates | 2 (`3F+9A`, `3F+9A+10`) | 2 (`3F+9A`, `3F+9A+10`) |
| travel_time_minutes | 142–164 / 145–167 | 142–164 / 145–167 |
| walking_distance_m | 199 / 16 | 195 / 12 |
| transfer_count | 1 / 2 | 1 / 2 |
| cost_idr | 7000 / 10500 | 3500 / 3500 |

Identical candidate set, identical transfer counts, travel times matching to
the minute. This is the AC's explicit "2-transfer" case, and it's still
there — **not** replaced by anything more complex. The only real difference
is `cost_idr`: the old code wrongly charged 7000/10500 (3500 × paid legs);
the fix correctly charges the flat 3500 fare regardless of the 1 or 2
transfers.

**Grogol → Kampung Melayu** (`{lat:-6.166824,lng:106.78971}` → `{lat:-6.224673,lng:106.86682}`)

| | Before | After |
|---|---|---|
| candidates | 1 (`8+5C`) | 1 (`8+5C`) |
| travel_time_minutes | 92–106 | 92–106 |
| walking_distance_m | 512 | 518 |
| transfer_count | 1 | 1 |
| cost_idr | 7000 | 3500 |

Same result here too. At this specific fixed time only one distinct pattern
was on offer either way (a different, smaller candidate set than the
originally-reported 20:17/22:31 runs — itself further evidence that route
availability is genuinely time-of-day sensitive, which is correct behavior
for a scheduled-service router, not a bug).

**Conclusion:** route quality (candidate composition, transfer counts,
travel times) is equivalent between the Task-03 workaround and Task-03b's
native routing when compared at matched departure times. The walking-distance
numbers differ slightly and are now more accurate (real street distance
instead of straight-line snap distance). `cost_idr` is the only value that
changed by design — always flat 3500, independent of `transfer_count`, per
this task's AC.

### Regression checklist (re-verified after the refactor)

- 400 `invalid_request` — missing field, and out-of-range lat — both still reject correctly.
- 422 `no_nearby_stop` — verified for **both** origin-side and destination-side unreachable coordinates (ocean, `{lat:0,lng:0}`); now driven by OTP2's `routingErrors[].inputField` (`FROM`/`TO`) instead of a null `findNearestStop` result.
- 502 `otp2_unavailable` — verified by stopping the OTP2 container mid-request.
- 500 `internal_schema_mismatch` — verified by temporarily forcing an invalid leg `mode` through the transform and confirming the response is rejected, not forwarded.
- `tsc --noEmit` — clean.

## Task Backend-03c: `departure_time` parameter

Direct follow-up from the Task Backend-03b investigation above: route
results are genuinely time-of-day sensitive (real TransJakarta headways, not
a bug), so a demo/rehearsal run using "now" could silently land on a
different, less clean result depending on what time it happens to run.
`POST /routes` now accepts an optional `departure_time` (ISO 8601 with
offset) to pin the search to a specific moment; omitted, behavior is
unchanged (uses "now"). The value actually used — pinned or defaulted — is
echoed back as `departure_time` on the response.

Implementation: `departure_time` flows through
`validation.ts` (`z.iso.datetime({ offset: true })`, optional) →
`routes.ts` → `computeRouteRecommendation`'s new optional third argument
→ `planTrip`'s existing `earliestDeparture` argument (unchanged — it already
took an arbitrary ISO string, previously always fed `nowInJakartaIso()`).

**AC verification** (Kalideres–PGC, same coordinates as before):

| `departure_time` | Result |
|---|---|
| `2026-09-04T22:31:00+07:00` | `3+9+7+10` (3 transfers), `3+8+9+7+10` (4 transfers) — no `3F+9A+10` |
| `2026-09-03T20:17:00+07:00` | `3F+9A` (1 transfer), `3F+9A+10` (2 transfers) — present |
| omitted | defaults to current time, `departure_time` in response matches wall clock |

Matches the Task Backend-03b debugging findings exactly, and confirms the
pin actually reaches OTP2's query rather than being silently ignored.

Also verified: invalid `departure_time` (missing offset, or not a date at
all) → 400 `invalid_request`, same as any other malformed body field —
per the task's explicit instruction, this is a *format* check only, not a
"is this a sensible date" check; an out-of-range but well-formed timestamp
is left to OTP2 to answer with `routes: []`, not rejected here.

## Task Backend-05: `reliability` (headway-based heuristic, not ML)

Fills `RouteCandidate.reliability` (`score` + `risk`) from scheduled headway
in the static TransJakarta GTFS feed (`otp2-setup/data/transjakarta_gtfs.zip`
— same feed OTP2's graph was built from). This is a plain formula over GTFS
data, **not** a machine-learning model and **not** based on historical
on-time-performance (that data isn't publicly available) — per the task's
explicit constraints, this replaces the "Model 01" scope that isn't being
built for this competition.

Applied at the itinerary's **transfer point(s)** (the PRD's "risk of missing
the connection" framing) rather than every leg: for each transfer, the
headway of the *connecting* bus at its own boarding stop is looked up, and
the worst (highest-headway) transfer across the itinerary is used — same
worst-case principle Task Backend-04 uses for `crowd_level`. A direct route
(no transfer) still gets a real `reliability`, computed from its one bus
leg's own headway — never left `undefined` just because there's nothing to
transfer between.

### Where the headway number comes from

- **`frequencies.txt`** (preferred): TransJakarta models each route as
  *several concurrently-running frequency-based trip patterns* rather than
  one — e.g. route `1` (Blok M–Kota) has 13 separate trip patterns serving
  its Blok M stop, each with its own headway (6–57 min). A rider boards
  whichever comes first, so the relevant number is the **combined** headway
  of every pattern serving that specific stop:
  `combined = 1 / Σ(1 / headway_i)` — the same math as combining parallel
  resistors / independent periodic arrivals. A plain average across those 13
  patterns gives ~20 min (wrongly "high risk"); the combined headway is
  ~1.1 min, matching Koridor 1's real-world reputation as one of Jakarta's
  most frequent BRT lines. Both the frequency windows *and* the "which trips
  serve this stop" lookup are scoped to `route_id + stop_id` (via
  `stop_times.txt`), not just `route_id` — a route's other branches that
  never call at this stop don't pollute the number.
- **`stop_times.txt`** fallback: only used when a route/stop combination has
  no `frequencies.txt` coverage at all — average gap between consecutive
  scheduled departures at that stop. (Not actually reachable with the
  current feed — every one of its 700 trips has a `frequencies.txt` row —
  but kept for any feed that mixes frequency-based and exact-timetable
  service.)
- Implementation: `src/lib/gtfsFeed.ts` (feed parsing + headway lookup),
  `src/services/reliability.ts` (score/risk thresholds + per-itinerary
  transfer logic), wired into `src/services/routing.ts`.

### Score/risk thresholds (per the task brief, documented here as required)

| Headway | `risk` | `score` |
|---|---|---|
| < 5 min | `low` | 0.9 |
| 5–10 min | `medium` | 0.5 |
| > 10 min | `high` | 0.1 |
| no data at all | `medium` (score 0.5, "neutral/don't know" — never a guessed low or high) | 0.5 |

These are the exact bucket boundaries given in the task brief, tied to real
TransJakarta service tiers (BRT peak/off-peak vs. sparse Mikrotrans/feeder
headway) rather than an external benchmark. Scanning every `route_id +
stop_id` pair in the feed at 09:00 confirms all three buckets occur
naturally (5576 low / 5473 medium / 2756 high out of ~13,800 pairs) — the
thresholds aren't hard-coded to always land on one bucket.

### AC verification (fixed `departure_time: 2026-09-05T09:00:00+07:00`, same coordinates as the Task-03b table above)

Headway numbers below were independently cross-checked by hand against
`frequencies.txt`/`trips.txt`/`stop_times.txt` (grouping by the same
`route_id + stop_id` the code uses, combining with the same
`1/Σ(1/headway)` formula) — the code's output matches to 6 significant
figures in every case.

| Route | Transfer point(s) checked | Combined headway | `reliability` |
|---|---|---|---|
| Blok M → Kota (`1`, direct) | Blok M (own boarding stop, no transfer) | 1.13 min | `{ score: 0.9, risk: "low" }` |
| Kalideres → PGC (`3F+9A`, 1 transfer) | Gerbang Pemuda Arah Timur (`9A`) | 3.75 min | `{ score: 0.9, risk: "low" }` |
| Kalideres → PGC (`3F+9A+10`, 2 transfers) | Gerbang Pemuda Arah Timur (`9A`) 3.75 min, Cawang Cililitan (`10`) 2.14 min — worst = 3.75 min | 3.75 min | `{ score: 0.9, risk: "low" }` |
| Grogol → Kampung Melayu (`8+5C`, 1 transfer) | Pecenongan (`5C`) | 1.75 min | `{ score: 0.9, risk: "low" }` |

All three AC routes land in "low" risk at 09:00 WIB, which matches reality —
these are the flagship BRT corridors at morning peak, not sparse feeders.
This isn't a fixed output regardless of input (see the bucket-distribution
scan above and the sparse-feeder example below).

**Sparse-route check** (to confirm `medium`/`high` are reachable, not just
`low`): route `10A` (a lower-frequency BRT branch) at its first stop
(`B03282P`) combines to 12.90 min at 09:00 → `high` risk, `score: 0.1` —
confirmed independently against `frequencies.txt`.

### Explicit non-goals (per the task's constraints)

- No ML model — this is Model 01's scope, not built for this competition.
- No historical on-time-performance data — not publicly available; scheduled
  headway is the only input.
- `RouteCandidate`'s schema (Task Backend-01) is unchanged — only the
  already-declared `reliability` field is filled in.

## Task Backend-04: crowd-sourced density

The only source of live/real-time data this system actually owns — every
government API considered was static/historical, confirmed earlier. Model 0
(the CV crowd-detection model) is deliberately **not** wired in as a data
source here; it stays a separate showcase per the agreed decision.

**Storage & aggregation** (`src/services/crowdDensity.ts`): reports are kept
in-memory (`Map<stop_id, report[]>`, process lifetime only — no database).
`getAggregatedCrowdLevel(stop_id)` looks at reports from the last 15 minutes
and recency-weights them linearly (a report just now has weight ~1, one right
at the 15-minute edge has weight ~0), so a stale "penuh" doesn't outweigh a
fresh "lengang". Levels are scored `low=1, moderate=2, high=3`, the weighted
average is rounded to the nearest integer and mapped back to a level. With no
report in the window, it returns `undefined` — never a guessed default.

**`POST /routes` integration** (`src/services/routing.ts`): each OTP2 leg's
`from`/`to` carries a GTFS `stop.gtfsId` when that endpoint is an actual stop
(added to the `otpClient.ts` query; not exposed on the public `RouteLeg`,
which only has `from`/`to` display names per the frozen schema). For every
`RouteCandidate`, all distinct stop ids the itinerary touches — boarding,
alighting, **and** transfer points — are aggregated and the *worst* level
among them is used, because a transfer point is where crowding actually
matters most for a rider (per the PRD framing), not just the origin stop.
`crowd_level` stays `undefined` when none of those stops has an active
report — same no-fake-data principle held since Task Backend-03.

**AC verification:**

- `POST /crowd-reports {"stop_id":"STOP_A","level":"high"}` then immediately
  `{"stop_id":"STOP_A","level":"low"}` (both fresh, near-equal weight) →
  `GET /crowd-reports/STOP_A` → `"moderate"` (average of 3 and 1).
- A stop with a "high" report 14 minutes old and a "low" report 30 seconds
  old → aggregate resolves to `"low"`: the near-expired report's weight is
  small enough that the fresh one dominates.
- A report older than the 15-minute window (or a stop with no reports at
  all) → `GET /crowd-reports/:stop_id` → `{"level": null}`.
- Invalid body (bad `level` enum value, missing `stop_id`) → 400
  `invalid_request`, mirroring `POST /routes`' validation style.
- `POST /routes` → candidates whose itinerary touches a stop with an active
  report get that (worst-case) `crowd_level`; candidates whose stops have no
  reports at all keep `crowd_level: undefined` (dropped from the JSON
  response, per how the schema already treats optional fields).
- `tsc --noEmit` — clean.

**Known limitations (explicit MVP scope cut, not deferred work):**

- No authentication and no anti-spam/duplicate-report protection on
  `POST /crowd-reports` — anyone can report anything for any `stop_id`, and
  nothing stops the same person from spamming reports to skew the
  aggregate. Out of scope for the competition MVP per the task brief.
- Storage is in-memory only — reports are lost on server restart. Fine for a
  demo/rehearsal run; would need a real datastore for production use.
- **Laporan dibaca per halte, dan batas "satu halte" adalah ASUMSI, bukan
  temuan data.** Peron-peron dianggap satu halte kalau operatornya sama,
  namanya sama, dan berjarak <= 100 m (`src/services/stopClusters.ts`).
  Radius 100 m dipilih dengan asumsi halte BRT di median jalan adalah satu
  bangunan dengan satu antrean untuk kedua arah — asumsi itu belum dicek ke
  kondisi lapangan. Dampaknya konkret di dua halte, satu-satunya yang
  hasilnya berbeda antara radius 50 m dan 100 m (audit 21 Sep 2026):
  **Flyover Jatinegara** (4 peron, rentang 98 m) dan **Grogol Reformasi**
  (4 peron, rentang 83 m). Di 100 m keduanya jadi satu klaster, jadi laporan
  "padat" di satu arah ikut menghukum rute arah sebaliknya. Kalau ternyata
  tiap arah punya antrean sendiri, turunkan radius ke 50 m — keduanya akan
  terpecah per arah, dan 207 klaster lainnya tidak berubah.
- Halte senama **lintas operator** sengaja tidak digabung walau berdekatan
  (mis. Universitas Pancasila TJ vs KRL, 34 m; Lebak Bulus TJ vs MRT, 96 m),
  karena gerbang dan antreannya terpisah. Laporan di halte TJ tidak
  memengaruhi stasiun KRL/MRT di sebelahnya.
- Audit ulang klaster setiap graph OTP2 dibangun ulang:
  `npx tsx scripts/audit-stop-clusters.ts`.

## Task Backend-06: `recommendation_score` + LLM assistant

Two unrelated pieces bundled in one task per the brief: the final ranking
score for `/routes` (needs Task 04 + Task 05 to already be filled in), and
the one endpoint in this codebase that actually calls an LLM.

### Bagian A: `POST /assistant/ask` (OpenRouter)

Stateless (per the brief's explicit "no memory/history" constraint) —
one question in, one answer out, no conversation state kept between calls.

**How it's grounded, not hallucinated:**
- The static TransJakarta GTFS feed is parsed **once at server startup**
  (`preloadGtfsFeed()` in `index.ts`, not lazily per-request) into a route
  list — code, name, category, and **exact fare** (a clean join of
  `routes.txt` → `fare_rules.txt` → `fare_attributes.txt`; verified by hand
  that all 240 routes in this feed have exactly one unconditional fare rule
  each) — plus a plain-language fare-policy/operating-hours summary. See
  `src/services/gtfsContext.ts` / `src/lib/gtfsFeed.ts`. This alone is
  enough to answer the brief's example questions directly: route `1`'s
  `route_long_name` literally *is* `"Blok M - Kota"`.
- If the request's optional `context.origin`/`context.destination` is given,
  the assistant also calls our own `computeRouteRecommendation` (the same
  engine `/routes` uses) and hands the LLM the real computed candidates
  (travel time, transfers, fare, crowd, reliability) as additional grounding
  — so a question about a specific trip gets phrased around actual data, not
  the general route list alone. If the routing engine itself fails for any
  reason, the assistant just falls back to the general context rather than
  failing the whole request.
- The system prompt explicitly instructs the model to answer only from the
  supplied data and say so — not guess — when something isn't in it. See
  `SYSTEM_PROMPT_HEADER` in `src/services/assistant.ts`.

**Model note:** the task brief named `anthropic/claude-3-5-haiku`. Checked
directly against `GET https://openrouter.ai/api/v1/models` before writing
any code (per the brief's own "don't assume, check first" instruction) —
that model has since been delisted from OpenRouter's catalog. Substituted
the current cheap/fast Haiku-tier model, `anthropic/claude-haiku-4.5`
($1/M input, $5/M output tokens per OpenRouter's pricing at time of
writing), in the same spirit ("murah & cepat"). Overridable via
`OPENROUTER_MODEL` env var without a code change. Context size is small
(~3,700 tokens for the full route list), so even at Haiku 4.5's higher
per-token price a typical call is a fraction of a cent.

**Rate-limit sanity** (`src/lib/openRouterRateLimit.ts`): every OpenRouter
call attempt is logged with a running trailing-1-hour count; crossing 20
calls/hour (the exact number in the brief) logs a `console.warn` ALERT. This
is visibility, not enforcement — the brief asks to "catat" and "set
alert/log", not to hard-block requests, so a demo doesn't get cut off by its
own sanity check.

**Error handling:**
- No `OPENROUTER_API_KEY` set, request timeout (15s), connection failure, a
  non-2xx/`error` response body, or an empty/missing
  `choices[0].message.content` — all of these throw one of
  `OpenRouterConfigError`/`OpenRouterRequestError`, and the route handler
  maps every one of them to `502 assistant_unavailable` with the message
  *"Layanan asisten sedang tidak tersedia. Coba lagi sebentar lagi."* — never
  a fabricated fallback answer, never a generic unlabeled 500. Verified
  directly (`OPENROUTER_API_KEY` unset in this environment): `POST
  /assistant/ask {"question":"..."}` → `502 assistant_unavailable`.
- A malformed body (missing/empty `question`) → `400 invalid_request`, same
  style as every other endpoint in this service.

**API key setup:** never hardcoded. Copy `.env.example` to `.env` and set
`OPENROUTER_API_KEY=sk-or-...` (get one free at openrouter.ai → dashboard →
Keys). `.env` is gitignored. Loaded via `dotenv/config` at the top of
`index.ts` — requires a server restart to pick up changes, since it's read
once at startup, not per-request.

**AC verification (live, with a real `OPENROUTER_API_KEY`):** the 400 and
"no API key configured" 502 paths were verified first (see above), then 5
planned questions against the real OpenRouter call:

| # | Question | context | Result |
|---|---|---|---|
| 1 | "dari Blok M ke Kota naik apa?" (the brief's own example) | none | Correctly named **Rute 1 (BRT)**, Rp3.500 — matches `route_long_name` "Blok M - Kota" exactly |
| 2 | "Berapa tarif TransJakarta?" | none | Correctly broke down all 3 fare tiers (Rp3.500 / Rp20.000 Royaltrans / Rp35.000) with real example route codes from the context, plus the 3-hour free-transfer policy |
| 3 | "Jam berapa TransJakarta mulai dan berhenti beroperasi?" | none | Correctly gave 05:00–22:00 WIB **and** correctly hedged it as a general range, not a per-route guarantee — matches the context text's own wording |
| 4 | "Dari Kalideres ke PGC naik koridor berapa?" (stress test: no route is literally named this — requires reasoning + honesty) | none | Correctly said no direct route exists, named plausible transfer routes (**3**, **10** — both genuinely involved per the Task-05 `/routes` output above), and explicitly said it doesn't have exact transfer-stop/schedule data rather than inventing one |
| 5 | "Berapa lama perjalanannya dan apakah ramai?" | `{origin, destination}` = Blok M → Kota coords | Travel time **76-88 min** — matches `/routes`' real computed value for this exact pair (confirms the grounded-routing-engine path is actually wired up, not just the static context). For crowding, correctly said it has no real-time data (no crowd report existed on this route's stops at test time) instead of guessing |

Every answer stayed inside the provided data and explicitly flagged the
limits of what it knew (#4, #5) rather than filling gaps with a plausible
guess — the brief's central requirement for this endpoint.

### Bagian B: `recommendation_score`

Computed for every `RouteCandidate` once `crowd_level` (Task 04) and
`reliability` (Task 05) are filled in, then `routes[]` is sorted by it,
descending. Implementation: `src/services/recommendationScore.ts`, wired
into `src/services/routing.ts`.

```
recommendation_score =
  0.25 × normalized_time +
  0.15 × normalized_cost +
  0.35 × crowd_quality +
  0.25 × reliability_score
```

Weights are exactly as specified in the task brief (sum to 1.0): crowd
(0.35) weighted highest — overcrowding is riders' single biggest complaint
about TransJakarta, and it's this project's only genuinely live data source
(Task Backend-04) — time and reliability (0.25 each) matter but don't
dominate trip choice the way crowding does, and cost (0.15) is lowest
because TransJakarta's flat fare (Task Backend-03b) barely varies between
candidates in the first place.

Component details (also documented as code comments, per the brief's
explicit "no magic numbers" requirement):
- `normalized_time = clamp(1 - avg(travel_time_minutes.min, max) / 120, 0, 1)`
  — 120 min worst-case per the brief. Uses the range's midpoint since the
  schema stores `{min, max}`, not a single number (Task Backend-01).
- `normalized_cost = clamp(1 - cost_idr / 15000, 0, 1)` — Rp15.000
  worst-case per the brief. Note: `cost_idr` is always a flat 3500 today
  (Task Backend-03b's fare fix), so this term barely varies between
  candidates in practice — kept as a real input in case that ever changes.
- `crowd_quality`: `low→1.0, moderate→0.5, high→0.0, undefined→0.5` (neutral
  — no report yet, not a guessed good/bad), exactly per the brief.
- `reliability_score`: `reliability.score` directly (Task Backend-05 already
  produces 0.9/0.5/0.1), `undefined→0.5` neutral, exactly per the brief.

Final score is rounded to 3 decimal places before both display and sorting,
so the visible order always matches the visible numbers.

**AC verification** (same fixed `departure_time: 2026-09-05T09:00:00+07:00`
and coordinates as the tables above):

| Route | recommendation_score | Why |
|---|---|---|
| Blok M → Kota (`1`, direct) | 0.594 | Shortest trip of the three (76-88 min, avg 82 — under the 120-min worst-case, so `normalized_time` = 0.317, not clamped to 0), reliability 0.9, no crowd report (neutral 0.5) |
| Grogol → Kampung Melayu (`8+5C`) | 0.559 | Similar shape, slightly longer trip (92-106 min) |
| Kalideres → PGC, both candidates (`3F+9A` / `3F+9A+10`) | 0.515 / 0.515 | Both exceed the 120-min worst-case (142-167 min avg), so `normalized_time` clamps to 0 for both — tied on every other term too (same flat fare, same neutral crowd, same 0.9 reliability at this departure time), hence the tie. Order between them preserved from the original fastest-first sort (stable sort) |

**Confirmed the score actually reacts to crowd differences** (not just a
fixed tie): posted a `high` crowd report against a stop used only by the
`3F+9A+10` candidate (its 2nd transfer stop) — `recommendation_score`
dropped from `0.515` to `0.340` (`0.35 × 0.0` instead of `0.35 × 0.5` for
that term), and it correctly sorted *below* `3F+9A` afterward. Matches the
brief's own example check: low/neutral crowd + high reliability ranks above
high crowd + the same reliability.

`tsc --noEmit` — clean.

### Explicit non-goals (both parts, per the task's constraints)

- No fine-tuning/training — Bagian A is a pure API call using an
  off-the-shelf model; Bagian B's weights are the brief's own, not learned.
- The assistant doesn't touch Model 0 (CV) — it only answers route/schedule
  questions from GTFS data, never crowd data from video.
- No chat UI — `/assistant/ask` is an API endpoint only.

## Task Backend-07: crowd-density list endpoint

Nice-to-have, per the task brief — supports a Google-Maps-traffic-layer-style
map overview (all haltes at once), as opposed to the existing
`GET /crowd-reports/:stop_id`, which only answers for one stop at a time.

**`GET /crowd-reports`** returns a plain JSON array, one entry per stop that
currently has an active (in-window, same 15-minute aggregation as
`GET /crowd-reports/:stop_id`) report:

```json
[
  { "stop_id": "1:B00001P", "name": "18 Office Park", "lat": -6.299146, "lng": 106.8321, "level": "high", "reported_at": "2026-09-05T17:18:06.822Z" }
]
```

- `name`/`lat`/`lng` come from a join against `stops.txt` in the static GTFS
  feed (new `getStopInfo` in `gtfsFeed.ts`, alongside the existing headway
  lookups — same feed, parsed once at startup, no extra I/O per request).
- A stop with **no** active report is left out entirely — never filled with a
  neutral/default level, same no-fake-data principle held since Task
  Backend-03. Since `POST /crowd-reports` doesn't validate `stop_id` against
  real GTFS stops (Task Backend-04's explicit scope cut — no auth/anti-spam),
  a report on file for a `stop_id` that isn't an actual stop in this feed is
  also dropped here, rather than shown with a fabricated name/coordinate.
- Route path is `/crowd-reports` (no trailing segment) — structurally
  distinct from `/crowd-reports/:stop_id`, so Express can't route a request
  to the wrong handler regardless of registration order.
- Explicitly excluded (per the task's constraints): no `passenger_count`,
  `bus_arrival_eta_sec`, or anything resembling real-time fleet GPS/tap-in
  data — none of that is available and none of it is invented here. No map
  rendering either — this is a pure JSON endpoint; the map view is a
  separate frontend task (App-01).

**AC verification:**

- Fresh server, no reports yet → `GET /crowd-reports` → `[]`.
- `POST /crowd-reports {"stop_id":"1:B00001P","level":"high"}` (a real stop
  in the feed, "18 Office Park") → `GET /crowd-reports` → one entry with the
  matching name/lat/lng from `stops.txt` and `level: "high"`.
- `POST /crowd-reports` for a `stop_id` that isn't in the GTFS feed at all →
  does **not** appear in `GET /crowd-reports` (no coordinate to join), while
  `GET /crowd-reports/:stop_id` for that same made-up id still returns its
  aggregate — confirming the list endpoint's GTFS-join filter is independent
  of the per-stop endpoint's behavior.
- Regression: `GET /crowd-reports/:stop_id` (old endpoint) re-checked before
  and after adding the list route — same responses as before this task,
  including `{ "level": null }` for a stop with no reports.
- `tsc --noEmit` — clean.
