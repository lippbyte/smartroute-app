#!/usr/bin/env python3
"""Bangun geometri rel antar-stasiun dari ekstrak OpenStreetMap milik proyek.

GTFS KRL/MRT/LRT kita tidak punya shapes.txt. Skrip ini mencari jalur terpendek
pada graf rel OSM untuk setiap pasangan stasiun berurutan di stop_times.txt.

Masukan : backend/otp2-setup/data/{krl,mrt,lrt}_gtfs.zip + jabodetabek.osm.pbf
Keluaran: data-src/rail_segments.json
Lisensi : keluaran adalah turunan OpenStreetMap, ODbL 1.0 (lihat data-src/README.md).

Pakai: python scripts/extract_rail_geometry.py <folder data> [keluaran]
Butuh pyosmium (`pip install osmium`), hanya untuk skrip ini. Bukan dependensi
dashboard: hasilnya disimpan di repo.
"""
import collections
import csv
import heapq
import io
import json
import math
import pathlib
import sys
import zipfile

import osmium

DATA = pathlib.Path(sys.argv[1])
OUT = (
    pathlib.Path(sys.argv[2])
    if len(sys.argv) > 2
    else pathlib.Path(__file__).parents[1] / "data-src" / "rail_segments.json"
)
PBF = DATA / "jabodetabek.osm.pbf"

# Jenis rel OSM yang boleh dipakai tiap jaringan.
NETWORKS = {
    "krl": {"zip": "krl_gtfs.zip", "railway": {"rail"}},
    "mrt": {"zip": "mrt_gtfs.zip", "railway": {"subway", "light_rail", "rail"}},
    "lrt": {"zip": "lrt_gtfs.zip", "railway": {"light_rail", "subway"}},
}
SNAP_M = 350  # jarak terjauh stasiun ke rel
BRIDGE_M = 18  # sambungan antar-rel paralel (jalur ganda jarang terhubung di OSM)
SNAP_WIDE_M = 900  # radius percobaan kedua untuk ruas yang memutar jauh
RETRY_DETOUR = 1.4  # rasio yang memicu percobaan kedua
MAX_DETOUR = 1.75  # panjang jalur / garis lurus; di atas ini dianggap gagal


def hav(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[1], a[0], b[1], b[0]))
    x = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(x))


