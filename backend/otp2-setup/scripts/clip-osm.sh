#!/usr/bin/env bash
# Clips a full-Java OSM extract down to a Jabodetabek bounding box and writes
# data/jabodetabek.osm.pbf, ready for OTP2 to build against.
#
# Geofabrik doesn't publish a Jabodetabek-sized extract (nor DKI Jakarta on
# its own) — the smallest one that contains it is the Java sub-region
# (java-latest.osm.pbf, ~850 MB). We download that once into osm-src/ and
# clip it locally so day-to-day graph rebuilds stay fast and light on RAM;
# re-run this script (not build-graph) whenever you want a fresh OSM cut.
#
# Uses `osmium-tool` from Ubuntu's official apt repo inside a throwaway
# container — avoids installing anything on the host and avoids trusting a
# random pre-built osmium image.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC_DIR="osm-src"
SRC_FILE="$SRC_DIR/java-latest.osm.pbf"
SRC_URL="https://download.geofabrik.de/asia/indonesia/java-latest.osm.pbf"
OUT_FILE="data/jabodetabek.osm.pbf"

# left,bottom,right,top (minlon,minlat,maxlon,maxlat). Padded to comfortably
# cover Jakarta + Bogor + Depok + Tangerang + Bekasi, including Soekarno-Hatta
# airport (106.65,-6.12) and southward into the Bogor/Puncak hills.
BBOX="106.25,-6.75,107.20,-5.95"

mkdir -p "$SRC_DIR"

if [ ! -f "$SRC_FILE" ]; then
  echo "Downloading Java OSM extract (~850 MB, one-time) from $SRC_URL ..."
  curl -fSL -o "$SRC_FILE" "$SRC_URL"
else
  echo "Using existing $SRC_FILE (delete it to force a fresh download)."
fi

echo "Clipping to Jabodetabek bbox [$BBOX] ..."
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd):/data" -w /data ubuntu:24.04 bash -c "
  set -e
  apt-get update -qq
  apt-get install -y -qq osmium-tool > /dev/null
  osmium extract --bbox=$BBOX --strategy=smart -o $OUT_FILE --overwrite $SRC_FILE
  osmium fileinfo $OUT_FILE
"

echo
echo "Done: $OUT_FILE"
echo "Next: rebuild the graph with scripts/build-graph.sh (or .ps1)."
