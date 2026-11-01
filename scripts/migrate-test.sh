#!/usr/bin/env bash
# make migrate-test — three suites (T0.7 / plan Task 0.7):
#   1. fresh init            — empty DB → latest schema, app boots
#   2. upgrade-from-previous — previous release schema + data → migrate → data survives
#   3. expand-contract       — old app version against expanded schema (rolling deploy)
#
# Phase 0: conventions exist, bodies are no-ops while schemas are empty.
# Real bodies land with the first schema: vote T2.9 (node-pg-migrate),
# identity T4.x, commerce T3.6 (Flyway) — G-H answer in docs/decisions.md.
set -euo pipefail
cd "$(dirname "$0")/.."

has_migrations() {
  local d="$1"
  compgen -G "$d/migrations/*.sql" > /dev/null 2>&1 && return 0
  compgen -G "$d/migrations/*.js" > /dev/null 2>&1 && return 0
  compgen -G "$d/migrations/*.cjs" > /dev/null 2>&1 && return 0
  compgen -G "$d/migrations/*.mjs" > /dev/null 2>&1 && return 0
  compgen -G "$d/src/main/resources/db/migration/*.sql" > /dev/null 2>&1 && return 0
  return 1
}

echo "migrate-test: conventions check"
pending=0
for d in services/identity services/voting services/commerce; do
  if has_migrations "$d"; then
    echo "  $d: migrations present — suite bodies required (T2.9/T3.6)"
    pending=1
  else
    echo "  $d: no migrations yet (Phase 0) — suites no-op OK"
  fi
done

if [ "$pending" -ne 0 ]; then
  echo "migrate-test: FAIL — migrations exist but suite bodies are not implemented"
  echo "  (implement fresh-init / upgrade-from-previous / expand-contract first)"
  exit 1
fi

echo "migrate-test: fresh init ........ SKIPPED (no schemas)"
echo "migrate-test: upgrade-from-prev .. SKIPPED (no schemas)"
echo "migrate-test: expand-contract .... SKIPPED (no schemas)"
echo "migrate-test: OK (no-op)"
exit 0