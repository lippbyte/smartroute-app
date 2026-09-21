#!/usr/bin/env python3
"""Task 4.6 (LRT): pindahkan graph staging ke produksi, uji regresi, dan
KEMBALIKAN sendiri kalau regresinya gagal — pola sama dengan swap_mrt.py.

    swap_lrt.py --periksa <baseline.json> <hasil.json>   # cuma bandingkan
    swap_lrt.py <baseline.json>                          # swap sungguhan

baseline.json = hasil scripts/regression-routes.mjs terhadap graph produksi
SEBELUM swap (jam dikunci). Urutan swap: backup, salin, restart, uji.
"""
import json
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
STAGING = HERE / "data"
PROD = HERE.parent / "otp2-setup" / "data"
BACKEND = HERE.parent / "backend-skeleton"
CONTAINER = "otp2-transjakarta"
OTP_URL = "http://localhost:8080/otp/gtfs/v1"
BERKAS = [("graph.obj", "graph.obj.backup-pre-lrt"),
          ("build-config.json", "build-config.json.backup-pre-lrt")]


def jalan(*cmd, cek=True, cwd=None):
    print(f"  $ {' '.join(cmd)}")
    # encoding eksplisit: log docker memuat byte non-cp1252 (lihat swap_mrt.py).
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                       errors="replace", cwd=cwd)
    if cek and p.returncode != 0:
        print(p.stdout[-800:], p.stderr[-800:])
        raise SystemExit(f"perintah gagal: {' '.join(cmd)}")
    return p


def tunggu_otp2(batas_detik=420) -> bool:
    """Container 'Up' belum berarti siap — yang menentukan adalah query yang
    benar-benar dijawab."""
    q = json.dumps({"query": '{ stops(name: "Blok M") { gtfsId } }'}).encode()
    mulai = time.time()
    while time.time() - mulai < batas_detik:
        try:
            req = urllib.request.Request(OTP_URL, data=q, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=15) as r:
                if json.load(r).get("data", {}).get("stops") is not None:
                    print(f"  OTP2 siap setelah {time.time() - mulai:.0f}s")
                    return True
        except Exception:
            pass
        time.sleep(5)
    print(f"  OTP2 TIDAK siap dalam {batas_detik}s")
    return False


def periksa(baseline: dict, hasil: dict) -> list[str]:
    """Daftar kegagalan regresi (kosong = lulus). Pergeseran yang disebabkan
    rute LRT baru BUKAN kegagalan, tapi dicetak supaya terlihat."""
    gagal = []
    b, h = baseline["results"], hasil["results"]
    for sid, base in b.items():
        new = h.get(sid)
        if not new or new["http"] != 200 or not new["routes"]:
            gagal.append(f"{sid}: HTTP {new and new['http']} / tanpa rute")
            continue
        if new["ms"] > 30_000:
            gagal.append(f"{sid}: latensi {new['ms']} ms > 30 dtk (batas timeout frontend)")
        if not base.get("routes"):
            continue  # skenario LRT: sebelum LRT masuk graph bisa saja tanpa rute
        top_b, top_h = base["routes"][0], new["routes"][0]
        if top_b["route_id"] != top_h["route_id"]:
            if any(l.startswith("TRAM:") for l in top_h["legs"]):
                print(f"  CATATAN {sid}: #1 berubah {top_b['route_id']} -> {top_h['route_id']} (rute baru memakai LRT)")
            else:
                gagal.append(f"{sid}: #1 bergeser {top_b['route_id']} -> {top_h['route_id']} tanpa melibatkan LRT")
        # Rute lama yang masih ada harus identik (waktu/tarif/risiko).
        lama = {r["route_id"]: r for r in base["routes"]}
        for r in new["routes"]:
            if r["route_id"] in lama and {**r, "legs": [l.split("[")[0] for l in r["legs"]]} != \
                    {**lama[r["route_id"]], "legs": [l.split("[")[0] for l in lama[r["route_id"]]["legs"]]}:
                gagal.append(f"{sid}: rute {r['route_id']} berubah isi ({lama[r['route_id']]} -> {r})")
    # Skenario LRT baru (tidak ada di baseline pra-LRT): minimal satu
    # kandidat harus benar-benar memakai leg LRT.
    for sid, new in h.items():
        want = new.get("expectMode")
        if want and not any(any(l.startswith(f"{want}:") for l in r["legs"]) for r in new.get("routes") or []):
            gagal.append(f"{sid}: tidak ada kandidat yang memakai {want}")
    # Skenario demo: laporan Monas HARUS tetap membalik rekomendasi #1.
    if "PB" in h and "PB+Monas" in h:
        if h["PB"]["routes"][0]["route_id"] == h["PB+Monas"]["routes"][0]["route_id"]:
            gagal.append("demo Pasar Baru: laporan Monas tidak lagi membalik rekomendasi #1")
    return gagal


