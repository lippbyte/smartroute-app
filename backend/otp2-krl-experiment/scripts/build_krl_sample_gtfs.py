#!/usr/bin/env python3
"""Task Backend-14: build a SMALL sample GTFS feed for KRL Commuter Line,
from the raw `Data KRL JABODETABEK` dataset (kci.id via Kaggle, CC-BY-SA-4.0),
to test feasibility of loading KRL alongside TransJakarta in OTP2.

Deliberately NOT a full 84-station conversion (out of scope for this task —
see Task_Backend_14_KRL_GTFS_Feasibility.md's explicit constraint). Scope is
8 stations around the Manggarai hub (Manggarai, Sudirman, Sudirman
Baru/BNI City, Tanah Abang, Duri, Jatinegara, Cikini, Gondangdia) — close to
real TransJakarta transfer points, per the task brief's suggested area.

Station "Karet" (KAT) is EXCLUDED even though it's in the original station
list near this hub: OpenStreetMap (railway:ref=KAT node, checked live) tags
it as disused with end_date=2026-09-01 — KAI Commuter closed it and moved
service to BNI City. The source dataset (synced 2026-07-01) still lists it
active; this is a real staleness gap in the dataset, noted in the
investigation report, not something to route around silently here.

Known, documented limitations of this sample (do not treat as bugs):
  - Station coordinates are NOT in the source dataset at all (stations.json
    has no lat/lon) — the 8 coordinates below were sourced from OpenStreetMap
    Overpass API, matched by the `railway:ref` tag against each station's own
    code (not fuzzy name search) for the same reason Task Backend-11 avoided
    fuzzy Nominatim text matching. Full 84-station conversion would need this
    done for every station.
  - The dataset has ONE generic daily schedule per train — no weekday/
    weekend/holiday distinction anywhere in schedules_by_train_all.json (no
    day-type field of any kind). calendar.txt below is a single service_id
    running all 7 days. This is a real accuracy gap versus TransJakarta's
    feed (which does have weekday/weekend calendars) — flagged as a finding,
    not silently glossed over.
  - Only stops within the 8-station whitelist are kept per trip — a train's
    real intermediate stops outside this set are dropped from stop_times.txt
    (their scheduled times at the kept stations are unaffected, so travel
    times between kept stations are still the real scraped durations).
  - Trip volume is thinned (see MAX_TRIPS_PER_LINE below) — this is a
    feasibility sample, not a headway-accurate mini feed.
"""
import csv
import json
import zipfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
EXPERIMENT_DIR = SCRIPT_DIR.parent
DATASET_DIR = EXPERIMENT_DIR.parent.parent / "Data KRL JABODETABEK"
OUTPUT_ZIP = EXPERIMENT_DIR / "data" / "krl_sample_gtfs.zip"

# Verified via Overpass API, node tagged railway=station with railway:ref
# matching the station's own dataset code exactly (2026-09-19).
STATIONS = {
    "JNG": {"name": "Jatinegara", "lat": -6.2149252, "lon": 106.8703394},
    "MRI": {"name": "Manggarai", "lat": -6.2101704, "lon": 106.8499350},
    "CKI": {"name": "Cikini", "lat": -6.1985052, "lon": 106.8412799},
    "GDD": {"name": "Gondangdia", "lat": -6.1859109, "lon": 106.8325657},
    "SUD": {"name": "Sudirman", "lat": -6.2024081, "lon": 106.8234493},
    "SUDB": {"name": "BNI City", "lat": -6.2015938, "lon": 106.8197174},
    "THB": {"name": "Tanah Abang", "lat": -6.1857127, "lon": 106.8108938},
    "DU": {"name": "Duri", "lat": -6.1552764, "lon": 106.8012968},
}

# Cap per line name so the sample stays small (task's explicit constraint)
# while still spanning the day for realistic time-of-day query testing.
MAX_TRIPS_PER_LINE = 8

SERVICE_ID = "DAILY"


