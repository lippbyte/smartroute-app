#!/usr/bin/env python3
"""Task 3 syarat 4: regresi 3 skenario demo lama, dengan rollback otomatis.

    regresi_demo.py --simpan-baseline   # dijalankan SEBELUM swap graph
    regresi_demo.py --periksa           # dijalankan SESUDAH swap graph

Keluar bukan-nol kalau ada regresi, supaya pemanggilnya bisa rollback.

Yang dianggap REGRESI (gagal):
  - HTTP bukan 200, atau nol kandidat
  - latensi di atas 30 detik (batas timeout frontend)
  - laporan kepadatan tidak lagi membalik urutan di Senen->Grogol
  - ETA kandidat teratas bergeser lebih dari 50% dari baseline

Yang BUKAN regresi (cuma dicatat):
  - jumlah kandidat bertambah — memang diharapkan setelah MRT masuk graph
"""
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = "http://localhost:3000"
OTP = "http://localhost:8080/otp/gtfs/v1"
BASELINE = Path(__file__).resolve().parent / "baseline_demo.json"

SKENARIO = {
    "S1 Blok M -> Kota": ((-6.2443, 106.7983), (-6.1376, 106.8171)),
    "S2 Senen -> Grogol": ((-6.1760, 106.8430), (-6.1680, 106.7890)),
    "S3 Grogol -> Kp. Melayu": ((-6.1680, 106.7890), (-6.2244, 106.8664)),
}
BATAS_LATENSI_S = 30
# Hasil routing berubah menurut jam (headway/jadwal). Tanpa jam yang dikunci,
# baseline dan pemeriksaan membandingkan dua jam berbeda — ini yang dulu
# membuat perubahan Grogol->Kp. Melayu salah didiagnosis sebagai "efek build
# penuh", padahal A/B dengan jam sama menunjukkan graph lama & baru identik.
JAM_UJI = "2026-09-22T08:00:00+07:00"
KWITANG = "Kwitang"  # halte eksklusif kandidat #1 di Senen->Grogol


def post(url, payload, timeout=90):
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"})
    t = time.time()
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r), time.time() - t


def cari(o, d):
    return post(f"{BASE}/routes",
                {"origin": {"lat": o[0], "lng": o[1]},
                 "destination": {"lat": d[0], "lng": d[1]},
                 "departure_time": JAM_UJI})


def panaskan():
    print("Memanaskan OTP2 (4 pencarian) ...")
    for o, d in list(SKENARIO.values()) + [list(SKENARIO.values())[0]]:
        try:
            cari(o, d)
        except Exception as e:
            print(f"  pemanasan gagal: {e}")


def moda_dari(route):
    out = []
    for leg in route["legs"]:
        m = leg["mode"]
        if not out or out[-1] != m:
            out.append(m)
    return out


def ambil():
    hasil = {}
    for nama, (o, d) in SKENARIO.items():
        data, secs = cari(o, d)
        rutes = data.get("routes", [])
        hasil[nama] = {
            "latensi_s": round(secs, 2),
            "jumlah_kandidat": len(rutes),
            "teratas": rutes[0]["route_id"] if rutes else None,
            "eta_min": rutes[0]["travel_time_minutes"]["min"] if rutes else None,
            "tarif": rutes[0]["cost_idr"] if rutes else None,
            "moda": moda_dari(rutes[0]) if rutes else [],
            "urutan": [r["route_id"] for r in rutes],
            "pakai_mrt": [r["route_id"] for r in rutes
                          if any(l["mode"] == "SUBWAY" for l in r["legs"])],
        }
        print(f"  {nama:<26}{secs:5.1f}s  {len(rutes)} kandidat  "
              f"teratas={hasil[nama]['teratas']}  moda={'+'.join(hasil[nama]['moda'])}")
    return hasil


