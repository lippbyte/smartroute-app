#!/usr/bin/env python3
"""Task 4 (Label Antarmoda + LRT): GTFS LRT Jabodebek dari sumber resmi + OSM.

Sumber (snapshot disimpan di data/lrt_source/, lihat FETCHED_AT.txt):
  - Jadwal: lrtjabodebek.kai.id/jadwal-keberangkatan — per stasiun, daftar
    jam keberangkatan "Hari Biasa" dan "Hari Libur".
  - Tarif:  lrtjabodebek.kai.id/informasi-tarif — tiga matriks 18x18 per
    pasangan stasiun (luar jam sibuk, jam sibuk, Sabtu/Minggu/libur).
  - Koordinat & urutan stasiun: relasi route OSM network "Jabodebek LRT"
    (ekstrak Geofabrik 2026-09-03), node public_transport=stop_position.

Daftar stasiun kedua sumber cocok 18/18 (hanya beda ejaan, lihat
OFFICIAL_NAME). Nama yang dipakai: nama resmi operator.

REKONSTRUKSI TRIP — kenapa perlu dan bagaimana:
Tabel resmi per stasiun adalah daftar jam gabungan: tanpa lin, tanpa arah.
Jadwalnya sangat periodik (tiap lin ~8 menit), jadi mencari waktu tempuh
dari histogram selisih jam TIDAK bisa dipakai: offset yang beda satu periode
sama-sama "cocok" (sudah dicoba, hasilnya waktu tempuh ruas yang sama beda
per lin — mustahil secara fisik). Yang tidak ambigu hanya awal hari:
  1. Profil waktu tempuh diambil dari kereta PERTAMA tiap lin/arah — saat
     itu belum ada kereta lain di jalur. Untuk Bekasi arah masuk dicek
     bahwa kereta itu memang yang paling awal di setiap stasiun.
  2. Jam mulai trip arah masuk = daftar resmi stasiun ujung (Harjamukti /
     Jati Mulya — hanya satu lin & satu arah yang berangkat dari sana).
     Arah keluar = daftar Dukuh Atas BNI; lin-nya ditentukan dari cocoknya
     prediksi di SEMUA stasiun cabang, bukan satu stasiun.
  3. Tiap jam prediksi dicocokkan ke tabel resmi (+-1 menit, pembulatan
     tabel) dan jam yang cocok dipakai apa adanya. Tingkat kecocokan
     dicetak dan disimpan di data/lrt_build_report.json.
Hasil terakhir: hari libur 270/270 trip, 100% jam prediksi ada di tabel;
hari biasa 425/430 trip, 97,6%.

TODO: verifikasi (nilai turunan, BUKAN dari sumber resmi):
  - Jam TIBA di stasiun akhir (Dukuh Atas BNI arah masuk, Harjamukti /
    Jati Mulya arah keluar) tidak ada di tabel mana pun — tabel hanya
    memuat keberangkatan. Diisi dari waktu tempuh ruas yang sama di arah
    sebaliknya.
  - Hari biasa: 115 jam prediksi (2,4%) tidak ada di tabel dan 5 trip
    dibuang; sisa jam tabel tak terpakai terpusat di Kuningan jam sibuk.
    Kemungkinan waktu henti jam sibuk berbeda — belum dikonfirmasi.
  - "Hari Libur" dipetakan ke Sabtu+Minggu saja; tanggal libur nasional
    belum dimasukkan ke calendar_dates.txt.
  - Nama stasiun mengikuti operator ("Dukuh Atas BNI"); OSM (2026-09-03)
    menamainya "Dukuh Atas Bank Syariah Indonesia". Mana yang terkini di
    lapangan belum dipastikan.
"""
import json
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DATA = SCRIPT_DIR.parent / "data"
SRC = DATA / "lrt_source"
OUT_ZIP = DATA / "lrt_gtfs.zip"
FARE_OUT = SCRIPT_DIR.parent.parent / "backend-skeleton" / "src" / "data" / "lrtFares.json"
TOLERANCE = 1  # menit

