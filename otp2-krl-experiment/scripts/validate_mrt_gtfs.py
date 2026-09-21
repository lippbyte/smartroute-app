#!/usr/bin/env python3
"""Task 2 QA: validasi mrt_gtfs.zip sebelum boleh mendekati graph produksi.

Diadaptasi dari validate_krl_gtfs.py — pemeriksaan struktural & referensialnya
sama. Yang BERBEDA untuk MRT:
  - route_type wajib 1 (subway), bukan 2 (rail) seperti KRL.
  - Layanan berbasis frequencies.txt, jadi tidak ada trip lewat tengah malam
    yang perlu notasi >24:00:00 (di KRL justru wajib ada).
  - Tarif harus menutup SELURUH pasangan asal-tujuan; feed ini kecil dan
    dibangkitkan, jadi lubang satu pun berarti ada bug di generatornya.

Keluar dengan status bukan-nol kalau ada kegagalan, supaya bisa dipakai
sebagai gerbang sebelum rebuild graph.
"""
import csv
import io
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

GTFS = Path(__file__).resolve().parent.parent / "data" / "mrt_gtfs.zip"
# Koridor fase 1 saja — lebih ketat daripada kotak Jabodetabek milik KRL,
# karena stasiun MRT yang nyasar ke luar koridor pasti salah.
BBOX = (-6.33, 106.73, -6.16, 106.86)

