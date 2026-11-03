#!/usr/bin/env python3
"""Bangun public/data/network.json untuk simulasi dashboard.

Masukan : backend/otp2-setup/data/{transjakarta,krl,mrt,lrt}_gtfs.zip
          data-src/rail_segments.json (hasil extract_rail_geometry.py)
Keluaran: public/data/network.json

Hanya memakai pustaka standar Python. Tidak ada data yang dikarang: kecepatan
dan headway diturunkan dari stop_times/frequencies GTFS. Asumsi yang tersisa
(lama berhenti di halte) dicatat di src/simulation/constants.ts.

Pakai: python scripts/build_network.py [folder data GTFS]
"""
import collections
import csv
import datetime as dt
import io
import json
import math
import pathlib
import statistics
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "backend" / "otp2-setup" / "data"
RAIL = ROOT / "data-src" / "rail_segments.json"
NIGHT_RULE = ROOT / "data-src" / "brt_malam.json"
OUT = ROOT / "public" / "data" / "network.json"

# Harus sama dengan src/simulation/constants.ts.
DWELL_SEC = {"mrt": 25, "lrt_jabodebek": 25, "krl": 25, "brt": 20, "bus": 15, "mikrotrans": 15}
PEAK = [(420, 540), (1020, 1170)]  # 07:00-09:00 dan 17:00-19:30 WIB
SIMPLIFY_M = 10  # toleransi penyederhanaan geometri
SPEED_MIN, SPEED_MAX = 5.0, 100.0  # di luar rentang ini data dianggap salah

BUS_MODE = {
    "BRT": "brt",
    "Mikrotrans": "mikrotrans",
    "Angkutan Umum Integrasi": "bus",
    "Transjabodetabek": "bus",
    "Royaltrans": "bus",
    "Rusun": "bus",
    "Bus Wisata": "bus",
}
RAIL_FEEDS = {"krl": "krl", "mrt": "mrt", "lrt": "lrt_jabodebek"}
DAY_COLS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")


def hav(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[1], a[0], b[1], b[0]))
    x = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(x))


def secs(t):
    h, m, s = t.strip().split(":")
    return int(h) * 3600 + int(m) * 60 + int(s)


def xy(p, lat0):
    return (p[0] * 111320 * math.cos(math.radians(lat0)), p[1] * 110540)


def simplify(pts, tol=SIMPLIFY_M):
    """Douglas-Peucker iteratif; titik awal dan akhir selalu dipertahankan."""
    if len(pts) < 3:
        return pts
    lat0 = pts[0][1]
    q = [xy(p, lat0) for p in pts]
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = q[a]
        bx, by = q[b]
        dx, dy = bx - ax, by - ay
        den = dx * dx + dy * dy
        best, idx = 0.0, None
        for i in range(a + 1, b):
            px, py = q[i]
            t = 0 if den == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / den))
            d = math.hypot(px - ax - t * dx, py - ay - t * dy)
            if d > best:
                best, idx = d, i
        if idx is not None and best > tol:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def rnd(p):
    return [round(p[0], 5), round(p[1], 5)]


def cumulative(shape):
    out = [0.0]
    for a, b in zip(shape, shape[1:]):
        out.append(out[-1] + hav(a, b))
    return out


def project_stops(shape, stops):
    """Jarak tiap halte sepanjang jalur, selalu maju (jalur bisa melingkar)."""
    cum = cumulative(shape)
    lat0 = shape[0][1]
    q = [xy(p, lat0) for p in shape]
    res, off = [], []
    seg, along = 0, 0.0
    for s in stops:
        px, py = xy(s, lat0)
        best, bseg, bdist, bperp = math.inf, seg, along, 0.0
        for i in range(seg, len(shape) - 1):
            ax, ay = q[i]
            bx, by = q[i + 1]
            dx, dy = bx - ax, by - ay
            den = dx * dx + dy * dy
            t = 0 if den == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / den))
            perp = math.hypot(px - ax - t * dx, py - ay - t * dy)
            d = cum[i] + t * (cum[i + 1] - cum[i])
            if d < along:
                continue
            # Dorongan kecil ke titik terdekat ke depan: jalur melingkar
            # melewati lokasi yang sama dua kali.
            cost = perp + 0.03 * (d - along)
            if cost < best:
                best, bseg, bdist, bperp = cost, i, d, perp
        seg, along = bseg, bdist
        res.append(round(bdist, 1))
        off.append(bperp)
    return res, off, cum[-1]


