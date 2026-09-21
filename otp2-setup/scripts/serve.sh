#!/usr/bin/env bash
# Loads the already-built graph.obj and serves the GraphQL/REST API on :8080.
# Fast — use this for day-to-day iteration once data/graph.obj exists.
set -euo pipefail
cd "$(dirname "$0")/.."
MSYS_NO_PATHCONV=1 docker compose up
