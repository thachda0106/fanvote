# Walking skeleton — decisions

| # | Decision | Alternatives rejected | Why | Trade-off / limitation |
|---|---|---|---|---|
| D1 | Envoy Gateway v1.9.3 (G-A, ADR-0007) | Kong OSS (no JWKS), APISIX, custom BFF | Gateway API `SecurityPolicy` + `BackendTrafficPolicy` solve JWT/JWKS and per-route limits declaratively | EG control plane + data plane are two moving pieces; CRDs bundled v1.6.1 |
| D2 | Edge JWT `optional: true`, services verify locally | mandatory JWT at edge; trust edge headers | Public reads work without tokens; forged/expired still 401; bypassing the gateway doesn't bypass auth | Every service must keep verifier parity; one more JWKS cache per service |
| D3 | Transactional outbox with claim-then-send | dual write; Debezium CDC; advisory locks | No lost events; one DB; relay pattern reused in Phase 2/3 | At-least-once duplicates; 10-attempt dead rows have no DLQ/alert; 30 s stale-claim latency |
| D4 | Public paths namespaced + `ReplacePrefixMatch` | expose bare contract paths; separate hostnames | One gateway, one port; contracts stay backend truth | Route path errors surface as 404s; rewrite must be kept per route |
| D5 | Analytics dedupe on Mongo `_id` = message id | dedupe collection; Redis keys | Free idempotency with upsert; no extra store | `_id` immutability requires excluding it from `$set`; message id is the only dedupe dimension |
| D6 | Mock IdP with real RS256/JWKS contract | unsigned dev tokens; shared static PEM | Verification path is production-shaped; Phase 4 swaps issuance, not verification | Keypair per process → identity single-replica; no rotation/audit |
| D7 | Commerce DB-less in Phase 1 | stand up PG/Flyway early | Proves routing/observability without schema churn; DB span comes from voting | Inventory is a fixed snapshot; readiness can't test PG yet |
| D8 | Kafka KIND listener (19095–19097) advertised as host.docker.internal | in-cluster Kafka; NodePort per broker; host network | Datastores stay in compose; pods reach them through a pinned gateway IP | Depends on 192.168.65.254 (values override); three advertised addresses to keep aligned |
| D9 | Local rate limits, 60/min analytics | global rate-limit service; 600/min everywhere | Deterministic burst proof; health/metrics untouched | Per-replica buckets multiply under scale; no cross-replica coordination |
| D10 | OTel Java agent, traces only | Spring OTel starter; no commerce tracing | Zero code spans for Spring; keeps three-language trace | Agent adds ~9 s boot; metrics/logs exporters must be disabled or they 404 |
| D11 | Single PG transaction includes outbox insert | outbox in separate DB | Atomicity is the whole point of ADR-0003 | Vote DB becomes the event-dispatch dependency; a PG outage stops publishing |
| D12 | Keep G-I kind pin v1.34.2 | v1.37.0 (booted fine on today's Docker) | Frozen decision; gate must run on the approved image | Loses newer k8s features; revisit G-I deliberately |

## Defects that shaped the current code

1. **Nest DI**: `OutboxRelay` needed `@Injectable()` and `DbService`, not a raw
   `Pool` — an undecorated class gets no `design:paramtypes`, so both deps were
   undefined and the relay crash-looped (`outbox.relay.ts:32-42`).
2. **Trace split**: KafkaJS auto-instrumentation started a root trace and
   overwrote `traceparent`; the send now runs inside
   `context.with(producer span)` (`outbox.relay.ts:198-204`).
3. **Contract drift**: producer headers used CloudEvents `ce_*`; replaced with
   AsyncAPI `commonHeaders` (`outbox.relay.ts:180-196`).
4. **Stale gauge**: backlog gauge was refreshed only after a drain, so a paused
   relay reported zero; now a 5 s interval (`outbox.relay.ts:62-67`).
5. **Gate honesty**: the e2e trace loop could silently skip its assertion
   (`done || fail` checked `sleep`); replaced with `TRACE_OK`
   (`scripts/e2e.sh:142-177`).
6. **NodePort blackhole**: EG's `externalTrafficPolicy: Local` with the proxy
   on a worker broke the kind host mapping; forced `Cluster`
   (`gateway.yaml:18-23`).

## Open decisions (not made here)

- Expired-token e2e coverage (Envoy's exp check is assumed, not tested).
- Global vs local rate limits (Phase 4).
- DLQ/alerting for attempts=10 outbox rows (Phase 5/8).
- Identity replication / key distribution (Phase 4).
- Whether analytics should share the vote PG read model instead of Mongo
  (deferred; Mongo chosen in ADR-0006).