def service(windows):
    """windows: [(mulai_mnt, selesai_mnt, headway_mnt)] -> bentuk service."""
    def in_peak(a, b):
        return sum(max(0, min(b, e) - max(a, s)) for s, e in PEAK)

    peak_w, peak_v, off_w, off_v = 0.0, 0.0, 0.0, 0.0
    for a, b, h in windows:
        pk = in_peak(a, b)
        of = (b - a) - pk
        peak_w += pk
        peak_v += pk * h
        off_w += of
        off_v += of * h
    peak = peak_v / peak_w if peak_w else None
    off = off_v / off_w if off_w else None
    out = {
        "startMin": min(w[0] for w in windows),
        "endMin": max(w[1] for w in windows),
        "headwayPeakMin": round(peak if peak is not None else off, 2),
        "headwayOffMin": round(off if off is not None else peak, 2),
    }
    if len(windows) > 1:
        # Jendela terpisah (mis. 05-07 dan 16-18) tidak boleh jadi layanan menerus.
        out["windows"] = [[round(a, 2), round(b, 2), round(h, 2)] for a, b, h in sorted(windows)]
    return out


def rail_service(deps):
    """deps: menit keberangkatan nyata dari jadwal GTFS satu pola."""
    deps = sorted(set(deps))
    start, end = deps[0], deps[-1] + 1
    gaps = [(a, b - a) for a, b in zip(deps, deps[1:])]
    pk = [g for a, g in gaps if any(s <= a < e for s, e in PEAK)]
    of = [g for a, g in gaps if not any(s <= a < e for s, e in PEAK)]
    single = end - start + 60  # satu keberangkatan saja
    peak = statistics.median(pk) if pk else None
    off = statistics.median(of) if of else None
    if peak is None and off is None:
        peak = off = single
    return {
        "startMin": start,
        "endMin": end,
        "headwayPeakMin": round(peak if peak is not None else off, 2),
        "headwayOffMin": round(off if off is not None else peak, 2),
        # Jadwal nyata. Median headway saja melebihkan KRL 21% karena banyak
        # pola hanya berjalan beberapa kali sehari.
        "departuresMin": [round(d, 2) for d in deps],
    }


def speed_for(length_m, duration_s, n_stops, mode, stats):
    moving = duration_s - DWELL_SEC[mode] * max(0, n_stops - 2)
    if moving <= 0:
        moving = duration_s
    v = length_m / moving * 3.6
    if v < SPEED_MIN or v > SPEED_MAX:
        stats["speed_clamped"] += 1
        v = max(SPEED_MIN, min(SPEED_MAX, v))
    return round(v, 2)


def reader(z):
    def rd(n):
        return list(csv.DictReader(io.TextIOWrapper(z.open(n), encoding="utf-8-sig")))

    return rd


def feed_date(z):
    y, m, d, *_ = max(i.date_time for i in z.infolist())
    return f"{y:04d}-{m:02d}-{d:02d}"


