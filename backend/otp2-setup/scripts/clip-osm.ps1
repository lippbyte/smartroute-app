# Clips a full-Java OSM extract down to a Jabodetabek bounding box and writes
# data\jabodetabek.osm.pbf, ready for OTP2 to build against.
#
# Geofabrik doesn't publish a Jabodetabek-sized extract (nor DKI Jakarta on
# its own) — the smallest one that contains it is the Java sub-region
# (java-latest.osm.pbf, ~850 MB). We download that once into osm-src\ and
# clip it locally so day-to-day graph rebuilds stay fast and light on RAM;
# re-run this script (not build-graph) whenever you want a fresh OSM cut.
#
# Uses `osmium-tool` from Ubuntu's official apt repo inside a throwaway
# container — avoids installing anything on the host and avoids trusting a
# random pre-built osmium image.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$srcDir = "osm-src"
$srcFile = "$srcDir\java-latest.osm.pbf"
$srcUrl = "https://download.geofabrik.de/asia/indonesia/java-latest.osm.pbf"
$outFile = "data/jabodetabek.osm.pbf"

# left,bottom,right,top (minlon,minlat,maxlon,maxlat). Padded to comfortably
# cover Jakarta + Bogor + Depok + Tangerang + Bekasi, including Soekarno-Hatta
# airport (106.65,-6.12) and southward into the Bogor/Puncak hills.
$bbox = "106.25,-6.75,107.20,-5.95"

New-Item -ItemType Directory -Force -Path $srcDir | Out-Null

if (-not (Test-Path $srcFile)) {
    Write-Host "Downloading Java OSM extract (~850 MB, one-time) from $srcUrl ..."
    Invoke-WebRequest -Uri $srcUrl -OutFile $srcFile
} else {
    Write-Host "Using existing $srcFile (delete it to force a fresh download)."
}

Write-Host "Clipping to Jabodetabek bbox [$bbox] ..."
docker run --rm -v "${root}:/data" -w /data ubuntu:24.04 bash -c "
  set -e
  apt-get update -qq
  apt-get install -y -qq osmium-tool > /dev/null
  osmium extract --bbox=$bbox --strategy=smart -o $outFile --overwrite $srcFile
  osmium fileinfo $outFile
"

Write-Host ""
Write-Host "Done: $outFile"
Write-Host "Next: rebuild the graph with scripts\build-graph.ps1 (or .sh)."