# slug halaman jadwal -> (stop_id, nama resmi, nama di OSM)
STATIONS = {
    "dukuh-atas-bni": ("LRT_DKA", "Dukuh Atas BNI", "Dukuh Atas Bank Syariah Indonesia"),
    "setiabudi": ("LRT_SET", "Setiabudi", "Setiabudi"),
    "rasuna-said": ("LRT_RSD", "Rasuna Said", "Rasuna Said"),
    "kuningan": ("LRT_KNG", "Kuningan", "Kuningan"),
    "pancoran-bank-bjb": ("LRT_PCR", "Pancoran bank bjb", "Pancoran"),
    "cikoko": ("LRT_CKK", "Cikoko", "Cikoko"),
    "ciliwung": ("LRT_CLW", "Ciliwung", "Ciliwung"),
    "cawang": ("LRT_CWG", "Cawang", "Cawang"),
    "taman-mini": ("LRT_TMI", "Taman Mini", "Taman Mini"),
    "kampung-rambutan": ("LRT_KPR", "Kampung Rambutan", "Kampung Rambutan"),
    "ciracas": ("LRT_CRC", "Ciracas", "Ciracas"),
    "harjamukti": ("LRT_HJM", "Harjamukti", "Harjamukti"),
    "halim": ("LRT_HLM", "Halim", "Halim"),
    "jati-bening-baru": ("LRT_JBB", "Jati Bening Baru", "Jatibening Baru"),
    "cikunir-1": ("LRT_CK1", "Cikunir 1", "Cikunir 1"),
    "cikunir-2": ("LRT_CK2", "Cikunir 2", "Cikunir 2"),
    "bekasi-barat": ("LRT_BKB", "Bekasi Barat", "Bekasi Barat"),
    "jati-mulya": ("LRT_JTM", "Jati Mulya", "Jatimulya"),
}
# Nama di tabel tarif resmi -> slug
FARE_NAME = {v[1]: k for k, v in STATIONS.items()}

TRUNK = ["dukuh-atas-bni", "setiabudi", "rasuna-said", "kuningan",
         "pancoran-bank-bjb", "cikoko", "ciliwung", "cawang"]
BRANCH = {
    "CIBUBUR": ["taman-mini", "kampung-rambutan", "ciracas", "harjamukti"],
    "BEKASI": ["halim", "jati-bening-baru", "cikunir-1", "cikunir-2", "bekasi-barat", "jati-mulya"],
}
# Warna dari tag colour relasi OSM (route_master).
LINES = {
    "CIBUBUR": ("LRT_CBB", "Cibubur Line", "Dukuh Atas BNI - Harjamukti", "20409A"),
    "BEKASI": ("LRT_BKS", "Bekasi Line", "Dukuh Atas BNI - Jati Mulya", "0E6938"),
}
DAYS = {"Hari Biasa": "WEEKDAY", "Hari Libur": "WEEKEND"}


def to_min(hhmm):
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def fmt(minutes):
    return f"{minutes // 60:02d}:{minutes % 60:02d}:00"


def parse_schedule():
    h = (SRC / "jadwal-keberangkatan.html").read_text(encoding="utf-8")
    panes = [(m.start(), m.group(1)) for m in re.finditer(r'id="pills-([a-z0-9-]+)"\s+role="tabpanel"', h)]
    out = {}
    for i, (pos, slug) in enumerate(panes):
        seg = h[pos: panes[i + 1][0] if i + 1 < len(panes) else len(h)]
        secs = {}
        for m in re.finditer(r"Jam Keberangkatan (Hari Biasa|Hari Libur)", seg):
            rest = seg[m.end():]
            nxt = re.search(r"Jam Keberangkatan (Hari Biasa|Hari Libur)", rest)
            body = rest[: nxt.start()] if nxt else rest
            # Multiplisitas dipertahankan: dua kereta beda arah bisa berangkat
            # di menit yang sama dari stasiun tengah.
            secs[m.group(1)] = sorted(to_min(t) for t in re.findall(r">\s*(\d{2}:\d{2})\s*<", body))
        out[slug] = secs
    missing = set(STATIONS) - set(out)
    if missing:
        sys.exit(f"Stasiun hilang dari halaman jadwal: {missing} — struktur situs berubah?")
    return out


