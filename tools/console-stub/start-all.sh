#!/usr/bin/env bash
# Start the three stubs (hr 9101, gudang 9102, produksi 9103). Keys come from the environment:
#   STUB_HR_KEY=... STUB_GUDANG_KEY=... STUB_PRODUKSI_KEY=... ./start-all.sh
set -euo pipefail
cd "$(dirname "$0")"
trap 'kill 0' EXIT
STUB_SOURCE=hr       STUB_KEY="${STUB_HR_KEY:?}"       STUB_DEV="${STUB_DEV:-true}" node server.mjs &
STUB_SOURCE=gudang   STUB_KEY="${STUB_GUDANG_KEY:?}"   STUB_DEV="${STUB_DEV:-true}" node server.mjs &
STUB_SOURCE=produksi STUB_KEY="${STUB_PRODUKSI_KEY:?}" STUB_DEV="${STUB_DEV:-true}" node server.mjs &
wait
