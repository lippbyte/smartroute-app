#!/usr/bin/env python3
"""Track 1 Tasks 1.1 + 1.2 (H10-14 sprint): full KRL Jabodetabek GTFS.

Supersedes build_krl_sample_gtfs.py (Task Backend-14's 8-station feasibility
sample). Same source dataset, now the whole network.

NOTE ON THE SOURCE: the sprint task card describes an Excel workbook
(`Data_KRL_JABODETABEK.xlsx`, sheets "Stasiun"/"Daftar Kereta"/"Detail
Perhentian"). No such file exists in this repo — the data is the JSON export
in `Data KRL JABODETABEK/`. Row counts line up exactly with the card
(1.000 kereta, 16.475 perhentian), so it is the same data, different format;
the sheet-by-sheet instructions were mapped onto the JSON equivalents:
    Stasiun          -> stations.json (+ geocode_krl_stations.py for lat/lon)
    Daftar Kereta    -> schedules_by_train_all.json (train_id/ka_name/color)
    Detail Perhentian-> schedules_by_train_all.json[].stops

DOCUMENTED LIMITATIONS (carried over from Task Backend-14's investigation —
these are properties of the source data, not conversion bugs):
  - No weekday/weekend/holiday distinction exists anywhere in the dataset, so
    calendar.txt is a single service running all 7 days.
  - stations.json has no coordinates at all; every lat/lon comes from
    OpenStreetMap via geocode_krl_stations.py (railway:ref-matched).
  - The dataset was synced 2026-07-01 and has already drifted: Karet (KAT)
    was closed by KAI Commuter on 2026-09-01 but is still flagged active.
    KAT is therefore EXCLUDED below, by explicit code, not silently.

Handled during conversion:
  - Midnight rollover: a stop time that moves backwards inside a trip means
    the trip crossed midnight. GTFS requires monotonic times, so that stop
    and every later one get +24h ("24:05:00"), which is how OTP2 models an
    overnight trip. 22 trips in this feed need it.
  - Trips with fewer than 2 usable stops cannot form a valid GTFS trip and
    are dropped (reported, not hidden).
  - "DINAS RANGKAIAN KRL" is a non-revenue stock movement, not a passenger
    service — excluded.
"""
import json
import zipfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
EXPERIMENT_DIR = SCRIPT_DIR.parent
DATASET_DIR = EXPERIMENT_DIR.parent.parent / "Data KRL JABODETABEK"
COORDS_FILE = EXPERIMENT_DIR / "data" / "krl_station_coords.json"
OUTPUT_ZIP = EXPERIMENT_DIR / "data" / "krl_gtfs.zip"

SERVICE_ID = "DAILY"
SERVICE_START = "20260101"
SERVICE_END = "20271231"

# Closed 2026-09-01 (OSM: disused:railway + end_date), service moved to BNI
# City. Still flagged active in the 2026-07-01 dataset.
CLOSED_STATIONS = {"KAT"}
# Non-revenue stock movements, not passenger services.
EXCLUDED_LINES = {"DINAS RANGKAIAN KRL"}