def take_nearest(pool, target):
    """Ambil jam di pool yang paling dekat ke target (toleransi +-TOLERANCE,
    karena tabel dibulatkan ke menit); jam yang diambil dikeluarkan dari pool
    supaya tidak bisa dipakai dua trip."""
    best = None
    for i, b in enumerate(pool):
        if abs(b - target) <= TOLERANCE and (best is None or abs(b - target) < abs(pool[best] - target)):
            best = i
    return pool.pop(best) if best is not None else None


def cumulative(seq, runs):
    out, acc = [0], 0
    for a, b in zip(seq, seq[1:]):
        acc += runs[(a, b)]
        out.append(acc)
    return out


def predict_and_match(starts, seq, offsets, pools, stats, min_hit=0.8):
    """Satu trip = jam mulai + profil offset kumulatif (kereta tanpa masinis,
    waktu tempuh tetap). Tiap jam prediksi dicocokkan ke tabel resmi (+-1
    menit); jam yang cocok dipakai apa adanya dan dikeluarkan dari pool.
    Trip dengan kecocokan < min_hit dibuang dan dilaporkan."""
    trips = []
    for start in starts:
        times, hits = [start], 0
        for i, s in enumerate(seq[1:], start=1):
            # Anchor ke jam aktual stasiun sebelumnya, bukan ke jam mulai:
            # tabel dibulatkan ke menit, jadi profil dari satu kereta bisa
            # meleset +-1 di tiap ruas — kalau dijumlahkan dari jam mulai,
            # meleset itu menumpuk sampai ujung rute.
            target = times[-1] + offsets[i] - offsets[i - 1]
            got = take_nearest(pools[s], target)
            if got is None:
                stats["jam prediksi tak ada di tabel"] += 1
                times.append(target)
            else:
                hits += 1
                stats["cocok tepat" if got == target else "cocok +-1"] += 1
                times.append(got)
        rate = hits / max(1, len(seq) - 1)
        if rate < min_hit:
            stats["trip dibuang (kecocokan < 80%)"] += 1
            continue
        # Jam tidak boleh mundur di dalam satu trip.
        for i in range(1, len(times)):
            times[i] = max(times[i], times[i - 1])
        trips.append(dict(times=times, stops=list(seq), alive=True))
    return trips


def first_train_runs(pools, seq, start=None):
    """Waktu tempuh per ruas dari kereta PERTAMA yang lewat `seq`: di tiap
    stasiun ambil jam tersisa paling awal setelah jam di stasiun sebelumnya.
    Tidak ambigu hanya kalau belum ada kereta lain di ruas itu — pemanggil
    wajib memastikan jam yang bukan milik rantai ini sudah dikeluarkan."""
    t = start if start is not None else pools[seq[0]][0]
    runs = {}
    for a, b in zip(seq, seq[1:]):
        nxt = min((x for x in pools[b] if x > t), default=None)
        if nxt is None:
            sys.exit(f"Rantai kereta pertama putus di {a}->{b}")
        runs[(a, b)] = nxt - t
        t = nxt
    return runs


def chain(trips, seq, runs, pools, stats):
    """Perpanjang tiap trip di sepanjang seq memakai waktu tempuh `runs`,
    diurutkan per waktu supaya trip awal tidak dicuri jamnya oleh trip akhir."""
    for a, b in zip(seq, seq[1:]):
        for t in sorted((t for t in trips if t["alive"]), key=lambda t: t["times"][-1]):
            target = t["times"][-1] + runs[(a, b)]
            got = take_nearest(pools[b], target)
            if got is None:
                t["alive"] = False
                stats[f"gagal {a}->{b}"] += 1
                continue
            stats["tepat" if got == target else "meleset1"] += 1
            t["times"].append(got)
            t["stops"].append(b)