def load_json(name):
    with open(DATASET_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def build_trips():
    trains = load_json("schedules_by_train_all.json")
    by_line = {}
    for t in trains:
        if t["ka_name"].startswith("DINAS"):
            continue  # non-revenue depot movement, not a passenger service
        stops = [s for s in t["stops"] if s["station_id"] in STATIONS]
        if len(stops) < 2:
            continue
        by_line.setdefault(t["ka_name"], []).append((t["train_id"], t["color"], stops))

    selected = []
    for line_name, trips in by_line.items():
        trips.sort(key=lambda x: x[2][0]["time_est"])
        step = max(1, len(trips) // MAX_TRIPS_PER_LINE)
        thinned = trips[::step][:MAX_TRIPS_PER_LINE]
        for train_id, color, stops in thinned:
            selected.append((line_name, train_id, color, stops))
    return selected


def build_fares():
    fares = load_json("fares_all.json")
    rows = [
        f
        for f in fares
        if f["sta_code_from"] in STATIONS and f["sta_code_to"] in STATIONS
    ]
    tiers = sorted({r["fare"] for r in rows})
    fare_id_by_price = {price: f"F{price}" for price in tiers}
    return rows, fare_id_by_price


def write_gtfs(selected_trips, fare_rows, fare_id_by_price):
    OUTPUT_ZIP.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        # agency.txt
        z.writestr(
            "agency.txt",
            "agency_id,agency_name,agency_url,agency_timezone,agency_lang\n"
            "KAI,KAI Commuter,https://www.kai-commuter.com,Asia/Jakarta,id\n",
        )

        # stops.txt — zone_id = station code, used by fare_rules.txt below
        # (GTFS zone-based fares: one row per station-code zone).
        lines = ["stop_id,stop_name,stop_lat,stop_lon,zone_id,location_type"]
        for code, s in STATIONS.items():
            lines.append(f"{code},{s['name']},{s['lat']},{s['lon']},{code},0")
        z.writestr("stops.txt", "\n".join(lines) + "\n")

        # routes.txt — one route per KA line name in the sample.
        line_names = sorted({t[0] for t in selected_trips})
        route_id_by_line = {name: f"R{i+1}" for i, name in enumerate(line_names)}
        lines = ["route_id,agency_id,route_short_name,route_long_name,route_type"]
        for name, rid in route_id_by_line.items():
            short = name.replace("COMMUTER LINE ", "")
            lines.append(f'{rid},KAI,{short},"{name}",2')
        z.writestr("routes.txt", "\n".join(lines) + "\n")

        # calendar.txt — single all-week service; see module docstring for
        # why (no weekday/weekend distinction exists in the source data).
        z.writestr(
            "calendar.txt",
            "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n"
            f"{SERVICE_ID},1,1,1,1,1,1,1,20260101,20261231\n",
        )

        # trips.txt + stop_times.txt
        trip_lines = ["route_id,service_id,trip_id,trip_headsign"]
        st_lines = ["trip_id,arrival_time,departure_time,stop_id,stop_sequence"]
        for line_name, train_id, color, stops in selected_trips:
            rid = route_id_by_line[line_name]
            trip_id = f"T{train_id}"
            headsign = stops[-1]["station_name"].title()
            trip_lines.append(f'{rid},{SERVICE_ID},{trip_id},"{headsign}"')
            for seq, s in enumerate(stops, start=1):
                t = s["time_est"]
                st_lines.append(f"{trip_id},{t},{t},{s['station_id']},{seq}")
        z.writestr("trips.txt", "\n".join(trip_lines) + "\n")
        z.writestr("stop_times.txt", "\n".join(st_lines) + "\n")

        # fare_attributes.txt — one row per unique price tier found among
        # the 8 sample stations (11 tiers network-wide; fewer expected here
        # since it's a small geographic cluster).
        lines = [
            "fare_id,price,currency_type,payment_method,transfers,agency_id"
        ]
        for price, fid in sorted(fare_id_by_price.items()):
            lines.append(f"{fid},{price},IDR,0,,KAI")
        z.writestr("fare_attributes.txt", "\n".join(lines) + "\n")

        # fare_rules.txt — zone-based (origin_id/destination_id = stop
        # zone_id = station code). fares_all.json stores one direction per
        # unordered pair; both directions are emitted since KRL fares are
        # symmetric by distance.
        lines = ["fare_id,origin_id,destination_id"]
        for r in fare_rows:
            fid = fare_id_by_price[r["fare"]]
            lines.append(f"{fid},{r['sta_code_from']},{r['sta_code_to']}")
            lines.append(f"{fid},{r['sta_code_to']},{r['sta_code_from']}")
        z.writestr("fare_rules.txt", "\n".join(lines) + "\n")

    print(f"Wrote {OUTPUT_ZIP}")
    print(f"  {len(selected_trips)} trips across {len(line_names)} lines")
    print(f"  {len(fare_rows)} fare pairs, {len(fare_id_by_price)} price tiers")


def main():
    selected = build_trips()
    fare_rows, fare_id_by_price = build_fares()
    write_gtfs(selected, fare_rows, fare_id_by_price)


if __name__ == "__main__":
    main()
