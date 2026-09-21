#!/usr/bin/env bash
# Builds (or rebuilds) the OTP2 graph from data/ (GTFS + OSM + configs) and
# writes it back to data/graph.obj. Run this once, and again any time the
# GTFS file, the OSM extract, or build-config.json/router-config.json change.
#
# Builds into a throwaway named Docker volume rather than building directly
# against the data/ bind mount. On Docker Desktop for Windows, OTP2's graph
# serialization step (many small buffered writes) can be pathologically slow
# over a bind-mounted Windows path — minutes turn into an hour-plus. Building
# on the volume (native to the Docker VM) and then doing two bulk copies
# in/out of the bind mount avoids that: the bulk copies take seconds each,
# regardless of how slow small buffered writes are over the mount.
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE="opentripplanner/opentripplanner:2.10.0_2026-09-01T15-06"
VOL="otp2-build-vol"

echo "Copying data/ inputs into build volume ..."
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$(pwd)/data:/src:ro" \
  -v "$VOL:/var/opentripplanner" \
  --entrypoint bash "$IMAGE" \
  -c "rm -f /var/opentripplanner/graph.obj; cp /src/*.json /src/*.zip /var/opentripplanner/ 2>/dev/null || true; cp /src/*.pbf /var/opentripplanner/ 2>/dev/null || true"

echo "Building OTP2 graph ..."
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$VOL:/var/opentripplanner" \
  "$IMAGE" --build --save

echo "Copying graph.obj back out to data/ ..."
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$VOL:/vol:ro" \
  -v "$(pwd)/data:/dst" \
  --entrypoint bash "$IMAGE" \
  -c "cp /vol/graph.obj /dst/graph.obj"

docker volume rm "$VOL" >/dev/null

echo "Done. graph.obj written to data/graph.obj"
echo "Start the server with: docker compose up   (or scripts/serve.sh)"
