#!/usr/bin/env python3
"""Task 2: ambil koordinat 13 stasiun MRT Jakarta fase 1 dari OSM Overpass.

Cara yang sama seperti geocode_krl_stations.py: cocokkan pada kunci
TERSTRUKTUR lebih dulu (di sini `railway:ref`, kode resmi stasiun), bukan pada
teks nama. Nama di OSM memuat hak penamaan sponsor ("Blok M BCA", "Bundaran HI
Bank Jakarta") yang berubah tiap kontrak sponsor berganti — mencocokkan nama
akan rapuh, kode `railway:ref` tidak.

Stasiun yang tidak ketemu DILAPORKAN, tidak ditebak: koordinat salah diam-diam
menghasilkan transfer jalan kaki yang salah di OTP2.

Menulis `data/mrt_station_coords.json`.
"""
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

OUTPUT = Path(__file__).resolve().parent.parent / "data" / "mrt_station_coords.json"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "smartroute-mrt-geocode/1.0"

# Kotak yang melingkupi koridor fase 1 saja (Lebak Bulus - Bundaran HI).
BBOX = (-6.33, 106.73, -6.16, 106.86)

# Kode resmi (railway:ref di OSM) -> nama kanonik yang dipakai di GTFS kita,
# URUT dari selatan ke utara mengikuti arah jalur. Fase 2 (lanjutan ke Kota)
# sengaja TIDAK dimasukkan karena belum beroperasi.
STATIONS = [
    ("LBB", "Lebak Bulus"),
    ("FTM", "Fatmawati"),
    ("CPR", "Cipete Raya"),
    ("HJN", "Haji Nawi"),
    ("BLA", "Blok A"),
    ("BLM", "Blok M"),
    ("SSM", "ASEAN"),
    ("SNY", "Senayan"),
    ("IST", "Istora"),
    ("BNH", "Bendungan Hilir"),
    ("STB", "Setiabudi"),
    ("DKA", "Dukuh Atas"),
    ("BHI", "Bundaran HI"),
]


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
        except Exception as err:  # Overpass sering rate-limit; mundur teratur.
            print(f"  percobaan overpass {attempt}/{attempts} gagal: {err}")
            if attempt == attempts:
                raise
            time.sleep(10 * attempt)


def main() -> None:
    south, west, north, east = BBOX
    box = f"{south},{west},{north},{east}"
    query = (
        f"[out:json][timeout:180];"
        f'(node["railway"="station"]["station"="subway"]({box});'
        f'way["railway"="station"]["station"="subway"]({box}););'
        f"out center tags;"
    )
    print(f"Overpass: railway=station + station=subway di bbox {box} ...")
    data = overpass(query)

    by_ref = {}
    for el in data["elements"]:
        tags = el.get("tags", {})
        ref = (tags.get("railway:ref") or "").strip().upper()
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        if not ref or lat is None or lon is None:
            continue
        # Node stasiun lebih tepat daripada way (pusat bounding box gedung).
        rank = 0 if el["type"] == "node" else 1
        if ref not in by_ref or rank < by_ref[ref]["rank"]:
            by_ref[ref] = {
                "lat": lat,
                "lon": lon,
                "osm_name": tags.get("name", ""),
                "operator": tags.get("operator", ""),
                "rank": rank,
            }
    print(f"  {len(by_ref)} fitur OSM membawa railway:ref\n")

    resolved, unresolved = {}, []
    for order, (code, name) in enumerate(STATIONS, start=1):
        hit = by_ref.get(code)
        if not hit:
            unresolved.append((code, name))
            continue
        if not (south <= hit["lat"] <= north and west <= hit["lon"] <= east):
            unresolved.append((code, name))
            print(f"  {code}: koordinat di luar bbox, ditolak")
            continue
        resolved[code] = {
            "name": name,
            "order": order,
            "lat": hit["lat"],
            "lon": hit["lon"],
            "source": f"overpass:railway:ref={code}",
            "osm_name": hit["osm_name"],
            "operator": hit["operator"],
        }
        print(f"  {code} {name:<18} {hit['lat']},{hit['lon']}  (OSM: {hit['osm_name']})")

    print(f"\nTerpetakan {len(resolved)}/{len(STATIONS)} stasiun.")
    if unresolved:
        print("TIDAK KETEMU — dilaporkan, tidak ditebak:")
        for code, name in unresolved:
            print(f"  {code}: {name}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(
            {"resolved": resolved, "unresolved": [c for c, _ in unresolved]},
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"\nDitulis: {OUTPUT}")
    raise SystemExit(1 if unresolved else 0)


if __name__ == "__main__":
    main()
