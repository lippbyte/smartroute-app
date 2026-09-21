# OTP2 — TransJakarta Routing Engine (Task Backend-02 / 02b)

Self-hosted OpenTripPlanner 2 instance that answers real TransJakarta transit
queries from the GTFS static feed plus OpenStreetMap street data for
Jabodetabek, via Docker (no local Java install needed — the image bundles its
own JRE, which sidesteps this machine only having Java 20 while OTP2 2.10
wants Java 21).

Because OSM street data is now in the graph, OTP2 can plan walk access/egress
legs from **any** lat/lng — not just from one GTFS stop to another.

## Layout

```
otp2-setup/
  data/
    transjakarta_gtfs.zip   # GTFS input (gitignored — fetch with scripts/download-gtfs)
    jabodetabek.osm.pbf     # clipped OSM extract (gitignored — build with scripts/clip-osm)
    build-config.json       # graph-build settings (points at both inputs above)
    router-config.json      # runtime routing defaults
    graph.obj                # built graph (gitignored, generated)
  osm-src/
    java-latest.osm.pbf     # full Java OSM extract, cached locally (gitignored)
  scripts/
    download-gtfs.sh|ps1    # fetch + validate latest GTFS
    clip-osm.sh|ps1         # fetch full Java extract + clip to Jabodetabek bbox
    build-graph.sh|ps1      # (re)build data/graph.obj from GTFS + OSM
    serve.sh|ps1            # start the server (docker compose up)
  docker-compose.yml
```

## Prerequisites

- Docker Desktop running.
- Nothing else — Java, OTP2, osmium, etc. all live inside containers.
- ~2 GB free disk (osm-src/java-latest.osm.pbf ≈ 900 MB, data/jabodetabek.osm.pbf ≈ 165 MB, data/graph.obj ≈ 205 MB).

## First-time setup

```bash
# 1. Get the GTFS feed (already done — data/transjakarta_gtfs.zip exists)
scripts/download-gtfs.sh          # or scripts\download-gtfs.ps1 on Windows

# 2. Get + clip the OSM street data (already done — data/jabodetabek.osm.pbf exists)
scripts/clip-osm.sh               # or scripts\clip-osm.ps1

# 3. Build the graph (~1.5 min of actual graph-building work)
scripts/build-graph.sh            # or scripts\build-graph.ps1

# 4. Serve it
docker compose up -d              # or scripts/serve.sh
```

Server comes up on **http://localhost:8080**. GraphiQL IDE (built into OTP2):
**http://localhost:8080/graphiql**. GraphQL endpoint for programmatic calls:
`POST http://localhost:8080/otp/gtfs/v1`.

> Windows + Git Bash note: the `docker run`/`docker compose` calls in the
> scripts are prefixed with `MSYS_NO_PATHCONV=1`. Without it, Git Bash
> silently rewrites container paths like `/var/opentripplanner` into a bogus
> Windows path and OTP2 fails with "no transit nor OSM data available" even
> though the volume mount looks right.

## Keeping it running (Task Ops-01)

OTP2 has gone down unexpectedly twice during development (once during
physical-device testing, once during App-06 verification). Investigated —
here's what was actually happening and what changed.

### What was actually killing it

**Not an app crash.** `docker logs otp2-transjakarta` showed a clean
"ready for routing" state right up to the last log line — no exception, no
OOM, no shutdown-hook output (which OTP2 does log on a graceful `docker
stop`). `docker inspect` showed `OOMKilled: false` and exit code 255 — the
signature of the container being cut off from outside, not the JVM dying on
its own.

**Root cause: this machine restarting**, taking Docker Desktop's whole VM
(and every container in it) down with it — not sleep, an actual reboot.
Confirmed by cross-referencing `docker inspect`'s `FinishedAt` timestamp
against Windows' own boot event: `FinishedAt` landed 7 minutes after
`Get-CimInstance Win32_OperatingSystem | select LastBootUpTime` (the 7-minute
gap is Docker Desktop's own startup time after login — it does auto-start,
confirmed via the Run registry key, but isn't instant). A second, unrelated
container on this machine (`levelin-mysql`, from a different project) came
back up automatically right when Docker Desktop finished restarting — it had
a restart policy configured; `otp2-transjakarta` didn't
(`RestartPolicy.Name: "no"`, confirmed via `docker inspect`, `RestartCount:
0`). That's the whole story: same trigger (machine reboot), different
outcome, purely because of one missing config line.

### Fix 1 — restart policy (handles OTP2/the container itself dying)

`docker-compose.yml` now has `restart: unless-stopped`. This covers the
container's own process crashing (OOM, an unhandled exception, anything
that kills the java process without a corresponding `docker stop`) — Docker
brings it back on its own, no one needs to notice.

