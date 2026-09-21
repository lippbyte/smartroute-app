#!/usr/bin/env python3
"""Task 1: ekspor feed GTFS ke satu file xlsx, satu tab per file GTFS —
mengikuti konvensi sheet TJ/BRT_TJ milik Bayu (lihat data/sources/bayu/STRUKTUR.md).

    gtfs_to_xlsx.py <folder_gtfs_atau_zip> <output.xlsx>

Pasangannya `xlsx_to_gtfs.py` mengubahnya kembali, supaya suntingan Bayu di
Google Sheets bisa divalidasi ulang dengan validator yang sama.

Semua sel ditulis sebagai TEKS, bukan angka/waktu. Ini bukan detail kosmetik:
tanpa itu Excel/Sheets mengubah "07:05:00" jadi nilai waktu dan "0012" jadi 12,
lalu round-trip mengembalikan feed yang berbeda dari aslinya.
"""
import csv
import io
import sys
import zipfile
from pathlib import Path

import openpyxl
from openpyxl.utils import get_column_letter

# Urutan tab mengikuti urutan kurasi di BRT_TJ.xlsx (lebih mudah dibaca
# daripada urutan alfabetis TJ.xlsx). File di luar daftar ini tetap diekspor,
# diletakkan sesudahnya sesuai urutan alfabet.
TAB_ORDER = [
    "routes", "trips", "stop_times", "stops", "shapes", "frequencies",
    "calendar", "calendar_dates", "fare_attributes", "fare_rules", "agency",
    "transfers", "ticketing_identifiers", "ticketing_deep_links",
]

# Batas satu spreadsheet Google Sheets.
SHEETS_CELL_LIMIT = 10_000_000


def read_tables(src: Path) -> dict[str, tuple[list[str], list[list[str]]]]:
    """Kembalikan {nama_file_tanpa_txt: (header, baris)} dengan nilai apa adanya."""
    tables = {}

    def parse(name: str, stream) -> None:
        reader = csv.reader(io.TextIOWrapper(stream, encoding="utf-8-sig", newline=""))
        header = next(reader, None)
        if header is None:
            return
        tables[name] = (header, [row for row in reader if row])

    if src.is_dir():
        for path in sorted(src.glob("*.txt")):
            with path.open("rb") as fh:
                parse(path.stem, fh)
    else:
        with zipfile.ZipFile(src) as zf:
            for info in sorted(zf.infolist(), key=lambda i: i.filename):
                if info.filename.endswith(".txt"):
                    with zf.open(info) as fh:
                        parse(Path(info.filename).stem, fh)

    if not tables:
        sys.exit(f"ERROR: tidak ada file .txt GTFS di {src}")
    return tables


def ordered(names) -> list[str]:
    known = [n for n in TAB_ORDER if n in names]
    return known + sorted(set(names) - set(known))


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    if not src.exists():
        sys.exit(f"ERROR: {src} tidak ada")

    tables = read_tables(src)
    wb = openpyxl.Workbook(write_only=True)
    total_cells = 0

    for name in ordered(tables):
        header, rows = tables[name]
        ws = wb.create_sheet(name)
        ws.append(header)
        for row in rows:
            # Padding: baris pendek tetap sejajar kolomnya, tidak digeser.
            ws.append([*row, *[None] * (len(header) - len(row))][: len(header)])
        cells = (len(rows) + 1) * len(header)
        total_cells += cells
        print(f"  {name:<24}{len(rows):>8} baris x {len(header):>2} kolom = {cells:>9} sel")

    # Lebar kolom & format teks tidak bisa diatur di write_only mode, jadi
    # keduanya diterapkan saat pembacaan balik (xlsx_to_gtfs) — nilai tetap
    # tersimpan sebagai string karena csv.reader selalu menghasilkan str.
    wb.save(out)

    print(f"\n  total {total_cells:,} sel -> {out}")
    if total_cells > SHEETS_CELL_LIMIT:
        print(
            f"\n  PERINGATAN: {total_cells:,} sel melebihi batas Google Sheets "
            f"({SHEETS_CELL_LIMIT:,}). File ini kemungkinan TIDAK bisa dibuka di\n"
            f"  Google Sheets. Pisahkan tab besar (biasanya shapes/stop_times) ke\n"
            f"  file terpisah sebelum dikirim ke Bayu."
        )
    else:
        sisa = SHEETS_CELL_LIMIT - total_cells
        print(f"  Muat di Google Sheets (sisa kuota {sisa:,} sel).")


if __name__ == "__main__":
    main()
