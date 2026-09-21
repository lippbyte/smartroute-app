#!/usr/bin/env python3
"""Task 2: bangun feed GTFS MRT Jakarta fase 1 (Lebak Bulus - Bundaran HI).

Koordinat berasal dari `data/mrt_station_coords.json` (hasil
geocode_mrt_stations.py, sumber OSM Overpass per stasiun).

=============================================================================
NILAI YANG BELUM TERVERIFIKASI — lihat blok KONFIGURASI di bawah
=============================================================================
jakartamrt.co.id tidak bisa dibaca secara terprogram: seluruh halaman yang
dicoba (/id/jadwal-kereta, /id/tarif) mengembalikan kerangka JavaScript tanpa
isi. Jadi TIDAK ADA satu pun angka operasional di file ini yang berasal dari
situs resmi. Semuanya ditandai `TODO: verifikasi` beserta sumber sementaranya.

Jangan menyajikan angka-angka ini sebagai data resmi MRT Jakarta sebelum
dicek ke sumber primer.
=============================================================================
"""
import csv
import json
import math
import zipfile
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
COORDS = DATA / "mrt_station_coords.json"
OUT_ZIP = DATA / "mrt_gtfs.zip"

FEED_ID = "MRT"
AGENCY_ID = "MRTJ"
ROUTE_ID = "MRT-NS"

# ==========================================================================
# KONFIGURASI — setiap angka di bawah ini belum diverifikasi ke sumber primer
# ==========================================================================

# TODO: verifikasi — Wikipedia menyebut "under 30 minutes" untuk Lebak Bulus
# <-> Bundaran HI, tanpa angka pasti. 30 menit dipakai sebagai batas atas yang
# disebut sumber itu, BUKAN angka resmi.
END_TO_END_SECONDS = 30 * 60

# TODO: verifikasi — waktu berhenti di peron tidak disebut sumber mana pun.
# 20 detik adalah nilai lazim metro kota; murni asumsi teknis.
DWELL_SECONDS = 20

# TODO: verifikasi — jam operasional dari sumber sekunder (blog/agregator
# berita), bukan jakartamrt.co.id: kereta pertama ~05:00, terakhir ~24:00.
SERVICE_START = "05:00:00"
SERVICE_END = "24:00:00"

# TODO: verifikasi — headway 5 menit (sibuk) / 10 menit (biasa) dari infobox
# Wikipedia. Rentang jam sibuk di bawah TIDAK disebut sumber mana pun dan
# murni asumsi pola komuter Jakarta.
HEADWAY_PEAK_SECONDS = 5 * 60
HEADWAY_OFFPEAK_SECONDS = 10 * 60
PEAK_WINDOWS = [("05:00:00", "09:00:00"), ("16:00:00", "20:00:00")]

# TODO: verifikasi — akhir pekan disebut sumber sekunder "10-15 menit". Dipakai
# batas bawahnya (10 menit) supaya tidak melebih-lebihkan frekuensi.
HEADWAY_WEEKEND_SECONDS = 10 * 60

# TODO: verifikasi — tarif dari Wikipedia (bersitasi, tapi bukan situs resmi):
# minimum Rp3.000, naik Rp1.000 tiap stasiun, maksimum Rp14.000 untuk
# perjalanan penuh.
#
# Rumusnya: Rp3.000 untuk satu petak, lalu +Rp1.000 tiap petak berikutnya —
# BUKAN +Rp1.000 sejak petak pertama. Dua angka yang dipublikasikan itu yang
# menentukannya: 12 petak Lebak Bulus->Bundaran HI menghasilkan
# 3000 + 11x1000 = 14.000, tepat sama dengan tarif maksimum yang disebut,
# sementara varian satunya menghasilkan 15.000 (meleset) dan membuat tarif
# minimum jadi Rp4.000 (juga meleset). Karena mengenai kedua ujung yang
# terdokumentasi, tidak ada plafon terpisah yang perlu dipaksakan.
FARE_BASE_IDR = 3000
FARE_PER_STATION_IDR = 1000
FARE_CAP_IDR = 14000

# Rentang tanggal layanan — dibuat lebar supaya graph tidak kedaluwarsa saat
# demo. Bukan klaim soal kalender operasi MRT yang sebenarnya.
CALENDAR_START = "20260101"
CALENDAR_END = "20271231"


def haversine_m(a: dict, b: dict) -> float:
    r = 6371000.0
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dp = p2 - p1
    dl = math.radians(b["lon"] - a["lon"])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def hhmmss(seconds: int) -> str:
    return f"{seconds // 3600:02d}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}"


def to_seconds(clock: str) -> int:
    h, m, s = (int(x) for x in clock.split(":"))
    return h * 3600 + m * 60 + s