Verified by killing the actual OTP2 java process from inside the running
container (**not** `docker kill` from the host — Docker treats an
externally-issued `kill`/`stop` as an intentional stop and `unless-stopped`
deliberately does *not* auto-restart in that case, so `docker kill` isn't a
valid way to test this policy):

```bash
docker exec otp2-transjakarta bash -c "ps aux" # find the java PID (not PID 1 — that's docker-entrypoint.sh)
docker exec otp2-transjakarta kill -9 <java-pid>
docker inspect otp2-transjakarta --format 'RestartCount={{.RestartCount}} Status={{.State.Status}}'
```

Result: container was back to `Status: running` within ~2 seconds,
`RestartCount` incremented from 0 to 1.

### Fix 2 — this does NOT cover the machine itself being off

`restart: unless-stopped` only works once Docker Desktop's engine is
running. If the machine was fully shut down (not just asleep) and Docker
Desktop hasn't finished its own startup yet, no restart policy fixes that —
it's an operational gap, not a technical one. Trying to force this open with
a scheduled task or startup script is explicitly out of scope for this task
(see the task file) — the realistic fix is a habit, not more automation:

**Before every work session, rehearsal, or demo:**

```bash
curl -sf -m 3 -X POST http://localhost:8080/otp/gtfs/v1 \
  -H "Content-Type: application/json" -d '{"query":"{__typename}"}' \
  && echo "OTP2 OK" || echo "OTP2 DOWN — see below"
```

- **Prints `OTP2 OK`** → good to go.
- **Prints `OTP2 DOWN`** → open Docker Desktop (it auto-starts on login, but
  give it 30-60s after a fresh boot to finish initializing), then from this
  folder run `docker compose up -d`. Re-run the curl above — should flip to
  `OTP2 OK` within about 30-40s (that's how long this graph takes to load;
  see the timestamps in "First-time setup" above). If it's still down after
  that, check `docker logs otp2-transjakarta` for an actual error this time
  — that would mean something new is wrong, not the reboot issue described
  here.

## Where the OSM data comes from

