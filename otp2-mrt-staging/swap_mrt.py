#!/usr/bin/env python3
"""Task 3 syarat 3+4: pindahkan graph hasil staging ke produksi, lalu
uji regresi — dan kembalikan sendiri kalau regresinya gagal.

    swap_mrt.py

Urutannya sengaja: backup dulu, baru salin, baru restart, baru uji. Kalau uji
regresi gagal ATAU OTP2 tidak mau siap, skrip ini MENGEMBALIKAN graph lama
tanpa menunggu diperintah — graph yang dipakai demo tidak boleh ditinggal
dalam keadaan rusak.
"""
import json
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

STAGING = Path(__file__).resolve().parent / "data"
PROD = STAGING.parent.parent / "otp2-setup" / "data"
CONTAINER = "otp2-transjakarta"
OTP_URL = "http://localhost:8080/otp/gtfs/v1"

BERKAS = [("graph.obj", "graph.obj.backup-pre-mrt"),
          ("build-config.json", "build-config.json.backup-pre-mrt")]


def jalan(*cmd, cek=True):
    print(f"  $ {' '.join(cmd)}")
    p = subprocess.run(cmd, capture_output=True, text=True)
    if cek and p.returncode != 0:
        print(p.stdout[-500:], p.stderr[-500:])
        raise SystemExit(f"perintah gagal: {' '.join(cmd)}")
    return p


def tunggu_otp2(batas_detik=420) -> bool:
    """Container 'Up' BELUM berarti OTP2 siap melayani — graph-nya masih
    dimuat. Yang menentukan kesiapan adalah query GraphQL yang benar-benar
    dijawab, bukan status container."""
    q = json.dumps({"query": '{ stops(name: "Blok M") { gtfsId } }'}).encode()
    mulai = time.time()
    while time.time() - mulai < batas_detik:
        try:
            req = urllib.request.Request(
                OTP_URL, data=q, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=15) as r:
                if json.load(r).get("data", {}).get("stops") is not None:
                    print(f"  OTP2 siap setelah {time.time()-mulai:.0f}s")
                    return True
        except Exception:
            pass
        time.sleep(5)
    print(f"  OTP2 TIDAK siap dalam {batas_detik}s")
    return False


def rollback():
    print("\n--- ROLLBACK: mengembalikan graph sebelum MRT ---")
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
    graph_baru = STAGING / "graph.obj"
    if not graph_baru.exists():
        raise SystemExit("ERROR: graph.obj staging belum ada — build dulu")
    mb = graph_baru.stat().st_size / 1024 / 1024
    if mb < 50:
        raise SystemExit(f"ERROR: graph staging cuma {mb:.0f} MB, kemungkinan build gagal")
    print(f"Graph staging: {mb:.0f} MB")

    print("\n1. Backup graph produksi")
    for nama, backup in BERKAS:
        asal = PROD / nama
        if not asal.exists():
            raise SystemExit(f"ERROR: {asal} tidak ada")
        shutil.copy2(asal, PROD / backup)
        print(f"  {nama} -> {backup}")

    print("\n2. Salin graph baru ke produksi")
    for nama in ("graph.obj", "build-config.json"):
        shutil.copy2(STAGING / nama, PROD / nama)
        print(f"  {nama}")
    # Feed MRT ikut dipindah supaya produksi bisa di-rebuild sendiri nanti
    # tanpa bergantung ke folder staging ini.
    shutil.copy2(STAGING / "mrt_gtfs.zip", PROD / "mrt_gtfs.zip")
    print("  mrt_gtfs.zip")

    print("\n3. Restart OTP2 produksi")
    jalan("docker", "restart", CONTAINER)
    if not tunggu_otp2():
        rollback()
        return 1

    print("\n4. Statistik graph baru")
    log = jalan("docker", "logs", "--tail", "400", CONTAINER, cek=False).stdout \
        + jalan("docker", "logs", "--tail", "400", CONTAINER, cek=False).stderr
    for baris in log.splitlines():
        if "Graph loaded" in baris or "Transit loaded" in baris:
            print("  " + baris.split(") ", 1)[-1])

    print("\n5. Regresi 3 skenario demo")
    hasil = subprocess.run(
        [sys.executable, str(Path(__file__).parent / "regresi_demo.py"), "--periksa"],
        text=True)
    if hasil.returncode != 0:
        print("\nREGRESI GAGAL — mengembalikan graph lama")
        rollback()
        return 1

    print("\nSWAP SUKSES — graph dengan MRT sekarang melayani produksi")
    print("Rollback manual kalau nanti bermasalah:")
    print(f"  cp {PROD}/graph.obj.backup-pre-mrt {PROD}/graph.obj")
    print(f"  cp {PROD}/build-config.json.backup-pre-mrt {PROD}/build-config.json")
    print(f"  docker restart {CONTAINER}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