def rollback():
    print("\n--- ROLLBACK: mengembalikan graph sebelum LRT ---")
    for nama, backup in BERKAS:
        src = PROD / backup
        if src.exists():
            shutil.copy2(src, PROD / nama)
            print(f"  dipulihkan: {nama}")
        else:
            print(f"  PERINGATAN: backup {backup} tidak ada, {nama} tidak dipulihkan")
    jalan("docker", "restart", CONTAINER)
    ok = tunggu_otp2()
    print("  graph lama kembali melayani" if ok else "  GAGAL memulihkan — perlu tangan manusia")
    return ok


def main() -> int:
    if len(sys.argv) >= 4 and sys.argv[1] == "--periksa":
        gagal = periksa(json.loads(Path(sys.argv[2]).read_text()), json.loads(Path(sys.argv[3]).read_text()))
        for g in gagal:
            print("  GAGAL:", g)
        print("REGRESI LULUS" if not gagal else f"REGRESI GAGAL ({len(gagal)})")
        return 1 if gagal else 0

    baseline_path = Path(sys.argv[1])
    baseline = json.loads(baseline_path.read_text())
    graph_baru = STAGING / "graph.obj"
    mb = graph_baru.stat().st_size / 1024 / 1024 if graph_baru.exists() else 0
    if mb < 50:
        raise SystemExit(f"ERROR: graph staging {mb:.0f} MB — build gagal/belum ada")
    print(f"Graph staging: {mb:.0f} MB")

    print("\n1. Backup graph produksi")
    for nama, backup in BERKAS:
        shutil.copy2(PROD / nama, PROD / backup)
        print(f"  {nama} -> {backup}")

    print("\n2. Salin graph baru ke produksi")
    for nama in ("graph.obj", "build-config.json", "lrt_gtfs.zip"):
        shutil.copy2(STAGING / nama, PROD / nama)
        print(f"  {nama}")

    try:
        print("\n3. Restart OTP2 produksi")
        jalan("docker", "restart", CONTAINER)
        if not tunggu_otp2():
            rollback()
            return 1
        print("\n4. Regresi (backend :3000 -> OTP2 produksi)")
        out = HERE / "regresi_sesudah_swap.json"
        jalan("node", "scripts/regression-routes.mjs", "http://localhost:3000", str(out), cwd=BACKEND)
        gagal = periksa(baseline, json.loads(out.read_text()))
        if gagal:
            for g in gagal:
                print("  GAGAL:", g)
            print("\nREGRESI GAGAL — mengembalikan graph lama")
            rollback()
            return 1
    except Exception as err:
        # Graph produksi SUDAH ditukar di titik ini: error apa pun tidak boleh
        # meninggalkannya berjalan dalam keadaan belum teruji.
        print(f"\nERROR tak terduga sesudah swap: {err!r}")
        rollback()
        return 1

    print("\nSWAP SUKSES — graph dengan LRT sekarang melayani produksi")
    print("Rollback manual kalau nanti bermasalah:")
    for nama, backup in BERKAS:
        print(f"  cp {PROD / backup} {PROD / nama}")
    print(f"  docker restart {CONTAINER}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
