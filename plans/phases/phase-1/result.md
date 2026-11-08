# Phase 1 — execution result

**Executed:** 2026-11-08 · **Status:** gate GREEN · phase not yet closed
(owner Explain gate + Phase 0 owner items pending)

## Gate

```text
make kind-up     → 3/3 nodes Ready (kindest/node:v1.34.2, G-I pin)
make deploy-kind → Envoy Gateway v1.9.3 + 4 images loaded + helm release deployed
make smoke       → checks 100% (112/112) · forged JWT 401 · rate_limited 54–107 (429s)
make e2e         → PHASE 1 E2E: PASS (trace e8544359…, doc 549 ms)
make lint        → 0 (contract lint · eslint ×2 · mvn compile · ruff)
make test        → 0 (identity 3/3 · voting 4/4 · commerce 5/5 · analytics 12/12)
```

E2E assertions (all green):

- one k6/curl trace contains Envoy spans + voting spans + `pg.*` DB spans;
- `vote.cast` doc visible in Mongo in **≤ 1 s** (549 ms, 582 ms, 840 ms runs);
- relay pause → DB-truth backlog > 0 → resume → doc appears (no loss);
- the analytics consumer span is in the **same trace id** as the vote
  request (W3C `traceparent` through Kafka headers);
- `/metrics` and `/healthz` return 404 at the edge (Q-22);
- two Envoy replicas, same token, 20/20 requests 200 (no stickiness).

## Per-task results

| Task | Result | Artifact |
|---|---|---|
| T1.1 | kind config (1 CP + 2 workers, 8080→30080, 8443→30081, pinned v1.34.2); `kind-up` idempotent; `kind-load` builds + loads 4 images | `deploy/helm/kind-config.yaml` · `Makefile` |
| T1.2 | GatewayClass + EnvoyProxy (telemetry + NodePort patch) + Gateway + 4 HTTPRoutes + SecurityPolicy + 4 BackendTrafficPolicies; k6 smoke | `deploy/helm/eventista/**` · `load/k6/smoke.js` |
| T1.3 | RS256 mock IdP (keypair on boot, JWKS, test-token, local verification everywhere); forged → 401; 2 gateway replicas no stickiness | `services/identity/src/auth/**` · decisions P1-1 |
| T1.4 | OTel in Nest ×2, FastAPI, Java agent; collector → Jaeger; `traceparent` through gateway and Kafka; trace assertion in e2e | `scripts/e2e.sh` · `docs/learning/observability.md` |
| T1.5 | outbox in the vote transaction, `UPDATE…RETURNING` claim, producer/consumer spans joined, Mongo upsert on message id, pause/resume no-loss assertion | `services/voting/src/outbox/**` · `services/analytics/app/consumers/vote_cast.py` |
| T1.6 | JSON logs + request-id across 3 languages, RED metrics on `/metrics`, typed error envelopes, health/readiness split, edge blocklist, curl smoke in e2e | each service · `docs/learning/observability.md` |

## Defects found and fixed during the phase

1. `OutboxRelay` had no `@Injectable()` and injected a raw `Pool` → relay
   crashed every 100 ms; now takes `DbService`.
2. KafkaJS auto-instrumentation started a root trace and overwrote
   `traceparent`, splitting the async trace; send now runs inside
   `context.with(producer span)`.
3. Producer headers used CloudEvents `ce_*` names; now they match AsyncAPI
   `commonHeaders`.
4. Outbox backlog gauge was only refreshed by a drain → stale while paused;
   now refreshed every 5 s, and e2e reads a test-only DB-truth endpoint.
5. e2e trace loop could silently skip its assertion (`done || fail` bound to
   `sleep`); replaced with an explicit success flag.
6. Envoy Service defaulted to `externalTrafficPolicy: Local`; NodePort
   blackholed when the proxy pod was not on the kind entry node → forced
   `Cluster`.
7. Analytics activity check asserted `sub` while identity returns `id`;
   smoke burst overlapped the smoke scenario → scenario spacing fixed.

## Deviations from plan text (recorded, not re-opened)

1. **Kind image:** an interim recreate came up v1.37.0 because the config had
   lost its image pin. The cluster was re-created on the G-I pin
   (`kindest/node:v1.34.2`) and the full gate re-run on it.
2. **Health through the gateway:** T1.2 wording says "health of every
   service"; Q-22 keeps `/healthz|/readyz|/metrics` unrouted. Smoke hits one
   contract route per service; e2e checks health/metrics via port-forward.
3. **Analytics rate limit = 60/min** (others 600/min) so the burst proof is
   deterministic; Phase 4 tunes real limits.
4. **`make kind-load`** exists as its own target (T1.1 asked for it);
   `deploy-kind` depends on it.
5. **Commerce DB-less in Phase 1** (fixed inventory snapshot); the DB span is
   voting's outbox insert. Flyway/PG is T3.6.
6. **Kafka KIND listeners added** (19095–19097, advertised
   `host.docker.internal`) because compose pods cannot use the `localhost`
   EXTERNAL listener.

## Open items / risks

- **Owner:** Phase 0 items still open (initial commit/push → CI green, Phase 0
  Explain defense). Phase 1 Explain gate is recorded as pending in
  `docs/learning/observability.md`.
- **Expired-token rejection** is not exercised end-to-end (forged is).
- **JWKS cold-start** fails closed with a 401 if the first fetch times out
  (seen once after a control-plane restart).
- **Local rate limits** are per Envoy replica (N replicas = N × limit).
- **Docker Desktop port proxy** occasionally blackholes the kind host port
  after a container recreate; restarting the kind node container re-registers
  it. Documented in the learning file.
- **Memory:** Docker Desktop is ~5.8 GiB; the plan floor is 16 GB. The stack
  fits only because commerce is DB-less in Phase 1.
