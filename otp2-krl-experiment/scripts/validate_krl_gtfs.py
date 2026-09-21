#!/usr/bin/env python3
"""Track 1 QA: validate krl_gtfs.zip before it is allowed near the production
graph. Covers the sprint card's checklist items for Tasks 1.1-1.3 — required
columns present, stop_id cross-reference, midnight handling, lat/lon bounding
box — plus referential checks a GTFS validator would do.

Exits non-zero on any failure so it can gate the graph rebuild.
"""
import csv
import io
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

GTFS = Path(__file__).resolve().parent.parent / "data" / "krl_gtfs.zip"
# Jabodetabek + Rangkasbitung + Cikarang, per the sprint card's sanity box
# (widened west/east/south: the card's -6.4..-6.0 / 106.6..107.1 predates
# Rangkasbitung 106.25 and Bogor -6.59 being in scope).
BBOX = (-6.70, 106.10, -6.00, 107.25)

REQUIRED = {
    "agency.txt": ["agency_id", "agency_name", "agency_timezone"],
    "stops.txt": ["stop_id", "stop_name", "stop_lat", "stop_lon"],
    "routes.txt": ["route_id", "route_short_name", "route_type"],
    "trips.txt": ["route_id", "service_id", "trip_id"],
    "stop_times.txt": ["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"],
    "calendar.txt": ["service_id", "monday", "start_date", "end_date"],
    "fare_attributes.txt": ["fare_id", "price", "currency_type"],
    "fare_rules.txt": ["fare_id"],
}

failures, warnings = [], []


def fail(msg):
    failures.append(msg)
    print(f"  FAIL: {msg}")


def warn(msg):
    warnings.append(msg)
    print(f"  WARN: {msg}")


def read(z, name):
    with z.open(name) as f:
        return list(csv.DictReader(io.TextIOWrapper(f, encoding="utf-8")))


def to_secs(t):
    h, m, s = (int(p) for p in t.split(":"))
    return h * 3600 + m * 60 + s


def main():
    z = zipfile.ZipFile(GTFS)
    names = set(z.namelist())

    print("1. Required files & columns")
    for fname, cols in REQUIRED.items():
        if fname not in names:
            fail(f"{fname} missing from feed")
            continue
        header = read(z, fname)[0].keys() if read(z, fname) else []
        for c in cols:
            if c not in header:
                fail(f"{fname}: required column '{c}' missing")
    if failures:
        print("\nAborting — structural problems.")
        return 1
    print("  OK")

    stops = read(z, "stops.txt")
    routes = read(z, "routes.txt")
    trips = read(z, "trips.txt")
    stop_times = read(z, "stop_times.txt")
    calendar = read(z, "calendar.txt")
    fare_attrs = read(z, "fare_attributes.txt")
    fare_rules = read(z, "fare_rules.txt")

    print(f"\n2. Row counts")
    print(f"  stops={len(stops)} routes={len(routes)} trips={len(trips)} "
          f"stop_times={len(stop_times)} fare_attributes={len(fare_attrs)} "
          f"fare_rules={len(fare_rules)}")

    print("\n3. Referential integrity")
    stop_ids = {s["stop_id"] for s in stops}
    route_ids = {r["route_id"] for r in routes}
    trip_ids = {t["trip_id"] for t in trips}
    service_ids = {c["service_id"] for c in calendar}
    fare_ids = {f["fare_id"] for f in fare_attrs}

    missing_stop = {st["stop_id"] for st in stop_times if st["stop_id"] not in stop_ids}
    if missing_stop:
        fail(f"stop_times references {len(missing_stop)} unknown stop_id(s): {sorted(missing_stop)[:5]}")
    missing_trip = {st["trip_id"] for st in stop_times if st["trip_id"] not in trip_ids}
    if missing_trip:
        fail(f"stop_times references {len(missing_trip)} unknown trip_id(s)")
    bad_route = {t["route_id"] for t in trips if t["route_id"] not in route_ids}
    if bad_route:
        fail(f"trips reference unknown route_id(s): {bad_route}")
    bad_service = {t["service_id"] for t in trips if t["service_id"] not in service_ids}
    if bad_service:
        fail(f"trips reference unknown service_id(s): {bad_service}")
    bad_fare = {f["fare_id"] for f in fare_rules if f["fare_id"] not in fare_ids}
    if bad_fare:
        fail(f"fare_rules reference unknown fare_id(s): {bad_fare}")
    unused_zone = {f["origin_id"] for f in fare_rules if f.get("origin_id") not in stop_ids}
    if unused_zone:
        fail(f"fare_rules reference {len(unused_zone)} zone(s) with no matching stop zone_id")
    orphan_trips = trip_ids - {st["trip_id"] for st in stop_times}
    if orphan_trips:
        fail(f"{len(orphan_trips)} trips have no stop_times rows")
    if not failures:
        print("  OK — all cross-references resolve")

    print("\n4. Stop time ordering & midnight handling")
    by_trip = defaultdict(list)
    for st in stop_times:
        by_trip[st["trip_id"]].append(st)
    overnight = []
    for tid, rows in by_trip.items():
        rows.sort(key=lambda r: int(r["stop_sequence"]))
        seqs = [int(r["stop_sequence"]) for r in rows]
        if seqs != list(range(1, len(seqs) + 1)):
            fail(f"trip {tid}: stop_sequence not 1..n ({seqs[:5]}...)")
        secs = [to_secs(r["arrival_time"]) for r in rows]
        if any(b < a for a, b in zip(secs, secs[1:])):
            fail(f"trip {tid}: times go backwards — midnight rollover not applied")
        if secs[-1] >= 24 * 3600:
            overnight.append((tid, rows[0]["arrival_time"], rows[-1]["arrival_time"]))
        if len(rows) < 2:
            fail(f"trip {tid}: fewer than 2 stop_times rows")
    print(f"  {len(overnight)} overnight trips using >24:00:00 notation")
    for tid, first, last in overnight[:5]:
        print(f"    {tid}: {first} -> {last}")
    if not overnight:
        warn("no overnight trips found — expected ~20 from the source data")

    print("\n5. Coordinate sanity (bounding box)")
    south, west, north, east = BBOX
    out = [
        (s["stop_id"], s["stop_lat"], s["stop_lon"])
        for s in stops
        if not (south <= float(s["stop_lat"]) <= north and west <= float(s["stop_lon"]) <= east)
    ]
    if out:
        fail(f"{len(out)} stops outside the Jabodetabek box: {out[:5]}")
    else:
        print(f"  OK — all {len(stops)} stops inside {BBOX}")
    if any(not s["stop_lat"] or not s["stop_lon"] for s in stops):
        fail("some stops have empty lat/lon")

    print("\n6. Naming consistency")
    bad_names = [
        s["stop_name"]
        for s in stops
        if s["stop_name"] != s["stop_name"].strip() or "  " in s["stop_name"]
    ]
    if bad_names:
        fail(f"stop names with stray whitespace: {bad_names[:5]}")
    allcaps = [s["stop_name"] for s in stops if s["stop_name"].isupper()]
    if allcaps:
        warn(f"{len(allcaps)} stop names still ALL CAPS (want Title Case): {allcaps[:5]}")
    if not bad_names and not allcaps:
        print("  OK — Title Case, no stray whitespace")

    print("\n" + "=" * 60)
    if failures:
        print(f"RESULT: {len(failures)} FAILURE(S), {len(warnings)} warning(s)")
        return 1
    print(f"RESULT: PASS ({len(warnings)} warning(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
