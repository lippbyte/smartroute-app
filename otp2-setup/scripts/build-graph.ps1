# Builds (or rebuilds) the OTP2 graph from data\ (GTFS + OSM + configs) and
# writes it back to data\graph.obj. Run this once, and again any time the
# GTFS file, the OSM extract, or build-config.json/router-config.json change.
#
# Builds into a throwaway named Docker volume rather than building directly
# against the data\ bind mount. On Docker Desktop for Windows, OTP2's graph
# serialization step (many small buffered writes) can be pathologically slow
# over a bind-mounted Windows path — minutes turn into an hour-plus. Building
# on the volume (native to the Docker VM) and then doing two bulk copies
# in/out of the bind mount avoids that: the bulk copies take seconds each,
# regardless of how slow small buffered writes are over the mount.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$image = "opentripplanner/opentripplanner:2.10.0_2026-09-01T15-06"
$vol = "otp2-build-vol"

Write-Host "Copying data\ inputs into build volume ..."
docker run --rm `
  -v "${root}\data:/src:ro" `
  -v "${vol}:/var/opentripplanner" `
  --entrypoint bash $image `
  -c "rm -f /var/opentripplanner/graph.obj; cp /src/*.json /src/*.zip /var/opentripplanner/ 2>/dev/null || true; cp /src/*.pbf /var/opentripplanner/ 2>/dev/null || true"

Write-Host "Building OTP2 graph ..."
docker run --rm `
  -v "${vol}:/var/opentripplanner" `
  $image --build --save

Write-Host "Copying graph.obj back out to data\ ..."
docker run --rm `
  -v "${vol}:/vol:ro" `
  -v "${root}\data:/dst" `
  --entrypoint bash $image `
  -c "cp /vol/graph.obj /dst/graph.obj"

docker volume rm $vol | Out-Null

Write-Host "Done. graph.obj written to data\graph.obj"
Write-Host "Start the server with: docker compose up   (or scripts\serve.ps1)"
