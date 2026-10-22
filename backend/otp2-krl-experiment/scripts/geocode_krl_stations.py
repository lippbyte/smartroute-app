#!/usr/bin/env python3
"""Task 1.3 (Track 1, H10-14 sprint): geocode every KRL station.

The source dataset (`Data KRL JABODETABEK/stations.json`) has NO coordinates
for ANY station — not "a few missing" as the sprint doc assumed, so every one
of the 85 rows has to be geocoded before a GTFS stops.txt can exist.

Method, in priority order (same rationale as Task Backend-11/14: match on a
STRUCTURED key first, fall back to fuzzy text only when forced):
  1. Overpass API, matching OSM's `railway:ref` tag against the station's own
     KCI code — exact, unambiguous, and self-verifying.
  2. Overpass again, matching normalized station NAME against OSM railway
     station/halt names inside the Jabodetabek bounding box.
  3. Whatever is still unmatched is REPORTED, never guessed — the caller
     decides (manual lookup or dropping the station), because a wrong
     coordinate silently produces wrong walking transfers in OTP2.

Writes `data/krl_station_coords.json` (code -> {name, lat, lon, source}).
"""
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
EXPERIMENT_DIR = SCRIPT_DIR.parent
DATASET_DIR = EXPERIMENT_DIR.parent.parent / "Data KRL JABODETABEK"
OUTPUT = EXPERIMENT_DIR / "data" / "krl_station_coords.json"

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
# Generous Jabodetabek + Rangkasbitung + Cikarang + Bogor box.
BBOX = (-6.85, 105.85, -5.90, 107.30)
USER_AGENT = "smartroute-krl-geocode/1.0"


def overpass(query: str, attempts: int = 4):
    for attempt in range(1, attempts + 1):
        try:
            req = urllib.request.Request(
                OVERPASS_URL,
                data=urllib.parse.urlencode({"data": query}).encode(),
                headers={"User-Agent": USER_AGENT},
            )
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.loads(resp.read().decode())
        except Exception as err:  # Overpass is flaky/rate-limited; back off.
            print(f"  overpass attempt {attempt}/{attempts} failed: {err}")
            if attempt == attempts:
                raise
            time.sleep(10 * attempt)


def element_rank(el, tags) -> int:
    """Lower is better. A node tagged railway=station is the station's own
    point; a way (building/yard) only gives a bounding-box centre, which for
    a long station yard can land hundreds of metres from the platforms."""
    is_node = el["type"] == "node"
    if is_node and tags.get("railway") == "station":
        return 0
    if is_node and tags.get("public_transport") == "station":
        return 1
    if is_node and tags.get("railway") in ("halt", "stop"):
        return 2
    if is_node:
        return 3
    if tags.get("railway") == "station" or tags.get("building") == "train_station":
        return 4
    return 5


def normalize(name: str) -> str:
    """KCI writes 'SUDIRMANBARU'/'JAKARTAKOTA' with no spaces; OSM writes
    'Sudirman Baru'/'Jakarta Kota'. Strip everything but letters/digits so
    the two can be compared at all."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def main():
    with open(DATASET_DIR / "stations.json", encoding="utf-8") as f:
        stations = json.load(f)

    south, west, north, east = BBOX
    box = f"{south},{west},{north},{east}"

    print(f"Pass 1: Overpass by railway:ref over bbox {box} ...")
    q1 = (
        f'[out:json][timeout:180];'
        f'(node["railway:ref"]({box});way["railway:ref"]({box}););'
        f"out center tags;"
    )
    data = overpass(q1)
    by_ref = {}
    for el in data["elements"]:
        tags = el.get("tags", {})
        ref = tags.get("railway:ref")
        if not ref:
            continue
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        if lat is None or lon is None:
            continue
        key = ref.strip().upper()
        cand = {
            "lat": lat,
            "lon": lon,
            "osm_name": tags.get("name", ""),
            "rank": element_rank(el, tags),
        }
        # A railway:ref can sit on several features around one station (the
        # station node, the building way, a stop/halt node, sometimes a yard
        # way whose centre is hundreds of metres off). Keep the best-ranked
        # one — picking blindly put Manggarai ~550 m from its real building.
        if key not in by_ref or cand["rank"] < by_ref[key]["rank"]:
            by_ref[key] = cand
    print(f"  {len(by_ref)} OSM features carry a railway:ref tag")

    print("Pass 2: Overpass by name over the same bbox ...")
    q2 = (
        f'[out:json][timeout:180];'
        f'(node["railway"~"^(station|halt)$"]({box});'
        f'way["railway"~"^(station|halt)$"]({box}););'
        f"out center tags;"
    )
    data2 = overpass(q2)
    by_name = {}
    for el in data2["elements"]:
        tags = el.get("tags", {})
        name = tags.get("name")
        if not name:
            continue
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        if lat is None or lon is None:
            continue
        key = normalize(name)
        cand = {
            "lat": lat,
            "lon": lon,
            "osm_name": name,
            "rank": element_rank(el, tags),
        }
        if key not in by_name or cand["rank"] < by_name[key]["rank"]:
            by_name[key] = cand
    print(f"  {len(by_name)} OSM railway station/halt features with a name")

    resolved, unresolved = {}, []
    for s in stations:
        code, name = s["id"], s["name"]
        hit = by_ref.get(code.upper())
        if hit:
            resolved[code] = {
                "name": name,
                "lat": hit["lat"],
                "lon": hit["lon"],
                "source": f"overpass:railway:ref={code}",
                "osm_name": hit["osm_name"],
            }
            continue
        hit = by_name.get(normalize(name))
        if hit:
            resolved[code] = {
                "name": name,
                "lat": hit["lat"],
                "lon": hit["lon"],
                "source": "overpass:name",
                "osm_name": hit["osm_name"],
            }
            continue
        unresolved.append((code, name))

    print(f"\nResolved {len(resolved)}/{len(stations)} stations.")
    if unresolved:
        print(f"UNRESOLVED ({len(unresolved)}) — reported, NOT guessed:")
        for code, name in unresolved:
            print(f"  {code}: {name}")

    # Sanity check: anything outside the bbox is a mismatch, not a station.
    bad = [
        (c, v)
        for c, v in resolved.items()
        if not (south <= v["lat"] <= north and west <= v["lon"] <= east)
    ]
    if bad:
        print(f"WARNING: {len(bad)} resolved coords fall outside the bbox:")
        for c, v in bad:
            print(f"  {c}: {v['lat']},{v['lon']}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(
            {"resolved": resolved, "unresolved": [c for c, _ in unresolved]},
            f,
            indent=2,
            ensure_ascii=False,
        )
    print(f"\nWrote {OUTPUT}")


if __name__ == "__main__":
    main()
