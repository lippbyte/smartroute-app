# Loads the already-built graph.obj and serves the GraphQL/REST API on :8080.
# Fast — use this for day-to-day iteration once data\graph.obj exists.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
docker compose up
