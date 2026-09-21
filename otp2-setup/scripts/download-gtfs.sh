#!/usr/bin/env bash
# Downloads the latest TransJakarta GTFS static feed into data/transjakarta_gtfs.zip
# and validates that it has the core files OTP2 needs, non-corrupt.
#
# Source: https://gtfs.transjakarta.co.id/files/file_gtfs.zip (official feed,
# indexed on Transitland as f-transjakarta~id). As of 2026-09 this host serves
# an expired-but-legitimate TLS cert (CN=*.transjakarta.co.id, issued by
# Sectigo, simply not renewed in time) — hence -k below. If TransJakarta
# renews the cert, -k is harmless and can stay.
set -euo pipefail
cd "$(dirname "$0")/.."

URL="https://gtfs.transjakarta.co.id/files/file_gtfs.zip"
DEST="data/transjakarta_gtfs.zip"
REQUIRED_FILES=(agency.txt routes.txt stops.txt trips.txt stop_times.txt calendar.txt)

echo "Downloading GTFS from $URL ..."
curl -fSL -k -o "$DEST" "$URL"

echo "Validating GTFS structure ..."
listing="$(unzip -l "$DEST")"
for f in "${REQUIRED_FILES[@]}"; do
  if ! grep -q " $f\$" <<< "$listing"; then
    echo "ERROR: required file '$f' missing from $DEST — aborting, previous graph.obj left untouched." >&2
    exit 1
  fi
done
unzip -tq "$DEST" > /dev/null
echo "OK: all required GTFS files present and archive is not corrupt."
echo
echo "Next: rebuild the graph with scripts/build-graph.sh (or .ps1)."
