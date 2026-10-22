#!/usr/bin/env python3
"""Task 2: bangun feed GTFS MRT Jakarta fase 1 (Lebak Bulus - Bundaran HI).

Koordinat berasal dari `data/mrt_station_coords.json` (hasil
geocode_mrt_stations.py, sumber OSM Overpass per stasiun).

JADWAL — dari sumber resmi (21 Sep 2026):
jakartamrt.co.id adalah aplikasi React; datanya diambil dari API CMS yang
dipanggil situs itu sendiri (lihat data/mrt_source/FETCHED_AT.txt). Tiap
stasiun memuat daftar jam keberangkatan PER ARAH ("End" = menuju Bundaran HI,
"Start" = menuju Lebak Bulus — terbukti dari stasiun ujung: Lebak Bulus hanya
punya daftar "End", Bundaran HI hanya "Start") dan PER JENIS HARI (weekdays /
weekends = "Jadwal Hari Biasa" / "Jadwal Hari Libur" di situs), presisi
detik. Trip dirangkai dari jam-jam itu (lihat build_official_trips); tidak
ada headway atau waktu tempuh yang dikarang.

TODO: verifikasi (turunan, bukan dari tabel resmi):
  - Jam TIBA di stasiun ujung tidak ada di daftar mana pun (daftarnya hanya
    keberangkatan): diisi dari median waktu tempuh ruas yang sama di arah
    sebaliknya. Kereta yang berhenti di tengah jalur (tidak muncul lagi di
    stasiun berikutnya) diberi jam tiba dari median ruas searah.
  - "Hari Libur" dipetakan ke Sabtu+Minggu; tanggal libur nasional belum ada
    di calendar_dates.txt.

TARIF — dari sumber resmi (22 Sep 2026): tabel data/mrt_source/tarif_resmi.json,
diambil fetch_mrt_official_fares.py dari endpoint halaman "Rencana Perjalanan"
jakartamrt.co.id. 154/156 pasangan resmi; simetris; tidak bergantung jam.
TODO: verifikasi — Blok A <-> Senayan tidak punya data di situs resmi, jadi
masih dari rumus di bawah (yang terbukti meleset Rp1.000 di 74 dari 154
pasangan resmi — perlakukan angkanya sebagai perkiraan).
"""
import csv
import json
import math
import zipfile
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
COORDS = DATA / "mrt_station_coords.json"
OUT_ZIP = DATA / "mrt_gtfs.zip"
FARE_OVERRIDES = DATA / "mrt_fare_overrides.json"
# Tabel tarif yang dibaca backend saat runtime (services/mrtFares.ts). Ditulis
# dari fare_rules yang SAMA dengan feed, jadi feed dan backend tidak mungkin
# berbeda pendapat soal tarif — termasuk override.
BACKEND_FARES = DATA.parent.parent / "backend-skeleton" / "src" / "data" / "mrtFares.json"

FEED_ID = "MRT"
AGENCY_ID = "MRTJ"
ROUTE_ID = "MRT-NS"

# Snapshot respons API jadwal resmi (lihat docstring).
OFFICIAL_STATIONS = DATA / "mrt_source" / "stasiun.json"
# Tabel tarif resmi, hasil fetch_mrt_official_fares.py.
OFFICIAL_FARES = DATA / "mrt_source" / "tarif_resmi.json"

# Batas waktu tempuh satu ruas saat merangkai trip. Ruas terpanjang di data
# resmi ~3,5 menit, jarak antar-kereta paling rapat ~4,5 menit — jadi "jam
# berikutnya di stasiun selanjutnya, maksimal 6 menit" tidak ambigu. Kalau
# data berubah dan rangkaian mulai meleset, build_official_trips berhenti
# dengan error, bukan diam-diam menghasilkan trip keliru.
MAX_SEGMENT_SECONDS = 6 * 60