REQUIRED = {
    "agency.txt": ["agency_id", "agency_name", "agency_timezone"],
    "stops.txt": ["stop_id", "stop_name", "stop_lat", "stop_lon"],
    "routes.txt": ["route_id", "route_short_name", "route_type"],
    "trips.txt": ["route_id", "service_id", "trip_id"],
    "stop_times.txt": ["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"],
    "calendar.txt": ["service_id", "monday", "start_date", "end_date"],
    "frequencies.txt": ["trip_id", "start_time", "end_time", "headway_secs"],
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

    print("1. File & kolom wajib")
    for fname, cols in REQUIRED.items():
        if fname not in names:
            fail(f"{fname} tidak ada di feed")
            continue
        rows = read(z, fname)
        header = rows[0].keys() if rows else []
        for c in cols:
            if c not in header:
                fail(f"{fname}: kolom wajib '{c}' tidak ada")
    if failures:
        print("\nBerhenti — masalah struktural.")
        return 1
    print("  OK")

    stops = read(z, "stops.txt")
    routes = read(z, "routes.txt")
    trips = read(z, "trips.txt")
    stop_times = read(z, "stop_times.txt")
    calendar = read(z, "calendar.txt")
    freqs = read(z, "frequencies.txt")
    fare_attrs = read(z, "fare_attributes.txt")
    fare_rules = read(z, "fare_rules.txt")

    print("\n2. Jumlah baris")
    print(f"  stops={len(stops)} routes={len(routes)} trips={len(trips)} "
          f"stop_times={len(stop_times)} frequencies={len(freqs)} "
          f"fare_attributes={len(fare_attrs)} fare_rules={len(fare_rules)}")

    print("\n3. Integritas referensial")
    stop_ids = {s["stop_id"] for s in stops}
    route_ids = {r["route_id"] for r in routes}
    trip_ids = {t["trip_id"] for t in trips}
    service_ids = {c["service_id"] for c in calendar}
    fare_ids = {f["fare_id"] for f in fare_attrs}
    zone_ids = {s.get("zone_id") for s in stops}

    if {st["stop_id"] for st in stop_times} - stop_ids:
        fail("stop_times menunjuk stop_id yang tidak ada di stops.txt")
    if {st["trip_id"] for st in stop_times} - trip_ids:
        fail("stop_times menunjuk trip_id yang tidak ada di trips.txt")
    if {t["route_id"] for t in trips} - route_ids:
        fail("trips menunjuk route_id yang tidak ada")
    if {t["service_id"] for t in trips} - service_ids:
        fail("trips menunjuk service_id yang tidak ada di calendar.txt")
    if {f["trip_id"] for f in freqs} - trip_ids:
        fail("frequencies menunjuk trip_id yang tidak ada")
    if {f["fare_id"] for f in fare_rules} - fare_ids:
        fail("fare_rules menunjuk fare_id yang tidak ada")
    if {f.get("origin_id") for f in fare_rules} - zone_ids:
        fail("fare_rules memakai origin_id yang bukan zone_id stasiun mana pun")
    if {f.get("destination_id") for f in fare_rules} - zone_ids:
        fail("fare_rules memakai destination_id yang bukan zone_id stasiun mana pun")
    if trip_ids - {st["trip_id"] for st in stop_times}:
        fail("ada trip tanpa baris stop_times")
    if trip_ids - {f["trip_id"] for f in freqs}:
        fail("ada trip tanpa baris frequencies (layanan ini berbasis headway)")
    if not failures:
        print("  OK — semua referensi silang ketemu")

    print("\n4. Urutan & waktu perhentian")
    by_trip = defaultdict(list)
    for st in stop_times:
        by_trip[st["trip_id"]].append(st)
    for tid, rows in by_trip.items():
        rows.sort(key=lambda r: int(r["stop_sequence"]))
        seqs = [int(r["stop_sequence"]) for r in rows]
        if seqs != list(range(1, len(seqs) + 1)):
            fail(f"trip {tid}: stop_sequence bukan 1..n")
        secs = [to_secs(r["arrival_time"]) for r in rows]
        if any(b < a for a, b in zip(secs, secs[1:])):
            fail(f"trip {tid}: waktu mundur")
        if len(rows) != len(stops):
            fail(f"trip {tid}: {len(rows)} perhentian, seharusnya {len(stops)}")
    if not failures:
        span = max(to_secs(r[-1]["arrival_time"]) - to_secs(r[0]["arrival_time"])
                   for r in by_trip.values())
        print(f"  OK — {len(by_trip)} trip, ujung-ke-ujung {span//60} menit")

    print("\n5. Kewarasan koordinat")
    south, west, north, east = BBOX
    out = [(s["stop_id"], s["stop_lat"], s["stop_lon"]) for s in stops
           if not (south <= float(s["stop_lat"]) <= north
                   and west <= float(s["stop_lon"]) <= east)]
    if out:
        fail(f"{len(out)} stasiun di luar koridor: {out[:5]}")
    else:
        print(f"  OK — {len(stops)} stasiun di dalam {BBOX}")

    print("\n6. Khusus MRT: route_type & cakupan tarif")
    for r in routes:
        if r["route_type"] != "1":
            fail(f"route {r['route_id']}: route_type={r['route_type']}, harus 1 (subway)")
    pairs = {(f.get("origin_id"), f.get("destination_id")) for f in fare_rules}
    expected = {(a["zone_id"], b["zone_id"]) for a in stops for b in stops
                if a["zone_id"] != b["zone_id"]}
    if pairs != expected:
        fail(f"cakupan tarif bolong: {len(expected - pairs)} pasangan tanpa tarif")
    else:
        prices = sorted(int(f["price"]) for f in fare_attrs)
        print(f"  OK — route_type=1, {len(pairs)} pasangan tarif lengkap, "
              f"Rp{prices[0]:,}-Rp{prices[-1]:,}".replace(",", "."))

    print("\n7. Kewarasan headway")
    for f in freqs:
        hw = int(f["headway_secs"])
        if not 60 <= hw <= 3600:
            fail(f"headway {hw}s di luar batas wajar (60-3600)")
        if to_secs(f["end_time"]) <= to_secs(f["start_time"]):
            fail(f"jendela frequencies terbalik: {f['start_time']}-{f['end_time']}")
    if not failures:
        print(f"  OK — {len(freqs)} jendela headway")

    print("\n" + "=" * 60)
    print(f"{len(failures)} error, {len(warnings)} peringatan")
    if failures:
        for m in failures:
            print(f"  - {m}")
        return 1
    print("LULUS — feed MRT siap dipakai membangun graph")
    return 0


if __name__ == "__main__":
    sys.exit(main())
