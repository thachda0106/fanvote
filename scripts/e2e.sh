#!/usr/bin/env bash
# Phase 1 walking-skeleton gate (T1.2/T1.4/T1.5/T1.6):
#   - one traced vote request gateway -> voting -> PG (sync chain in Jaeger)
#   - analytics doc visible in Mongo < 1 s after the vote
#   - relay pause => outbox backlog grows; resume => doc appears (no loss)
#   - async consumer span joins the SAME trace id (Kafka traceparent)
#   - forged JWT rejected at the edge; /healthz, /readyz, /metrics on all four
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
NAMESPACE="${NAMESPACE:-eventista}"
EVENT_ID="e2e00000-0000-4000-8000-000000000001"
CANDIDATE_ID="3f0a1c2e-0000-4000-8000-000000000001"
TRACE_ID="$(openssl rand -hex 16)"
SPAN_ID="$(openssl rand -hex 8)"
REQUEST_ID="e2e-$(openssl rand -hex 4)"
PIDS=()

cleanup() {
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

forward() { # svc local remote
  kubectl -n "$NAMESPACE" port-forward "svc/$1" "$2:$3" >/dev/null 2>&1 &
  PIDS+=("$!")
}

wait_health() { # port
  for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:$1/healthz" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  fail "port-forward on $1 did not become healthy"
}

wait_gateway() {
  for _ in $(seq 1 30); do
    code="$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "$BASE_URL/api/v1/votes/events" || true)"
    [ "$code" = "200" ] && return 0
    sleep 1
  done
  fail "gateway not reachable at $BASE_URL"
}

count_items() {
  curl -fsS "$BASE_URL/api/v1/analytics/events/$EVENT_ID/activity" |
    python -c 'import json,sys; print(len(json.load(sys.stdin)["items"]))'
}

mint_token() {
  curl -fsS -X POST "$BASE_URL/api/v1/identity/auth/test-token" \
    -H 'content-type: application/json' \
    -d '{"sub":"fan-e2e"}' |
    python -c 'import json,sys; print(json.load(sys.stdin)["accessToken"])'
}

cast_vote() { # traceparent header value
  curl -sS -o /dev/null -w '%{http_code}' -X POST \
    "$BASE_URL/api/v1/votes/events/$EVENT_ID/votes" \
    -H "authorization: Bearer $TOKEN" \
    -H 'content-type: application/json' \
    -H "x-request-id: $REQUEST_ID" \
    -H "traceparent: $1" \
    -d "{\"candidateId\":\"$CANDIDATE_ID\",\"points\":3}"
}

wait_items() { # min-count timeout-seconds
  local min="$1" deadline=$((SECONDS + $2))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if [ "$(count_items)" -ge "$min" ]; then
      return 0
    fi
    sleep 0.1
  done
  return 1
}

echo "== Phase 1 e2e =="
kubectl -n "$NAMESPACE" get gateway eventista >/dev/null || fail "gateway not deployed"
wait_gateway

forward voting 13002 3002
forward identity 13001 3001
forward commerce 13081 8081
forward analytics 18001 8001
forward jaeger 16686 16686
wait_health 13002
wait_health 13001
wait_health 13081
wait_health 18001

echo "-- mint token + forged-token rejection"
TOKEN=""
for _ in $(seq 1 5); do
  TOKEN="$(mint_token || true)"
  [ -n "$TOKEN" ] && break
  sleep 1
done
[ -n "$TOKEN" ] || fail "mock IdP returned no token"
FORGED="${TOKEN%????}AAAA"
CODE="$(curl -s -o /dev/null -w '%{http_code}' -H "authorization: Bearer $FORGED" \
  "$BASE_URL/api/v1/identity/users/me")"
[ "$CODE" = "401" ] || fail "forged JWT returned $CODE (want 401)"

echo "-- sync path: traced vote request"
BASELINE="$(count_items)"
CODE="$(cast_vote "00-$TRACE_ID-$SPAN_ID-01")"
[ "$CODE" = "201" ] || fail "vote returned $CODE (want 201)"

echo "-- async path: analytics doc < 1 s"
START_MS=$(($(date +%s%N) / 1000000))
wait_items "$((BASELINE + 1))" 1 || fail "analytics doc not visible within 1 s"
ELAPSED_MS=$(($(date +%s%N) / 1000000 - START_MS))
echo "   doc visible after ${ELAPSED_MS}ms"

echo "-- negative: relay pause => backlog; resume => no loss"
BASELINE="$(count_items)"
curl -fsS -X POST "http://127.0.0.1:13002/__test/relay/pause" >/dev/null ||
  fail "relay pause endpoint unavailable"
CODE="$(cast_vote "00-$TRACE_ID-$(openssl rand -hex 8)-01")"
[ "$CODE" = "201" ] || fail "vote while paused returned $CODE"
sleep 0.8
BACKLOG="$(curl -fsS "http://127.0.0.1:13002/__test/relay/backlog" |
  python -c 'import json,sys; print(json.load(sys.stdin)["backlog"])')"
[ "${BACKLOG:-0}" -ge 1 ] || fail "outbox backlog did not grow while paused"
curl -fsS -X POST "http://127.0.0.1:13002/__test/relay/resume" >/dev/null ||
  fail "relay resume endpoint unavailable"
# Non-traced doc also lands in the same activity feed after resume.
wait_items "$((BASELINE + 1))" 5 || fail "paused vote was lost after relay resume"

echo "-- trace chain (gateway -> voting -> PG + async analytics)"
TRACE_OK=0
for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:16686/api/traces/$TRACE_ID" |
    python -c '
import json, sys
try:
    data = json.load(sys.stdin).get("data") or []
except Exception:
    raise SystemExit(1)
if not data:
    raise SystemExit(1)
trace = data[0]
names = [p.get("serviceName", "") for p in trace.get("processes", {}).values()]
spans = trace.get("spans", [])
has_gateway = any("envoy" in n.lower() for n in names) or any(
    any(t.get("key") == "component" and t.get("value") == "proxy" for t in s.get("tags", []))
    for s in spans
)
has_service = any("voting" in n.lower() for n in names)
has_db = any(
    s.get("operationName", "").startswith("pg.")
    or any(t.get("key") == "db.system" for t in s.get("tags", []))
    for s in spans
)
has_consumer = any("analytics" in n.lower() for n in names)
if not (has_gateway and has_service and has_db and has_consumer):
    print(f"waiting: gateway={has_gateway} service={has_service} db={has_db} consumer={has_consumer}")
    raise SystemExit(1)
print(f"   trace spans ok: services={sorted(set(names))}")
'; then
    TRACE_OK=1
    break
  fi
  sleep 0.5
done
[ "$TRACE_OK" = "1" ] || fail "trace $TRACE_ID missing gateway/service/db/consumer spans"

echo "-- observability endpoints (curl smoke)"
for pair in "13001 identity" "13002 voting" "13081 commerce" "18001 analytics"; do
  set -- $pair
  for path in healthz readyz metrics; do
    CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$1/$path")"
    [ "$CODE" = "200" ] || fail "$2 /$path returned $CODE"
  done
done

echo "PHASE 1 E2E: PASS (trace $TRACE_ID, doc ${ELAPSED_MS}ms)"