def main() -> None:
    raw = json.loads(COORDS.read_text(encoding="utf-8"))
    if raw["unresolved"]:
        raise SystemExit(f"ERROR: masih ada stasiun tanpa koordinat: {raw['unresolved']}")

    stations = sorted(raw["resolved"].items(), key=lambda kv: kv[1]["order"])
    codes = [c for c, _ in stations]
    info = {c: v for c, v in stations}
    n = len(stations)

    # Waktu antar stasiun dibagi PROPORSIONAL terhadap jarak asli antar
    # koordinat, bukan dibagi rata — segmen Lebak Bulus->Fatmawati jauh lebih
    # panjang daripada Istora->Bendungan Hilir, dan membagi rata akan membuat
    # ETA tiap stasiun meleset meski totalnya kebetulan benar.
    seg_m = [haversine_m(info[codes[i]], info[codes[i + 1]]) for i in range(n - 1)]
    total_m = sum(seg_m)
    running = END_TO_END_SECONDS - DWELL_SECONDS * (n - 2)
    seg_s = [max(30, round(running * d / total_m)) for d in seg_m]

    print(f"Total jarak jalur: {total_m/1000:.1f} km")
    print(f"Waktu jalan {running}s + berhenti {DWELL_SECONDS}s x {n-2} = {END_TO_END_SECONDS}s")

    files: dict[str, tuple[list[str], list[list]]] = {}

    files["agency"] = (
        ["agency_id", "agency_name", "agency_url", "agency_timezone", "agency_lang"],
        [[AGENCY_ID, "MRT Jakarta", "https://jakartamrt.co.id/", "Asia/Jakarta", "id"]],
    )

    files["routes"] = (
        ["route_id", "agency_id", "route_short_name", "route_long_name", "route_type",
         "route_color", "route_text_color"],
        # route_type=1 (subway/metro), sesuai instruksi task.
        [[ROUTE_ID, AGENCY_ID, "M", "Lebak Bulus - Bundaran HI", "1", "0066B3", "FFFFFF"]],
    )

    files["stops"] = (
        ["stop_id", "stop_name", "stop_lat", "stop_lon", "zone_id", "location_type"],
        [[f"{FEED_ID}-{c}", info[c]["name"], f"{info[c]['lat']:.7f}",
          f"{info[c]['lon']:.7f}", f"{FEED_ID}-{c}", "0"] for c in codes],
    )

    files["calendar"] = (
        ["service_id", "monday", "tuesday", "wednesday", "thursday", "friday",
         "saturday", "sunday", "start_date", "end_date"],
        [
            ["WEEKDAY", "1", "1", "1", "1", "1", "0", "0", CALENDAR_START, CALENDAR_END],
            ["WEEKEND", "0", "0", "0", "0", "0", "1", "1", CALENDAR_START, CALENDAR_END],
        ],
    )

    trips, stop_times, freqs = [], [], []
    for service in ("WEEKDAY", "WEEKEND"):
        for direction in (0, 1):
            trip_id = f"{FEED_ID}-{service}-{direction}"
            order = codes if direction == 0 else list(reversed(codes))
            headsign = info[order[-1]]["name"]
            trips.append([ROUTE_ID, service, trip_id, headsign, str(direction)])

            t = to_seconds(SERVICE_START)
            legs = seg_s if direction == 0 else list(reversed(seg_s))
            for i, code in enumerate(order):
                arrival = t
                departure = t if i in (0, len(order) - 1) else t + DWELL_SECONDS
                stop_times.append(
                    [trip_id, hhmmss(arrival), hhmmss(departure),
                     f"{FEED_ID}-{code}", str(i + 1)]
                )
                if i < len(legs):
                    t = departure + legs[i]

            if service == "WEEKDAY":
                # Jendela sibuk dan sisanya, tanpa tumpang tindih.
                cursor = to_seconds(SERVICE_START)
                for start, end in PEAK_WINDOWS:
                    if cursor < to_seconds(start):
                        freqs.append([trip_id, hhmmss(cursor), start,
                                      str(HEADWAY_OFFPEAK_SECONDS), "0"])
                    freqs.append([trip_id, start, end, str(HEADWAY_PEAK_SECONDS), "0"])
                    cursor = to_seconds(end)
                if cursor < to_seconds(SERVICE_END):
                    freqs.append([trip_id, hhmmss(cursor), SERVICE_END,
                                  str(HEADWAY_OFFPEAK_SECONDS), "0"])
            else:
                freqs.append([trip_id, SERVICE_START, SERVICE_END,
                              str(HEADWAY_WEEKEND_SECONDS), "0"])

    files["trips"] = (
        ["route_id", "service_id", "trip_id", "trip_headsign", "direction_id"], trips)
    files["stop_times"] = (
        ["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"], stop_times)
    files["frequencies"] = (
        ["trip_id", "start_time", "end_time", "headway_secs", "exact_times"], freqs)

    # Tarif berbasis jarak: satu fare_attributes per tingkat harga, lalu satu
    # fare_rules per pasangan asal-tujuan (pola yang sama dengan feed KRL).
    prices = sorted({
        min(FARE_BASE_IDR + FARE_PER_STATION_IDR * (abs(i - j) - 1), FARE_CAP_IDR)
        for i in range(n) for j in range(n) if i != j
    })
    files["fare_attributes"] = (
        ["fare_id", "price", "currency_type", "payment_method", "transfers", "agency_id"],
        [[f"{FEED_ID}-{p}", str(p), "IDR", "1", "0", AGENCY_ID] for p in prices],
    )
    rules = []
    for i, a in enumerate(codes):
        for j, b in enumerate(codes):
            if i == j:
                continue
            price = min(FARE_BASE_IDR + FARE_PER_STATION_IDR * (abs(i - j) - 1), FARE_CAP_IDR)
            rules.append([f"{FEED_ID}-{price}", ROUTE_ID, f"{FEED_ID}-{a}", f"{FEED_ID}-{b}"])
    files["fare_rules"] = (["fare_id", "route_id", "origin_id", "destination_id"], rules)

    OUT_ZIP.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, (header, rows) in files.items():
            buf: list[str] = []

            class _Sink:
                def write(self, s):
                    buf.append(s)

            w = csv.writer(_Sink(), lineterminator="\n")
            w.writerow(header)
            w.writerows(rows)
            zf.writestr(f"{name}.txt", "".join(buf))
            print(f"  {name+'.txt':<22}{len(rows):>6} baris")

    print(f"\nDitulis: {OUT_ZIP}")
    print(f"Tarif: Rp{prices[0]:,} - Rp{prices[-1]:,} ({len(prices)} tingkat)".replace(",", "."))


if __name__ == "__main__":
    main()