Geofabrik doesn't publish a Jabodetabek-sized (or even DKI-Jakarta-sized)
extract — [checked their Indonesia download page](https://download.geofabrik.de/asia/indonesia.html):
the smallest one that contains Jabodetabek is the **Java** sub-region
(`java-latest.osm.pbf`, ~900 MB). `scripts/clip-osm.sh` downloads that once
into `osm-src/` (cached — re-runs skip the download if the file's already
there) and clips it down to a Jabodetabek bounding box
(`106.25,-6.75,107.20,-5.95` — covers Jakarta, Bogor, Depok, Tangerang,
Bekasi, and Soekarno-Hatta airport) using `osmium extract --strategy=smart`.
That strategy keeps any way/relation crossing the box fully intact (so a road
or coastline that dips outside the box doesn't get a broken/dangling end at
the boundary) — this is why the clipped file's *reported* bounding box can
look wider than the literal box: a handful of long linear features (coastline,
a couple of arterial roads/railways) retain nodes beyond the cut, which is
expected and harmless.

Result: **896 MB → 166 MB** (clipped to ~18% of the source, mostly because a
few long low-count features get kept whole — still a big win over feeding the
whole-Java or whole-Indonesia extract to OTP2 every rebuild).

`osmium-tool` itself isn't installed anywhere — the script installs it fresh
each run from Ubuntu's official apt repo inside a throwaway container
(`ubuntu:24.04`), rather than trusting a random pre-built osmium Docker image.

**To widen coverage later** (e.g. include more of West Java): edit the `BBOX`
value in `scripts/clip-osm.sh` / `$bbox` in `scripts/clip-osm.ps1`, delete
`data/jabodetabek.osm.pbf`, and re-run the script — it'll re-clip from the
already-cached `osm-src/java-latest.osm.pbf` (no re-download needed unless you
also want fresher OSM data, in which case delete `osm-src/java-latest.osm.pbf`
too).

## What the build log shows when OSM loads correctly

From `scripts/build-graph.sh`'s output, look for:

```
Gathering OSM from provider: DefaultOsmProvider{source: OSM /var/opentripplanner/jabodetabek.osm.pbf, ...}
Parse OSM Relations progress tracking complete. 165.6 MB done in ~6s (~28 MB/s)
Parse OSM Ways progress tracking complete. 165.6 MB done in ~8s (~21 MB/s)
Parse OSM Nodes progress tracking complete. 165.6 MB done in ~8s (~21 MB/s)
Compute way properties progress tracking complete. 719,101 done in ~3s
Build street graph progress tracking complete. 716,328 done in ~16s
...
Graph building took 1m27s–1m50s.
Graph built.   |V|=1,117,969 |E|=2,755,207
Transit built. |Stops|=7,819 |Patterns|=697 |ConstrainedTransfers|=14
```

That's the reference run for this repo's current `data/jabodetabek.osm.pbf` +
`data/transjakarta_gtfs.zip`: **719,101 OSM ways** processed into
**1,117,969 street+stop vertices and 2,755,207 edges** — up from ~7,800
vertices / 0 edges in the GTFS-only graph from Task Backend-02. If a rebuild
ever logs way/vertex/edge counts far below these (or the "Gathering OSM from
provider" line is missing entirely), the OSM file didn't load — check
`build-config.json`'s `osm[0].source` matches the actual filename in `data/`.

**The graph-building step itself is fast** (~1.5 minutes) — that's the number
to judge "is this build reasonable" against, not total wall-clock time. See
the note on the save step below.

## Refreshing the graph

Whenever TransJakarta publishes a new GTFS export, OSM data changes, or you
edit `build-config.json` / `router-config.json`:

```bash
docker compose down                # stop the running server
scripts/download-gtfs.sh           # fetch + validate the new GTFS (if needed)
scripts/clip-osm.sh                # re-clip OSM (if needed — see above)
scripts/build-graph.sh             # rebuild data/graph.obj
docker compose up -d               # serve the new graph
```

`download-gtfs` refuses to overwrite `data/transjakarta_gtfs.zip` with a bad
file — it checks the zip isn't corrupt and that `agency.txt`, `routes.txt`,
`stops.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt` are all present
before letting you rebuild.

`build-graph.sh`/`.ps1` build inside a throwaway named Docker volume (not
directly against the `data/` bind mount) and only bulk-copy the input files
in and the finished `graph.obj` back out. This sidesteps a real issue seen on
this machine: OTP2's graph-serialization step does many small buffered writes,
and over a Windows bind mount that can be dramatically slow. The two bulk
copies (in/out) instead take a few seconds each regardless.

> **If a build takes far longer than the ~1.5 min logged for "Graph building
> took..."**: on this machine specifically, we also saw the *save* step (after
> "Graph building took..." has already printed) stall for very long stretches
> — once even ~3.5 hours — with the process hanging mid-write and then
> suddenly finishing a big chunk in seconds. That was traced to the host
> machine going to sleep while the container was mid-write, which pauses
> Docker Desktop's whole VM until the machine wakes up again; the build always
> resumed correctly and produced a valid graph.obj once the machine woke, so
> it's not a correctness issue — but if you're rebuilding unattended, disable
> sleep on the host machine first (`powercfg` on Windows) so it doesn't stall.

## Verifying it works

### 1. Blok M → Kota (stop-to-stop, from Task Backend-02)

Corridor 1 ("Blok M – Kota") is TransJakarta's original, best-known BRT
corridor, so it's a good sanity check. In GraphiQL, or via curl:

```bash
curl -X POST http://localhost:8080/otp/gtfs/v1 \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { planConnection(origin: {location: {stopLocation: {stopLocationId: \"1:H00014P\"}}}, destination: {location: {stopLocation: {stopLocationId: \"1:H00275P\"}}}, dateTime: {earliestDeparture: \"2026-09-04T09:00:00+07:00\"}, first: 3) { edges { node { start end legs { mode from { name } to { name } route { shortName longName } duration } } } } }"
  }'
```

`H00014P` and `H00275P` are the `stop_id`s for the Blok M and Kota terminal
stations in `stops.txt` (feed id `1`, per the `feeds { feedId }` query).
Result: a single-route itinerary on route `1` ("Blok M - Kota"), ~70–75
minutes end to end — matches general knowledge of Corridor 1's real-world
running time.

### 2. Arbitrary lat/lng → nearest stop (new — this is what Task Backend-02b adds)

A point picked mid-block near Blok M (**not** a stop's exact coordinates),
walking to the Blok M stop:

```bash
curl -X POST http://localhost:8080/otp/gtfs/v1 \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { planConnection(origin: {location: {coordinate: {latitude: -6.2418, longitude: 106.7998}}}, destination: {location: {stopLocation: {stopLocationId: \"1:H00014P\"}}}, dateTime: {earliestDeparture: \"2026-09-04T09:00:00+07:00\"}, first: 1) { edges { node { legs { mode from { name } to { name } distance duration } } } } }"
  }'
```

Result: a single `WALK` leg, **572 m / 452 s**. The straight-line distance
between those two points is only ~273 m — the ~2.1× ratio confirms OTP2 is
routing along the actual street network (sidewalks/roads), not drawing a
straight line, which is the whole point of adding OSM.

### 3. Full arbitrary-point itinerary (walk + bus + walk)

Origin near Blok M, destination near Kota, neither snapped to a stop:

```bash
curl -X POST http://localhost:8080/otp/gtfs/v1 \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { planConnection(origin: {location: {coordinate: {latitude: -6.2418, longitude: 106.7998}}}, destination: {location: {coordinate: {latitude: -6.1355, longitude: 106.8165}}}, dateTime: {earliestDeparture: \"2026-09-04T09:00:00+07:00\"}, first: 1) { edges { node { legs { mode from { name } to { name } route { shortName } distance duration } } } } }"
  }'
```

Result: `WALK` (560 m to the "Asean" stop) → `BUS` route `1` (13.4 km) →
`WALK` (887 m to the destination) — a complete, realistic door-to-door
itinerary with OTP2 computing both access and egress walk legs itself.

## Known limitations (by design, for this task)

- **No GTFS-RT / real-time vehicle positions.** Per the task brief, this
  isn't published for TransJakarta — out of scope, not attempted.
- ~~**Single transit mode (TransJakarta BRT/Mikrotrans only).**~~ Done in the
  H10-14 Track 1 sprint: the graph now loads **two** GTFS feeds —
  `transjakarta_gtfs.zip` (feed id `1`) and `krl_gtfs.zip` (feed id `2`, 83
  KRL Commuter stations / 5 Jabodetabek lines / 985 trips, generated by
  `otp2-krl-experiment/scripts/build_krl_full_gtfs.py`). OTP2 builds walking
  transfers between the two purely from OSM — no manual `transfers.txt`
  needed. MRT/LRT are still **not** routable: their data is static station
  coordinates only (`backend-skeleton/src/data/mrtLrtStations.ts`), no
  schedules exist publicly to build a feed from.
  Reference build with both feeds: `Transit built. |Stops|=7,902
  |Patterns|=759` (TransJakarta-only was 7,819 / 697).
  The pre-KRL graph is kept as `data/graph.obj.backup-pre-krl` — to roll
  back, copy it over `data/graph.obj`, restore
  `data/build-config.json.backup-pre-krl`, and `docker compose restart`.
- **No other street routing modes enabled.** The OSM data technically has
  car/bike-taggable ways (that's just what OSM contains), but nothing in this
  setup turns on car or bicycle *routing* — no bike rental stations, no P+R
  routing beyond what OTP2 auto-detects from `amenity=parking` tags. Only
  walk access/egress for transit itineraries is exercised, per this task's
  scope.
- ~~**`otpClient.ts`/`routing.ts` untouched.**~~ Done in Task Backend-03b:
  the Express wrapper now calls `planConnection` with raw lat/lng directly
  instead of the Task Backend-03 `stopsByRadius` + synthetic walk-leg
  workaround. See `backend-skeleton/README.md` for before/after numbers on
  the three AC routes.

## Data source notes

- **GTFS**: `https://gtfs.transjakarta.co.id/files/file_gtfs.zip` (indexed on
  Transitland as `f-transjakarta~id`, ~240 routes / ~8,000 stops). As of
  early September 2026 that host serves a **legitimate but expired** TLS
  certificate (`CN=*.transjakarta.co.id`, issued by Sectigo, valid
  2025-09-01 to 2026-09-01), so `download-gtfs` skips certificate
  verification for this one host. Harmless once they renew it.
- **OSM**: `https://download.geofabrik.de/asia/indonesia/java-latest.osm.pbf`
  (Geofabrik's daily-updated Java extract), clipped locally — see above.
