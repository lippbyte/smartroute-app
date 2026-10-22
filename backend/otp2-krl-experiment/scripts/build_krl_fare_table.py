#!/usr/bin/env python3
"""Emit the KRL station-to-station fare matrix as a compact JSON table the
Express backend can bundle (backend-skeleton/src/data/krlFares.json).

KRL fares are distance-based per origin/destination pair, NOT a flat rate
like TransJakarta — so a KRL leg's price can only be resolved by looking up
the pair the passenger actually rides. Source is the same official KCI
dataset the GTFS is built from (fares_all.json, synced 2026-07-01).

Only one direction per pair is stored (fares are symmetric); the lookup in
krlFares.ts tries both orders.
"""
import json
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
EXPERIMENT_DIR = SCRIPT_DIR.parent
DATASET_DIR = EXPERIMENT_DIR.parent.parent / "Data KRL JABODETABEK"
COORDS = EXPERIMENT_DIR / "data" / "krl_station_coords.json"
OUTPUT = EXPERIMENT_DIR.parent / "backend-skeleton" / "src" / "data" / "krlFares.json"

CLOSED_STATIONS = {"KAT"}


def main():
    fares = json.loads((DATASET_DIR / "fares_all.json").read_text(encoding="utf-8"))
    coords = json.loads(COORDS.read_text(encoding="utf-8"))["resolved"]
    usable = set(coords) - CLOSED_STATIONS

    table = {}
    for f in fares:
        a, b = f["sta_code_from"], f["sta_code_to"]
        if a in usable and b in usable:
            table[f"{a}|{b}"] = f["fare"]

    payload = {
        "source": "KCI (kci.id) fares_all.json, synced 2026-07-01",
        "note": "one direction per pair; fares are symmetric by distance",
        "fares": dict(sorted(table.items())),
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=0), encoding="utf-8")
    prices = sorted(set(table.values()))
    print(f"Wrote {OUTPUT}")
    print(f"  {len(table)} pairs, tiers Rp{prices[0]:,}..Rp{prices[-1]:,}")


if __name__ == "__main__":
    main()
