#!/usr/bin/env bash
# Task Backend-14 experiment build — adapted from otp2-setup/scripts/build-graph.sh,
# but pointed at THIS folder's own data/ (own OSM copy + TransJakarta GTFS
# copy + krl_sample_gtfs.zip) and its own throwaway build volume name, so it
# can never collide with or touch the production build.
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE="opentripplanner/opentripplanner:2.10.0_2026-09-01T15-06"
VOL="otp2-krl-experiment-build-vol"

echo "Copying data/ inputs into build volume ..."
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$(pwd)/data:/src:ro" \
  -v "$VOL:/var/opentripplanner" \
  --entrypoint bash "$IMAGE" \
  -c "rm -f /var/opentripplanner/graph.obj; cp /src/*.json /src/*.zip /var/opentripplanner/ 2>/dev/null || true; cp /src/*.pbf /var/opentripplanner/ 2>/dev/null || true"

echo "Building OTP2 graph (TransJakarta + KRL sample feeds) ..."
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

echo "Done. graph.obj written to data/graph.obj (experiment folder only)."
echo "Start the server with: docker compose up -d   (port 8081)"