def build_day(sched, day):
    pools = {s: list(sched[s][day]) for s in STATIONS}
    stats, runs, trips = Counter(), {}, []
    inbound = {l: list(reversed(br)) + list(reversed(TRUNK[1:])) for l, br in BRANCH.items()}

    # 1) Bekasi arah masuk. Kereta Bekasi pertama adalah kereta paling awal
    #    di SEMUA stasiun yang dilewatinya (Jati Mulya berangkat paling pagi)
    #    — dicek, bukan diasumsikan. Profil waktu tempuhnya lalu diuji ke
    #    seluruh trip lewat tingkat kecocokan.
    seq = inbound["BEKASI"]
    runs.update(first_train_runs(pools, seq))
    t = pools[seq[0]][0]
    for a, b in zip(seq, seq[1:]):
        t += runs[(a, b)]
        if pools[b][0] != t:
            sys.exit(f"{day}: kereta Bekasi pertama bukan yang paling awal di {b} — metode tidak berlaku")
    starts, pools[seq[0]] = pools[seq[0]], []
    for tr in predict_and_match(starts, seq, cumulative(seq, runs), pools, stats):
        trips.append(dict(tr, line="BEKASI", dir=1))

    # 2) Cibubur arah masuk. Cabangnya hanya dilayani Cibubur; di jalur
    #    bersama jam milik Bekasi sudah dikeluarkan, jadi kereta Cibubur
    #    pertama kembali tidak ambigu.
    seq = inbound["CIBUBUR"]
    cib = first_train_runs(pools, seq)
    for k, v in cib.items():
        if k in runs and abs(runs[k] - v) > TOLERANCE:
            stats[f"beda waktu tempuh {k[0]}->{k[1]}: Bekasi {runs[k]} vs Cibubur {v}"] += 1
    starts, pools[seq[0]] = pools[seq[0]], []
    for tr in predict_and_match(starts, seq, cumulative(seq, cib), pools, stats):
        trips.append(dict(tr, line="CIBUBUR", dir=1))
    runs.update({k: v for k, v in cib.items() if k not in runs})

    # 3) Arah keluar. Jam arah masuk sudah dikeluarkan, jadi pool tinggal
    #    arah keluar: kereta keluar pertama tidak ambigu di jalur bersama.
    out_trunk = first_train_runs(pools, TRUNK)
    runs.update(out_trunk)
    out_branch = {}
    for line, br in BRANCH.items():
        # Ruas Cawang -> stasiun cabang pertama: jadwal periodik membuat
        # beberapa kandidat sama-sama "cocok" (beda satu periode), jadi
        # dipilih kandidat terdekat ke waktu tempuh arah sebaliknya yang
        # sudah terverifikasi, lalu diuji lewat tingkat kecocokan.
        back = runs[(br[0], "cawang")]
        c_off = cumulative(TRUNK, out_trunk)[-1]
        best = None
        for v in range(max(1, back - 2), back + 3):
            n = sum(1 for d0 in pools[TRUNK[0]]
                    if any(abs(x - (d0 + c_off + v)) <= TOLERANCE for x in pools[br[0]]))
            if best is None or n > best[1]:
                best = (v, n)
        out_branch[("cawang", br[0])] = best[0]
        # Sisa ruas cabang: arah sebaliknya yang terverifikasi (simetri),
        # diuji lewat tingkat kecocokan.
        for a, b in zip(br, br[1:]):
            out_branch[(a, b)] = runs[(b, a)]
    runs.update(out_branch)

    d_starts, pools[TRUNK[0]] = pools[TRUNK[0]], []
    profiles = {}
    for line, br in BRANCH.items():
        seq = TRUNK + br[:-1]  # ujung cabang: jam tiba tidak ada di tabel
        profiles[line] = (seq, cumulative(seq, runs))
    assigned = {l: [] for l in BRANCH}
    for d0 in d_starts:
        score = {}
        for line, br in BRANCH.items():
            seq, offs = profiles[line]
            branch_part = [(s, o) for s, o in zip(seq, offs) if s in br]
            score[line] = sum(1 for s, o in branch_part
                              if any(abs(x - (d0 + o)) <= TOLERANCE for x in pools[s])) / len(branch_part)
        line = max(score, key=score.get)
        others = [v for l, v in score.items() if l != line]
        if score[line] < 0.5:
            stats["keluar: cabang tidak teridentifikasi (dibuang)"] += 1
            continue
        if others and others[0] == score[line]:
            stats["keluar: cabang ambigu"] += 1
        assigned[line].append(d0)
    for line in BRANCH:
        seq, offs = profiles[line]
        for tr in predict_and_match(sorted(assigned[line]), seq, offs, pools, stats):
            trips.append(dict(tr, line=line, dir=0))

    leftovers = {s: len(p) for s, p in pools.items() if p}
    return trips, stats, runs, leftovers