# ==========================================================================
# RUMUS TARIF CADANGAN — hanya untuk pasangan tanpa data resmi
# ==========================================================================
# Dibandingkan dengan tabel resmi (22 Sep 2026), rumus ini benar di 80 dan
# meleset Rp1.000 di 74 dari 154 pasangan: tarif resmi berbasis JARAK (ruas
# panjang seperti Lebak Bulus-Fatmawati lebih mahal, ruas pendek di pusat
# kota lebih murah), bukan jumlah stasiun. Dipertahankan hanya sebagai
# cadangan untuk Blok A <-> Senayan. Catatan asal rumusnya di bawah.
#
# Semula: tarif dari Wikipedia (bersitasi, tapi bukan situs resmi):
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


def load_official_lists(codes: list[str]) -> dict:
    """{(service, arah): {kode_stasiun: [detik, ...]}} dari snapshot API resmi.
    arah 0 = menuju Bundaran HI ("End"), 1 = menuju Lebak Bulus ("Start")."""
    data = json.loads(OFFICIAL_STATIONS.read_text(encoding="utf-8"))["data"]
    rows = sorted(data, key=lambda d: d["index"])
    if len(rows) != len(codes):
        raise SystemExit(f"ERROR: API resmi punya {len(rows)} stasiun, feed {len(codes)} — cek ulang")
    lists = {}
    for code, row in zip(codes, rows):
        sched = row["object"]["schedule"]
        for service, prefix in (("WEEKDAY", "weekdays"), ("WEEKEND", "weekends")):
            for direction, suffix in ((0, "End"), (1, "Start")):
                raw = sched.get(prefix + suffix) or ""
                times = sorted(to_seconds(t.strip()) for t in raw.split(";") if t.strip())
                lists.setdefault((service, direction), {})[code] = times
    return lists