def build_bus(stops_out, routes_out, patterns, stats):
    z = zipfile.ZipFile(DATA / "transjakarta_gtfs.zip")
    rd = reader(z)
    routes = {r["route_id"]: r for r in rd("routes.txt")}
    stops = {s["stop_id"]: s for s in rd("stops.txt")}
    cal = {c["service_id"]: [c[d] == "1" for d in DAY_COLS] for c in rd("calendar.txt")}
    freq = collections.defaultdict(list)
    for f in rd("frequencies.txt"):
        freq[f["trip_id"]].append(f)
    st = collections.defaultdict(list)
    for s in rd("stop_times.txt"):
        st[s["trip_id"]].append(s)
    shp = collections.defaultdict(list)
    for s in rd("shapes.txt"):
        shp[s["shape_id"]].append((int(s["shape_pt_sequence"]), float(s["shape_pt_lon"]), float(s["shape_pt_lat"])))
    used_routes = set()
    for t in rd("trips.txt"):
        r = routes[t["route_id"]]
        mode = BUS_MODE.get(r.get("route_desc") or "")
        if mode is None:
            stats["bus_unmapped_category"] += 1
            continue
        days = cal.get(t["service_id"])
        ss = sorted(st[t["trip_id"]], key=lambda x: int(x["stop_sequence"]))
        rows = freq.get(t["trip_id"], [])
        if not days or not any(days) or len(ss) < 2 or not rows or not shp.get(t["shape_id"]):
            stats["bus_trip_skipped"] += 1
            continue
        raw = [[p[1], p[2]] for p in sorted(shp[t["shape_id"]])]
        shape = [rnd(p) for p in simplify(raw)]
        stats["shape_pts_raw"] += len(raw)
        stats["shape_pts_kept"] += len(shape)
        coords = [[float(stops[s["stop_id"]]["stop_lon"]), float(stops[s["stop_id"]]["stop_lat"])] for s in ss]
        dist, off, length = project_stops(shape, coords)
        stats["stop_off_shape_gt_150m"] += sum(1 for o in off if o > 150)
        stats["stops_projected"] += len(off)
        duration = secs(ss[-1]["arrival_time"]) - secs(ss[0]["departure_time"])
        windows = [
            (secs(f["start_time"]) / 60, secs(f["end_time"]) / 60, int(f["headway_secs"]) / 60)
            for f in rows
            if int(f["headway_secs"]) > 0
        ]
        if not windows:
            stats["bus_trip_skipped"] += 1
            continue
        for s in ss:
            stops_out[s["stop_id"]] = stops[s["stop_id"]]
        used_routes.add(t["route_id"])
        patterns.append(
            {
                "id": t["trip_id"],
                "routeId": t["route_id"],
                "mode": mode,
                "headsign": t.get("trip_headsign") or "",
                "stopIds": [s["stop_id"] for s in ss],
                "stopDistM": dist,
                "shape": shape,
                "speedKmh": speed_for(length, duration, len(ss), mode, stats),
                "service": {"days": days, **service(windows)},
                "timing": "gtfs-frequencies",
                "geometry": "gtfs-shape",
                "_direction": t.get("direction_id") or "?",
            }
        )
    for rid in used_routes:
        r = routes[rid]
        routes_out.append(
            {
                "id": rid,
                "code": r["route_short_name"] or rid,
                "name": r["route_long_name"],
                "mode": BUS_MODE[r["route_desc"]],
                "category": r["route_desc"],
                "color": "#" + (r.get("route_color") or "888888"),
            }
        )
    return feed_date(z)


def apply_brt_night(patterns, stats):
    """Aturan malam BRT dari data-src/brt_malam.json. ASUMSI, bukan isi feed.

    Feed menulis trip BRT 00:00-23:59 dengan satu headway untuk sehari penuh,
    termasuk semua varian. Rincian ada di laporan Dashboard Moda.
    """
    rule = json.loads(NIGHT_RULE.read_text(encoding="utf-8"))
    day = rule["jendela_siang_menit"]
    night = rule["jendela_malam_menit"]
    night_h = rule["headway_malam_menit"]

    targets = [
        p for p in patterns if p["mode"] == "brt" and p["service"]["startMin"] == 0 and p["service"]["endMin"] > 1439
    ]
    best = {}
    for p in targets:
        key = (p["routeId"], p["_direction"])
        regular = p["id"].split("-")[-1].startswith("R")
        cur = best.get(key)
        headway = p["service"]["headwayOffMin"]
        if (
            cur is None
            or (regular and not cur["regular"])
            or (regular == cur["regular"] and headway < cur["pattern"]["service"]["headwayOffMin"])
        ):
            best[key] = {"pattern": p, "regular": regular}
    main_ids = {b["pattern"]["id"] for b in best.values()}

    for p in targets:
        h = p["service"]["headwayOffMin"]
        service = {k: p["service"][k] for k in ("days", "headwayPeakMin", "headwayOffMin")}
        if p["id"] in main_ids:
            windows = [[night[0][0], night[0][1], night_h], [day[0], day[1], h], [night[1][0], night[1][1], night_h]]
            service.update(startMin=night[0][0], endMin=night[1][1], windows=windows)
        else:
            service.update(startMin=day[0], endMin=day[1], windows=[[day[0], day[1], h]])
        p["service"] = service
        p["timing"] = "gtfs-frequencies+aturan-malam"
    for p in patterns:
        p.pop("_direction", None)

    stats["brt_night_targets"] = len(targets)
    stats["brt_night_main"] = len(main_ids)
    print("pola utama malam:")
    for key in sorted(best, key=lambda k: (len(k[0]), k)):
        b = best[key]["pattern"]
        print(f"  rute {key[0]:>3} arah {key[1]}  {b['id']:9} ke {b['headsign'][:30]:30} siang tiap {b['service']['headwayOffMin']:g} mnt")
    return {
        "label": rule["status"],
        "headwayMin": night_h,
        "mainPatterns": len(main_ids),
        "affectedPatterns": len(targets),
    }