def finish_terminals(trips, modes):
    """Tambah jam tiba stasiun akhir dari modus ruas yang sama arah sebaliknya."""
    for t in trips:
        if not t["alive"]:
            continue
        seq = (list(reversed(BRANCH[t["line"]])) + list(reversed(TRUNK))) if t["dir"] == 1 \
            else TRUNK + BRANCH[t["line"]]
        if len(t["stops"]) != len(seq) - 1:
            t["alive"] = False
            continue
        last, final = seq[-2], seq[-1]
        run = modes.get((final, last))
        if run is None:
            t["alive"] = False
            continue
        t["times"].append(t["times"][-1] + run)
        t["stops"].append(final)


def stop_coords():
    o = json.loads((SRC / "osm_lrt_routes_2026-09-03.json").read_text(encoding="utf-8"))
    by_name = {}
    for rid in ("r16036440", "r16036441", "r16079478", "r16079479"):
        for ref, role in o[rid]["members"]:
            if role.startswith("stop") and ref in o:
                n = o[ref]
                by_name.setdefault(n["tags"].get("name"), []).append((n["lat"], n["lon"]))
    coords = {}
    for slug, (_, _, osm_name) in STATIONS.items():
        pts = by_name.get(osm_name)
        if not pts:
            sys.exit(f"Tidak ada stop_position OSM untuk {osm_name}")
        coords[slug] = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
    return coords