class Rail(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.ways = []

    def way(self, w):
        kind = w.tags.get("railway")
        if kind not in ("rail", "subway", "light_rail"):
            return
        if w.tags.get("highspeed") == "yes":
            return  # Whoosh bukan bagian jaringan ini
        pts = [(n.ref, n.lon, n.lat) for n in w.nodes if n.location.valid()]
        if len(pts) >= 2:
            self.ways.append((kind, w.tags.get("service"), pts))


def read_pairs(zname):
    z = zipfile.ZipFile(DATA / zname)

    def rd(n):
        return list(csv.DictReader(io.TextIOWrapper(z.open(n), encoding="utf-8-sig")))

    stops = {s["stop_id"]: (float(s["stop_lon"]), float(s["stop_lat"]), s["stop_name"]) for s in rd("stops.txt")}
    by = collections.defaultdict(list)
    for s in rd("stop_times.txt"):
        by[s["trip_id"]].append(s)
    pairs = set()
    for ss in by.values():
        ss.sort(key=lambda x: int(x["stop_sequence"]))
        pairs |= {(a["stop_id"], b["stop_id"]) for a, b in zip(ss, ss[1:])}
    return stops, pairs


def build_graph(ways, kinds):
    coord, adj = {}, collections.defaultdict(list)
    for kind, service, pts in ways:
        if kind not in kinds:
            continue
        # Jalur langsir sedikit dimahalkan supaya jalur utama lebih disukai.
        weight = 1.5 if service in ("yard", "siding", "spur") else 1.0
        for (r1, x1, y1), (r2, x2, y2) in zip(pts, pts[1:]):
            coord[r1], coord[r2] = (x1, y1), (x2, y2)
            d = hav((x1, y1), (x2, y2))
            adj[r1].append((r2, d * weight))
            adj[r2].append((r1, d * weight))
    # Jembatan antar-rel paralel, memakai kisi.
    cell = 0.0002
    grid = collections.defaultdict(list)
    for n, (x, y) in coord.items():
        grid[(int(x / cell), int(y / cell))].append(n)
    bridges = 0
    for (cx, cy), ns in list(grid.items()):
        near = [m for dx in (-1, 0, 1) for dy in (-1, 0, 1) for m in grid.get((cx + dx, cy + dy), ())]
        for a in ns:
            for b in near:
                if a < b:
                    d = hav(coord[a], coord[b])
                    if 0 < d <= BRIDGE_M:
                        adj[a].append((b, d * 1.2))
                        adj[b].append((a, d * 1.2))
                        bridges += 1
    return coord, adj, grid, cell, bridges


def snap(pt, coord, grid, cell, snap_m=SNAP_M):
    r = int(snap_m / 111000 / cell) + 1
    cx, cy = int(pt[0] / cell), int(pt[1] / cell)
    best = []
    for dx in range(-r, r + 1):
        for dy in range(-r, r + 1):
            for n in grid.get((cx + dx, cy + dy), ()):
                d = hav(pt, coord[n])
                if d <= snap_m:
                    best.append((d, n))
    best.sort()
    # Cukup banyak kandidat: stasiun depo dikelilingi puluhan simpul rel yard,
    # padahal jalur utama sering hanya beberapa puluh meter lebih jauh.
    return best[:300] if snap_m > SNAP_M else best[:80]


def route(a, b, coord, adj, grid, cell):
    """Coba radius normal; bila memutar jauh, coba radius lebar.

    Stasiun di depo bisa berjarak >350 m dari jalur utama, sehingga radius
    normal hanya menemukan rel yard dan jalurnya memutar lewat pintu depo.
    """
    line, err = _route(a, b, coord, adj, grid, cell, SNAP_M)
    straight = hav(a[:2], b[:2])
    if line is None or _length(line) / max(straight, 1) > RETRY_DETOUR:
        wide, _ = _route(a, b, coord, adj, grid, cell, SNAP_WIDE_M)
        if wide is not None and (line is None or _length(wide) < _length(line) * 0.9):
            return wide, None
    return line, err


def _length(line):
    return sum(hav(p, q) for p, q in zip(line, line[1:]))


def _route(a, b, coord, adj, grid, cell, snap_m):
    pa, pb = a[:2], b[:2]
    sa, sb = snap(pa, coord, grid, cell, snap_m), snap(pb, coord, grid, cell, snap_m)
    if not sa or not sb:
        return None, "tak ada rel dalam %d m" % snap_m
    goal = {n: d for d, n in sb}
    limit = hav(pa, pb) * MAX_DETOUR + 2 * snap_m
    dist, prev, pq = {}, {}, []
    for d, n in sa:
        dist[n] = d * 2  # jarak ke rel dimahalkan: pilih rel yang dekat stasiun
        heapq.heappush(pq, (dist[n], n))
    best, end = math.inf, None
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist.get(u, math.inf) or d >= best or d > limit * 1.3:
            continue
        if u in goal and d + goal[u] * 2 < best:
            best, end = d + goal[u] * 2, u
        for v, w in adj[u]:
            nd = d + w
            if nd < dist.get(v, math.inf):
                dist[v], prev[v] = nd, u
                heapq.heappush(pq, (nd, v))
    if end is None:
        return None, "tak terhubung"
    path = [end]
    while path[-1] in prev:
        path.append(prev[path[-1]])
    path.reverse()
    line = [list(pa)] + [list(coord[n]) for n in path] + [list(pb)]
    ratio = _length(line) / max(hav(pa, pb), 1)
    if ratio > MAX_DETOUR and hav(pa, pb) > 400:
        return None, "memutar %.2fx" % ratio
    return line, None


def main():
    print("membaca", PBF.name, flush=True)
    h = Rail()
    h.apply_file(str(PBF), locations=True, idx="flex_mem")
    print("ruas rel:", len(h.ways), collections.Counter(w[0] for w in h.ways), flush=True)
    out = {"source": PBF.name, "segments": {}, "fallbacks": []}
    for net, cfg in NETWORKS.items():
        stops, pairs = read_pairs(cfg["zip"])
        coord, adj, grid, cell, bridges = build_graph(h.ways, cfg["railway"])
        print(f"{net}: simpul={len(coord)} jembatan={bridges} pasangan={len(pairs)}", flush=True)
        ok = 0
        for a, b in sorted(pairs):
            line, err = route(stops[a], stops[b], coord, adj, grid, cell)
            if line:
                out["segments"][f"{a}|{b}"] = line
                ok += 1
            else:
                out["fallbacks"].append(
                    {
                        "network": net,
                        "from": stops[a][2],
                        "to": stops[b][2],
                        "reason": err,
                        "straight_km": round(hav(stops[a], stops[b]) / 1000, 2),
                    }
                )
        print(f"  berhasil {ok}/{len(pairs)}", flush=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print("fallback:", json.dumps(out["fallbacks"], ensure_ascii=False))
    print("tulis", OUT, OUT.stat().st_size)


if __name__ == "__main__":
    main()