def uji_flip():
    """Laporan kepadatan di Kwitang harus membalik urutan Senen->Grogol."""
    o, d = SKENARIO["S2 Senen -> Grogol"]
    sebelum, _ = cari(o, d)
    urut_sebelum = [r["route_id"] for r in sebelum.get("routes", [])]
    if not urut_sebelum:
        return False, "tidak ada kandidat sama sekali"

    q = {"query": '{ stops(name: "%s") { gtfsId name } }' % KWITANG}
    stops, _ = post(OTP, q)
    ids = [s["gtfsId"] for s in stops["data"]["stops"] if s["name"] == KWITANG]
    for sid in ids:
        post(f"{BASE}/crowd-reports", {"stop_id": sid, "level": "high"}, timeout=20)

    sesudah, _ = cari(o, d)
    urut_sesudah = [r["route_id"] for r in sesudah.get("routes", [])]
    berubah = bool(urut_sesudah) and urut_sebelum[0] != urut_sesudah[0]
    return berubah, f"{urut_sebelum[0]} -> {urut_sesudah[0] if urut_sesudah else '-'}"


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    panaskan()

    print("\nMenjalankan 3 skenario demo:")
    try:
        hasil = ambil()
    except (urllib.error.URLError, TimeoutError) as e:
        print(f"\nGAGAL menghubungi backend: {e}")
        return 1

    print("\nUji pembalikan urutan (laporan kepadatan Kwitang):")
    flip, detail = uji_flip()
    print(f"  {'BERUBAH' if flip else 'TIDAK BERUBAH'}: {detail}")
    hasil["_flip"] = flip
    hasil["_jam_uji"] = JAM_UJI

    if mode == "--simpan-baseline":
        BASELINE.write_text(json.dumps(hasil, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\nBaseline disimpan: {BASELINE}")
        return 0

    if mode != "--periksa":
        print(__doc__)
        return 2

    if not BASELINE.exists():
        print("\nTidak ada baseline untuk dibandingkan.")
        return 2
    base = json.loads(BASELINE.read_text(encoding="utf-8"))
    if base.get("_jam_uji") != JAM_UJI:
        print(f"\nBaseline diambil pada jam {base.get('_jam_uji', 'TIDAK DIKUNCI')}, "
              f"pemeriksaan pada {JAM_UJI} — tidak sebanding. Ambil ulang baseline.")
        return 2

    print("\n" + "=" * 66)
    print(f"{'skenario':<26}{'baseline':>16}{'sekarang':>16}")
    gagal = []
    # Rute mana yang HILANG/MUNCUL, bukan cuma berapa banyak. Kalau himpunan
    # kandidat ikut berubah di skenario yang tidak menyentuh MRT sama sekali,
    # penyebabnya bukan MRT melainkan build penuh vs graph lama — beda sebab,
    # beda laporan.
    berubah_himpunan = {}
    for nama in SKENARIO:
        b, s = base[nama], hasil[nama]
        print(f"{nama:<26}{str(b['jumlah_kandidat'])+' kand, '+str(b['eta_min'])+'m':>16}"
              f"{str(s['jumlah_kandidat'])+' kand, '+str(s['eta_min'])+'m':>16}")
        hilang = [r for r in b["urutan"] if r not in s["urutan"]]
        muncul = [r for r in s["urutan"] if r not in b["urutan"]]
        # Kandidat MRT yang muncul = efek MRT yang sah (Blok M sendiri
        # stasiun MRT). Kandidat lama yang hilang juga efek MRT kalau
        # daftarnya penuh dan ada kandidat MRT yang menggesernya. Yang TIDAK
        # bisa dijelaskan MRT: kandidat non-MRT baru, atau kandidat hilang
        # tanpa ada yang menggeser.
        mrt_baru = set(s.get("pakai_mrt", []))
        non_mrt_baru = [r for r in muncul if r not in mrt_baru]
        tergeser = len(s["urutan"]) >= 3 and bool(mrt_baru)
        hilang_tak_jelas = [] if tergeser else hilang
        berubah_himpunan[nama] = bool(non_mrt_baru or hilang_tak_jelas)
        if muncul and mrt_baru:
            print(f"    kandidat MRT baru: {', '.join(r for r in muncul if r in mrt_baru)}")
        if non_mrt_baru:
            print(f"    kandidat NON-MRT baru (bukan efek MRT): {', '.join(non_mrt_baru)}")
        if hilang:
            print(f"    HILANG : {', '.join(hilang)}")
        if muncul:
            print(f"    MUNCUL : {', '.join(muncul)}")
        if not hilang and not muncul and b["urutan"] != s["urutan"]:
            print(f"    urutan bergeser: {b['urutan']} -> {s['urutan']}")
        if b["moda"] != s["moda"]:
            print(f"    moda teratas: {'+'.join(b['moda'])} -> {'+'.join(s['moda'])}")
        if s["jumlah_kandidat"] == 0:
            gagal.append(f"{nama}: nol kandidat")
        if s["latensi_s"] > BATAS_LATENSI_S:
            gagal.append(f"{nama}: latensi {s['latensi_s']}s melebihi {BATAS_LATENSI_S}s")
        if b["eta_min"] and s["eta_min"]:
            selisih = (s["eta_min"] - b["eta_min"]) / b["eta_min"]
            # Hanya MEMBURUK drastis yang regresi. Rute yang jadi jauh lebih
            # cepat karena MRT adalah hasil yang diinginkan — me-rollback
            # karena perbaikan tidak masuk akal.
            if selisih > 0.5:
                gagal.append(
                    f"{nama}: ETA memburuk drastis {b['eta_min']}m -> {s['eta_min']}m "
                    f"(+{selisih*100:.0f}%)")
            elif selisih < -0.3:
                print(f"    ETA membaik {b['eta_min']}m -> {s['eta_min']}m ({selisih*100:.0f}%)")
        if s["jumlah_kandidat"] != b["jumlah_kandidat"]:
            print(f"    (catatan: kandidat {b['jumlah_kandidat']} -> "
                  f"{s['jumlah_kandidat']}, wajar setelah MRT masuk)")

    if base.get("_flip") and not hasil["_flip"]:
        gagal.append("laporan kepadatan tidak lagi membalik urutan Senen->Grogol")

    # Diagnosis sebab: perubahan yang TIDAK bisa dijelaskan oleh kandidat
    # MRT (lihat perhitungan per skenario di atas) berarti graph-nya berubah
    # secara menyeluruh — efek build penuh, bukan efek penambahan MRT.
    ikut_berubah = [n for n in ("S1 Blok M -> Kota", "S3 Grogol -> Kp. Melayu")
                    if berubah_himpunan.get(n)]
    print("-" * 66)
    if ikut_berubah:
        print("DIAGNOSIS: ada perubahan kandidat NON-MRT yang tidak bisa dijelaskan")
        print(f"oleh MRT ({', '.join(ikut_berubah)}). Ini efek build graph penuh,")
        print("BUKAN efek penambahan MRT — temuan terpisah dari Task 3.")
    else:
        print("DIAGNOSIS: semua perubahan di S1/S3 bisa dijelaskan oleh kandidat MRT")
        print("(muncul, atau menggeser kandidat lama). Tidak ada efek build penuh.")

    print("=" * 66)
    if gagal:
        print(f"REGRESI ({len(gagal)}):")
        for g in gagal:
            print(f"  - {g}")
        return 1
    print("SEMUA LULUS — tidak ada regresi")
    return 0


if __name__ == "__main__":
    sys.exit(main())