def chain_official_trips(order: list[str], lists: dict) -> tuple[list, dict, dict]:
    """Rangkai trip dari daftar keberangkatan per stasiun (satu arah).

    Tiap jam di stasiun k disambung ke jam paling awal di stasiun k+1 yang
    lebih besar, maksimal MAX_SEGMENT_SECONDS — tidak ambigu karena ruas
    lebih pendek dari jarak antar-kereta. Jam yang tidak tersambung dari
    stasiun sebelumnya = kereta yang MULAI di stasiun itu (mis. Blok M
    05:00:00). Kereta yang tidak muncul di stasiun berikutnya = berhenti di
    sana; jam tibanya diturunkan (lihat TODO di docstring).
    """
    pools = {c: list(lists.get(c, [])) for c in order}
    finished, active = [], []
    stats = {"tersambung": 0, "mulai_di_tengah": 0, "tiba_diturunkan": 0}
    seg_runs: dict[tuple[str, str], list[int]] = {}

    for k, code in enumerate(order):
        if k > 0:
            prev = order[k - 1]
            still = []
            for trip in sorted(active, key=lambda t: t[-1][1]):
                t = trip[-1][1]
                nxt = next((x for x in pools[code] if x > t), None)
                if nxt is not None and nxt - t <= MAX_SEGMENT_SECONDS:
                    pools[code].remove(nxt)
                    trip.append((code, nxt))
                    seg_runs.setdefault((prev, code), []).append(nxt - t)
                    stats["tersambung"] += 1
                    still.append(trip)
                else:
                    finished.append(trip)
            active = still
        # Jam yang tersisa di stasiun ini = kereta yang mulai dari sini.
        for t in pools[code]:
            active.append([(code, t)])
            if k > 0:
                stats["mulai_di_tengah"] += 1
        pools[code] = []
    finished.extend(active)
    median = {seg: sorted(v)[len(v) // 2] for seg, v in seg_runs.items()}
    return finished, median, stats


def finish_official_trips(order: list[str], finished: list, median: dict,
                          reverse_median: dict, stats: dict) -> tuple[list, dict]:
    """Tambahkan jam tiba untuk kereta yang berhenti sebelum stasiun
    berikutnya (termasuk stasiun ujung, yang tidak punya daftar keberangkatan
    di arah ini)."""
    trips = []
    for trip in finished:
        last_code = trip[-1][0]
        k = order.index(last_code)
        if k < len(order) - 1:
            nxt = order[k + 1]
            # Ruas searah teramati kalau stasiun berikutnya punya daftar di
            # arah ini; kalau tidak (stasiun ujung), pakai arah sebaliknya.
            run = median.get((last_code, nxt)) or reverse_median.get((nxt, last_code))
            if run is None:
                raise SystemExit(f"ERROR: tidak ada waktu tempuh untuk {last_code}->{nxt}")
            trip.append((nxt, trip[-1][1] + run))
            stats["tiba_diturunkan"] += 1
        if len(trip) >= 2:
            trips.append(trip)
    stats["trip"] = len(trips)
    return trips, {**stats, "median_ruas": median}


def main() -> None:
    raw = json.loads(COORDS.read_text(encoding="utf-8"))
    if raw["unresolved"]:
        raise SystemExit(f"ERROR: masih ada stasiun tanpa koordinat: {raw['unresolved']}")

    stations = sorted(raw["resolved"].items(), key=lambda kv: kv[1]["order"])
    codes = [c for c, _ in stations]
    info = {c: v for c, v in stations}
    n = len(stations)

    seg_m = [haversine_m(info[codes[i]], info[codes[i + 1]]) for i in range(n - 1)]
    print(f"Total jarak jalur: {sum(seg_m)/1000:.1f} km")

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

    # Jadwal resmi: rangkai dulu kedua arah (jam tiba di ujung satu arah butuh
    # waktu tempuh arah sebaliknya), baru lengkapi.
    lists = load_official_lists(codes)
    trips, stop_times = [], []
    for service in ("WEEKDAY", "WEEKEND"):
        chained = {}
        for direction in (0, 1):
            order = codes if direction == 0 else list(reversed(codes))
            chained[direction] = (order, *chain_official_trips(order, lists[(service, direction)]))
        for direction in (0, 1):
            order, finished, median, stats = chained[direction]
            reverse_median = chained[1 - direction][2]
            official, stats = finish_official_trips(order, finished, median, reverse_median, stats)
            total_listed = sum(len(v) for v in lists[(service, direction)].values())
            used = sum(len(t) for t in official) - stats["tiba_diturunkan"]
            if used != total_listed:
                raise SystemExit(f"ERROR {service} arah {direction}: {total_listed} jam resmi, "
                                 f"{used} terpakai — rangkaian meleset")
            print(f"  {service} arah {'Bundaran HI' if direction == 0 else 'Lebak Bulus'}: "
                  f"{stats['trip']} trip, {used}/{total_listed} jam resmi terpakai, "
                  f"{stats['mulai_di_tengah']} mulai di tengah, "
                  f"{stats['tiba_diturunkan']} jam tiba diturunkan")
            for k, trip in enumerate(sorted(official, key=lambda t: t[0][1])):
                trip_id = f"{FEED_ID}-{service}-{direction}-{k:03d}"
                headsign = info[trip[-1][0]]["name"]
                trips.append([ROUTE_ID, service, trip_id, headsign, str(direction)])
                for seq, (code, t) in enumerate(trip, start=1):
                    stop_times.append([trip_id, hhmmss(t), hhmmss(t), f"{FEED_ID}-{code}", str(seq)])

    files["trips"] = (
        ["route_id", "service_id", "trip_id", "trip_headsign", "direction_id"], trips)
    files["stop_times"] = (
        ["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"], stop_times)

    # Tarif berbasis jarak: satu fare_attributes per tingkat harga, lalu satu
    # fare_rules per pasangan asal-tujuan (pola yang sama dengan feed KRL).
    #
    # Tabel override (hasil verifikasi manual di aplikasi MRT-J) MENIMPA rumus
    # untuk pasangan yang terdaftar. Rumus di atas cuma dugaan dari dua angka
    # yang dipublikasikan; begitu ada angka yang benar-benar dilihat orang di
    # aplikasi resmi, angka itu yang menang.
    overrides_raw = {}
    if FARE_OVERRIDES.exists():
        overrides_raw = json.loads(FARE_OVERRIDES.read_text(encoding="utf-8")).get("tarif", {})
    overrides = {}
    for key, value in overrides_raw.items():
        a, _, b = key.partition("-")
        if a not in info or b not in info:
            raise SystemExit(f"ERROR: override '{key}' memakai kode stasiun tak dikenal")
        overrides[(a, b)] = int(value)

    # Tabel tarif RESMI (fetch_mrt_official_fares.py, API halaman Rencana
    # Perjalanan jakartamrt.co.id) menang atas rumus. Urutan: override manual,
    # tabel resmi arah yang sama, tabel resmi arah balik, baru rumus.
    official = {}
    if OFFICIAL_FARES.exists():
        for key, value in json.loads(OFFICIAL_FARES.read_text(encoding="utf-8"))["tarif"].items():
            a, _, b = key.partition("-")
            official[(a, b)] = int(value)
    from_formula: set[str] = set()

    def fare_for(a: str, b: str, i: int, j: int) -> int:
        for table in (overrides, official):
            if (a, b) in table:
                return table[(a, b)]
            if (b, a) in table:
                return table[(b, a)]
        from_formula.add(f"{a}-{b}")
        return min(FARE_BASE_IDR + FARE_PER_STATION_IDR * (abs(i - j) - 1), FARE_CAP_IDR)

    prices = sorted({
        fare_for(a, b, i, j)
        for i, a in enumerate(codes) for j, b in enumerate(codes) if i != j
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
            price = fare_for(a, b, i, j)
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

    price_of = {f"{FEED_ID}-{p}": p for p in prices}
    backend_fares = {
        f"{origin}|{dest}": price_of[fare_id] for fare_id, _, origin, dest in rules
    }
    BACKEND_FARES.write_text(
        json.dumps(
            {
                "_sumber": "Di-generate oleh otp2-krl-experiment/scripts/build_mrt_gtfs.py "
                           "dari fare_rules mrt_gtfs.zip. Jangan diedit manual — ubah "
                           "rumus atau mrt_fare_overrides.json lalu jalankan ulang script itu.",
                "_status": (
                    f"Terverifikasi: {len(rules) - len(from_formula)}/{len(rules)} pasangan dari "
                    "tabel resmi jakartamrt.co.id (data/mrt_source/tarif_resmi.json). "
                    + (f"TODO: verifikasi — {len(from_formula)} pasangan masih dari rumus "
                       f"(tidak ada data resmi): {', '.join(sorted(from_formula))}"
                       if from_formula else "Tidak ada pasangan dari rumus.")
                ),
                "fares": backend_fares,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"Tabel tarif backend: {BACKEND_FARES} ({len(backend_fares)} pasangan)")
    print(f"Sumber tarif: {len(rules) - len(from_formula)} pasangan resmi, "
          f"{len(from_formula)} dari rumus{': ' + ', '.join(sorted(from_formula)) if from_formula else ''}")

    if overrides:
        meleset = []
        for (a, b), harga in overrides.items():
            i, j = codes.index(a), codes.index(b)
            rumus = min(FARE_BASE_IDR + FARE_PER_STATION_IDR * (abs(i - j) - 1), FARE_CAP_IDR)
            if rumus != harga:
                meleset.append((a, b, rumus, harga))
        print(f"Override terpakai: {len(overrides)} pasangan, {len(meleset)} berbeda dari rumus")
        for a, b, rumus, harga in meleset:
            print(f"  {a}-{b}: rumus Rp{rumus:,} -> terverifikasi Rp{harga:,}".replace(",", "."))
        if len(meleset) > len(overrides) / 2:
            print(
                "  CATATAN: lebih dari separuh pasangan yang diverifikasi meleset dari\n"
                "  rumus. Itu tanda rumusnya sendiri salah — perbaiki rumusnya, jangan\n"
                "  terus menambal pasangan satu per satu."
            )
    else:
        print("Override tarif manual: tidak ada (tarif dari tabel resmi, sisanya rumus — lihat di atas)")


if __name__ == "__main__":
    main()