def build_rail(feed, mode, segments, stops_out, routes_out, patterns, stats):
    z = zipfile.ZipFile(DATA / f"{feed}_gtfs.zip")
    rd = reader(z)
    routes = {r["route_id"]: r for r in rd("routes.txt")}
    stops = {s["stop_id"]: s for s in rd("stops.txt")}
    cal = {c["service_id"]: [c[d] == "1" for d in DAY_COLS] for c in rd("calendar.txt")}
    trips = {t["trip_id"]: t for t in rd("trips.txt")}
    st = collections.defaultdict(list)
    for s in rd("stop_times.txt"):
        st[s["trip_id"]].append(s)
    groups = collections.defaultdict(list)
    for tid, ss in st.items():
        ss.sort(key=lambda x: int(x["stop_sequence"]))
        t = trips[tid]
        key = (t["route_id"], t["service_id"], tuple(s["stop_id"] for s in ss))
        groups[key].append((secs(ss[0]["departure_time"]), secs(ss[-1]["arrival_time"]), t.get("trip_headsign") or ""))
    seq = 0
    for (rid, sid, stop_ids), runs in sorted(groups.items()):
        seq += 1
        shape, dist = [], []
        straight = 0
        for a, b in zip(stop_ids, stop_ids[1:]):
            line = segments.get(f"{a}|{b}")
            if not line:
                straight += 1
                line = [
                    [float(stops[a]["stop_lon"]), float(stops[a]["stop_lat"])],
                    [float(stops[b]["stop_lon"]), float(stops[b]["stop_lat"])],
                ]
            seg = [rnd(p) for p in simplify(line)]
            if not shape:
                shape.append(seg[0])
                dist.append(0.0)
            before = len(shape) - 1
            shape += seg[1:]
            cum = cumulative(shape[before:])
            dist.append(round(dist[-1] + cum[-1], 1))
        stats["rail_straight_segments"] += straight
        for s in stop_ids:
            stops_out[s] = stops[s]
        duration = statistics.median(b - a for a, b, _ in runs)
        patterns.append(
            {
                "id": f"{rid}-{sid}-{seq}",
                "routeId": rid,
                "mode": mode,
                "headsign": runs[0][2] or stops[stop_ids[-1]]["stop_name"],
                "stopIds": list(stop_ids),
                "stopDistM": dist,
                "shape": shape,
                "speedKmh": speed_for(dist[-1], duration, len(stop_ids), mode, stats),
                "service": {"days": cal[sid], **rail_service([a / 60 for a, _, _ in runs])},
                "timing": "gtfs-timetable",
                "geometry": "osm" if straight == 0 else "osm+garis-lurus",
            }
        )
    for rid, r in routes.items():
        routes_out.append(
            {
                "id": rid,
                "code": r["route_short_name"] or rid,
                "name": r["route_long_name"],
                "mode": mode,
                "category": mode,
                "color": "#" + (r.get("route_color") or "888888"),
            }
        )
    return feed_date(z)


def main():
    rail = json.loads(RAIL.read_text(encoding="utf-8"))
    stats = collections.Counter()
    stops_out, routes_out, patterns = {}, [], []
    dates = {"transjakarta": build_bus(stops_out, routes_out, patterns, stats)}
    brt_night = apply_brt_night(patterns, stats)
    for feed, mode in RAIL_FEEDS.items():
        dates[feed] = build_rail(feed, mode, rail["segments"], stops_out, routes_out, patterns, stats)
    network = {
        "version": {
            "builtAt": dt.datetime.now(dt.timezone(dt.timedelta(hours=7))).strftime("%Y-%m-%d"),
            "feeds": dates,
            "osmExtract": rail["source"],
            "brtNight": brt_night,
        },
        "routes": sorted(routes_out, key=lambda r: (r["mode"], r["code"])),
        "stops": [
            {"id": k, "name": v["stop_name"], "lon": round(float(v["stop_lon"]), 5), "lat": round(float(v["stop_lat"]), 5)}
            for k, v in sorted(stops_out.items())
        ],
        "patterns": patterns,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(network, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("pola per moda:", dict(collections.Counter(p["mode"] for p in patterns)))
    print("rute:", len(routes_out), "halte:", len(stops_out))
    print("statistik:", dict(stats))
    print("ukuran network.json:", round(OUT.stat().st_size / 1e6, 2), "MB")


if __name__ == "__main__":
    main()