def load(name):
    with open(DATASET_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def title_case(name: str) -> str:
    """KCI writes station names in caps, sometimes unspaced ('SUDIRMANBARU').
    Prefer the OSM name when geocoding found one — it is already in the
    'Tanah Abang' style the TransJakarta feed uses (sprint card: "Format
    name: Title Case, consistent with TransJakarta stops")."""
    return " ".join(w.capitalize() for w in name.split())


def to_seconds(hhmmss: str) -> int:
    h, m, s = (int(p) for p in hhmmss.split(":"))
    return h * 3600 + m * 60 + s


def fmt_time(total_seconds: int) -> str:
    h, rem = divmod(total_seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def csv_escape(value: str) -> str:
    text = str(value)
    if any(c in text for c in [",", '"', "\n"]):
        return '"' + text.replace('"', '""') + '"'
    return text


def main():
    with open(COORDS_FILE, encoding="utf-8") as f:
        coords = json.load(f)["resolved"]
    stations = {
        s["id"]: s
        for s in load("stations.json")
        if s["active"] and s["id"] in coords and s["id"] not in CLOSED_STATIONS
    }
    print(f"Stations usable: {len(stations)}")

    trains = load("schedules_by_train_all.json")
    fares = load("fares_all.json")

    # ---- trips + stop_times -------------------------------------------
    trips, stop_times = [], []
    dropped_short, rollovers, dropped_lines, dropped_stops = 0, 0, 0, 0
    lines = {}

    for t in trains:
        if t["ka_name"] in EXCLUDED_LINES:
            dropped_lines += 1
            continue
        usable = [s for s in t["stops"] if s["station_id"] in stations]
        dropped_stops += len(t["stops"]) - len(usable)
        if len(usable) < 2:
            dropped_short += 1
            continue

        lines.setdefault(t["ka_name"], t.get("color") or "")

        times, prev, offset, rolled = [], None, 0, False
        for s in usable:
            secs = to_seconds(s["time_est"]) + offset
            if prev is not None and secs < prev:
                offset += 24 * 3600
                secs += 24 * 3600
                rolled = True
            times.append(secs)
            prev = secs
        if rolled:
            rollovers += 1

        trips.append(
            {
                "route": t["ka_name"],
                "trip_id": f"KRL{t['train_id']}",
                "headsign": title_case(usable[-1]["station_name"]),
            }
        )
        for seq, (s, secs) in enumerate(zip(usable, times), start=1):
            stop_times.append(
                (f"KRL{t['train_id']}", fmt_time(secs), s["station_id"], seq)
            )

    route_ids = {name: f"KRL_{i + 1}" for i, name in enumerate(sorted(lines))}
    print(f"Routes: {len(route_ids)}   Trips: {len(trips)}   StopTimes: {len(stop_times)}")
    print(f"  midnight-rollover trips handled: {rollovers}")
    print(f"  trips dropped (<2 usable stops): {dropped_short}")
    print(f"  trips dropped (non-revenue line): {dropped_lines}")
    print(f"  individual stops dropped (closed/ungeocoded station): {dropped_stops}")

    # ---- fares ---------------------------------------------------------
    fare_pairs = [
        f
        for f in fares
        if f["sta_code_from"] in stations and f["sta_code_to"] in stations
    ]
    tiers = sorted({f["fare"] for f in fare_pairs})
    fare_id = {price: f"KRL_F{price}" for price in tiers}
    print(f"Fares: {len(fare_pairs)} station pairs across {len(tiers)} price tiers")

    # ---- write ---------------------------------------------------------
    OUTPUT_ZIP.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(
            "agency.txt",
            "agency_id,agency_name,agency_url,agency_timezone,agency_lang\n"
            "KAI,KAI Commuter,https://commuterline.id,Asia/Jakarta,id\n",
        )

        rows = ["stop_id,stop_code,stop_name,stop_lat,stop_lon,zone_id,location_type"]
        for code, s in stations.items():
            c = coords[code]
            name = title_case(c.get("osm_name") or s["name"])
            rows.append(
                f"{code},{code},{csv_escape(name)},{c['lat']},{c['lon']},{code},0"
            )
        z.writestr("stops.txt", "\n".join(rows) + "\n")

        rows = [
            "route_id,agency_id,route_short_name,route_long_name,route_type,route_color"
        ]
        for name, rid in route_ids.items():
            short = name.replace("COMMUTER LINE ", "").title()
            color = (lines[name] or "").lstrip("#").upper()
            rows.append(
                f"{rid},KAI,{csv_escape(short)},{csv_escape(name)},2,{color}"
            )
        z.writestr("routes.txt", "\n".join(rows) + "\n")

        z.writestr(
            "calendar.txt",
            "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,"
            "start_date,end_date\n"
            f"{SERVICE_ID},1,1,1,1,1,1,1,{SERVICE_START},{SERVICE_END}\n",
        )

        rows = ["route_id,service_id,trip_id,trip_headsign"]
        for t in trips:
            rows.append(
                f"{route_ids[t['route']]},{SERVICE_ID},{t['trip_id']},"
                f"{csv_escape(t['headsign'])}"
            )
        z.writestr("trips.txt", "\n".join(rows) + "\n")

        rows = ["trip_id,arrival_time,departure_time,stop_id,stop_sequence"]
        for trip_id, time_str, stop_id, seq in stop_times:
            rows.append(f"{trip_id},{time_str},{time_str},{stop_id},{seq}")
        z.writestr("stop_times.txt", "\n".join(rows) + "\n")

        rows = ["fare_id,price,currency_type,payment_method,transfers,agency_id"]
        for price, fid in sorted(fare_id.items()):
            rows.append(f"{fid},{price},IDR,0,,KAI")
        z.writestr("fare_attributes.txt", "\n".join(rows) + "\n")

        # Zone-based: fares_all.json stores one row per unordered station
        # pair; KRL fares are distance-symmetric, so emit both directions.
        rows = ["fare_id,origin_id,destination_id"]
        for f in fare_pairs:
            fid = fare_id[f["fare"]]
            rows.append(f"{fid},{f['sta_code_from']},{f['sta_code_to']}")
            rows.append(f"{fid},{f['sta_code_to']},{f['sta_code_from']}")
        z.writestr("fare_rules.txt", "\n".join(rows) + "\n")

    print(f"\nWrote {OUTPUT_ZIP}")


if __name__ == "__main__":
    main()