def parse_fares():
    h = (SRC / "informasi-tarif.html").read_text(encoding="utf-8")
    tables = re.findall(r'<table class="table table-striped table-striped-tarif[^"]*">(.*?)</table>', h, re.S)
    if len(tables) != 3:
        sys.exit(f"Harusnya 3 tabel tarif, ketemu {len(tables)} — struktur situs berubah?")
    mats = []
    for tbl in tables:
        rows = []
        for r in re.findall(r"<tr[^>]*>(.*?)</tr>", tbl, re.S):
            cells = [re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", c)).strip()
                     for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", r, re.S)]
            if cells and cells[0] in FARE_NAME:
                rows.append((cells[0], [int(re.sub(r"[^0-9]", "", c)) for c in cells[1:]]))
        names = [n for n, _ in rows]
        mats.append({(FARE_NAME[a], FARE_NAME[names[j]]): v
                     for a, vals in rows for j, v in enumerate(vals)})
    # Identitas tabel dicek dari isinya, bukan dari urutan: jam sibuk plafon
    # Rp20.000, dua lainnya Rp10.000 dan identik satu sama lain.
    peak = [m for m in mats if max(m.values()) == 20000]
    offp = [m for m in mats if max(m.values()) == 10000]
    if len(peak) != 1 or len(offp) != 2 or offp[0] != offp[1]:
        sys.exit("Identitas tabel tarif tidak sesuai ekspektasi (1 jam sibuk + 2 identik) — cek manual.")
    return peak[0], offp[0]


def main():
    sched = parse_schedule()
    coords = stop_coords()
    all_trips, report = [], {}
    for day, service in DAYS.items():
        trips, stats, modes, leftovers = build_day(sched, day)
        finish_terminals(trips, modes)
        ok = [t for t in trips if t["alive"]]
        for t in ok:
            t["service"] = service
        all_trips += ok
        report[day] = dict(trip=len(ok), dibuang=len(trips) - len(ok), stats=dict(stats),
                           sisa_tak_terpakai=leftovers,
                           per_lin={l: sum(1 for t in ok if t["line"] == l) for l in BRANCH})
        print(f"\n== {day} ({service}) ==")
        print(f"  trip: {len(ok)}  (dibuang {len(trips) - len(ok)})  per lin: {report[day]['per_lin']}")
        print(f"  pencocokan ruas: {dict(stats)}")
        print(f"  jam tabel yang tidak terpakai trip mana pun: {leftovers or 'tidak ada'}")

    with zipfile.ZipFile(OUT_ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("agency.txt",
                   "agency_id,agency_name,agency_url,agency_timezone,agency_lang\n"
                   "LRTJ,LRT Jabodebek,https://lrtjabodebek.kai.id,Asia/Jakarta,id\n")
        rows = ["stop_id,stop_name,stop_lat,stop_lon,location_type"]
        for slug, (sid, name, _) in STATIONS.items():
            lat, lon = coords[slug]
            rows.append(f"{sid},{name},{lat:.7f},{lon:.7f},0")
        z.writestr("stops.txt", "\n".join(rows) + "\n")
        # route_type 0 = "Tram, Streetcar, Light rail" (GTFS). LRT Jabodebek
        # memang light rail; MRT memakai 1 (Subway/Metro). OTP2 memetakan
        # route_type 0 ke mode TRAM.
        rows = ["route_id,agency_id,route_short_name,route_long_name,route_type,route_color,route_text_color"]
        for rid, short, long_, color in LINES.values():
            rows.append(f"{rid},LRTJ,{short},{long_},0,{color},FFFFFF")
        z.writestr("routes.txt", "\n".join(rows) + "\n")
        z.writestr("calendar.txt",
                   "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n"
                   "WEEKDAY,1,1,1,1,1,0,0,20260101,20271231\n"
                   "WEEKEND,0,0,0,0,0,1,1,20260101,20271231\n")
        trows = ["route_id,service_id,trip_id,trip_headsign,direction_id"]
        srows = ["trip_id,arrival_time,departure_time,stop_id,stop_sequence"]
        for i, t in enumerate(sorted(all_trips, key=lambda t: (t["service"], t["line"], t["dir"], t["times"][0]))):
            rid = LINES[t["line"]][0]
            tid = f"{rid}_{t['service']}_{t['dir']}_{i:04d}"
            head = STATIONS[t["stops"][-1]][1]
            trows.append(f"{rid},{t['service']},{tid},{head},{t['dir']}")
            for seq, (slug, m) in enumerate(zip(t["stops"], t["times"]), start=1):
                srows.append(f"{tid},{fmt(m)},{fmt(m)},{STATIONS[slug][0]},{seq}")
        z.writestr("trips.txt", "\n".join(trows) + "\n")
        z.writestr("stop_times.txt", "\n".join(srows) + "\n")
    print(f"\nWrote {OUT_ZIP}  ({len(all_trips)} trip)")

    peak, offp = parse_fares()
    FARE_OUT.write_text(json.dumps({
        "source": "lrtjabodebek.kai.id/informasi-tarif, snapshot " +
                  (SRC / "FETCHED_AT.txt").read_text().strip(),
        "peak_hours": ["06:00-08:59", "16:00-19:59"],
        "peak_applies_on_weekends": False,
        "note": "stop_id -> tarif; jam sibuk hanya hari kerja (Sabtu/Minggu/libur pakai offpeak)",
        "peak": {f"{STATIONS[a][0]}|{STATIONS[b][0]}": v for (a, b), v in sorted(peak.items()) if a != b},
        "offpeak": {f"{STATIONS[a][0]}|{STATIONS[b][0]}": v for (a, b), v in sorted(offp.items()) if a != b},
    }, indent=0), encoding="utf-8")
    print(f"Wrote {FARE_OUT}")
    (DATA / "lrt_build_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
