#!/usr/bin/env python3
"""Ambil tarif MRT Jakarta resmi untuk SEMUA pasangan stasiun.

Sumber: endpoint yang dipanggil halaman "Rencana Perjalanan" jakartamrt.co.id
sendiri — POST {API}/route dengan body {"type":"from","from":<id>,"to":<id>,
"datetime":...}; responsnya memuat integration.cost (tarif) dan
integration.timeEstimation. Id stasiun dari data/mrt_source/stasiun.json.

Hanya membaca, satu permintaan per detik. Hasil ditulis ke
data/mrt_source/tarif_resmi.json lalu dipakai build_mrt_gtfs.py.

Catatan: timeEstimation dari API ini TIDAK dipakai. Nilainya tidak cocok
dengan jadwal resmi situs yang sama (mis. Lebak Bulus -> Bundaran HI tertulis
"10" menit, jadwal menunjukkan ~29 menit), jadi waktu tempuh diambil dari
jadwal, bukan dari field ini. Tetap disimpan apa adanya untuk audit.
"""
import json
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
STATIONS = DATA / "mrt_source" / "stasiun.json"
COORDS = DATA / "mrt_station_coords.json"
OUT = DATA / "mrt_source" / "tarif_resmi.json"
API = "https://beweb-dev.jakartamrt.co.id/middleware/api/route"
DELAY_S = 1.0
# Satu jam hari kerja sebagai jam acuan; beberapa pasangan dicek juga di jam
# lain untuk memastikan tarif MRT tidak bergantung jam (beda dari LRT).
BASE_TIME = "2026-09-22T10:00"
TIME_CHECKS = ["2026-09-22T07:30", "2026-09-22T17:30", "2026-09-26T10:00"]


def post(from_id: str, to_id: str, when: str) -> dict:
    body = json.dumps({"type": "from", "from": from_id, "to": to_id, "datetime": when}).encode()
    req = urllib.request.Request(
        API, data=body, method="POST",
        headers={"Content-Type": "application/json", "Accept": "application/json",
                 "x-platform": "mrt", "Referer": "https://jakartamrt.co.id/",
                 "User-Agent": "smartroute-fare-verification/1.0"},
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.load(r)
            if not data.get("success"):
                raise RuntimeError(f"success=false: {str(data)[:200]}")
            # integration bisa null: situs resmi sendiri tidak punya tarif untuk
            # pasangan itu. Dikembalikan apa adanya — JANGAN diisi tebakan.
            return data["data"].get("integration")
        except Exception as err:  # jaringan/CMS kadang lambat — coba lagi pelan-pelan
            if attempt == 2:
                raise
            print(f"    ulang ({err})")
            time.sleep(5 * (attempt + 1))
    raise AssertionError("unreachable")


def main() -> None:
    rows = sorted(json.loads(STATIONS.read_text(encoding="utf-8"))["data"], key=lambda d: d["index"])
    ours = sorted(json.loads(COORDS.read_text(encoding="utf-8"))["resolved"].items(),
                  key=lambda kv: kv[1]["order"])
    code_of = {str(r["id"]): code for r, (code, _) in zip(rows, ours)}
    ids = [str(r["id"]) for r in rows]

    # Cache per pasangan: kalau skrip terhenti, jalankan ulang tidak meminta
    # lagi pasangan yang sudah didapat (hemat beban ke server resmi).
    cache_path = OUT.with_suffix(".cache.json")
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    fares, estimations, missing = {}, {}, []
    total = len(ids) * (len(ids) - 1)
    k = 0
    for a in ids:
        for b in ids:
            if a == b:
                continue
            k += 1
            key = f"{code_of[a]}-{code_of[b]}"
            if key not in cache:
                cache[key] = post(a, b, BASE_TIME)
                cache_path.write_text(json.dumps(cache), encoding="utf-8")
                time.sleep(DELAY_S)
            integ = cache[key]
            if not integ or integ.get("cost") in (None, ""):
                missing.append(key)
                continue
            fares[key] = int(integ["cost"])
            estimations[key] = integ.get("timeEstimation")
            if k % 20 == 0 or k == total:
                print(f"  {k}/{total}  {key} = Rp{fares[key]:,}".replace(",", "."))
    if missing:
        print(f"  TIDAK ADA DATA RESMI untuk {len(missing)} pasangan: {', '.join(missing)}")

    time_checks = {}
    for when in TIME_CHECKS:
        integ = post(ids[0], ids[-1], when)
        time_checks[when] = int(integ["cost"]) if integ and integ.get("cost") else None
        time.sleep(DELAY_S)

    OUT.write_text(json.dumps({
        "_sumber": API + " (endpoint halaman Rencana Perjalanan jakartamrt.co.id)",
        "_diambil": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "_jam_acuan": BASE_TIME,
        "_cek_jam_lain_LBB_BHI": time_checks,
        "tarif": fares,
        "tanpa_data_resmi": missing,
        "timeEstimation_tidak_dipakai": estimations,
    }, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"Ditulis {OUT} ({len(fares)} pasangan)")
    print("Cek jam lain Lebak Bulus->Bundaran HI:", time_checks)


if __name__ == "__main__":
    main()
