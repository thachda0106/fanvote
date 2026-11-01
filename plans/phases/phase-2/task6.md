# Task 2.6 — SSE live leaderboard (G-E)

**Phase:** 2 · **ID:** T2.6 · **Depends on:** T2.3, G-E decision

## Objective

Push live leaderboard updates to fans — owner = vote service (it owns the
Redis leaderboard), per G-E.

## Subtasks

- [ ] Create `GET /api/v1/events/{id}/stream` (SSE) in vote:
  - initial snapshot event, then updates on change (Redis keyspace/pubsub or
    a short poll loop feeding the stream — pick and document);
  - heartbeat comment every 15 s; `Cache-Control: no-transform` to defeat
    proxy buffering;
  - auth: same JWT pre-filter path as other vote routes.
- [ ] Gateway check: long-lived connections survive the G-A gateway
      (buffering, timeouts, rate-limit interaction). If the gateway mangles
      SSE → **document evidence in ADR-0001** and fall back to 1 s polling
      client-side (G-E fallback); polling must work regardless.
- [ ] Contract: stream endpoint (or polling alternative) in
      `contracts/openapi/vote.yaml`; SSE media type documented.
- [ ] Load note: SSE connections count against gateway/connection limits —
      record a connection-density data point (e.g. 1k concurrent streams) in
      `docs/capacity.md` with `source: kind-local`.

## Done when

- Test: client receives ≥ 2 pushed updates during 2 votes (or polling fallback
  proven with the same assertions); gateway behavior evidence recorded.

## Verification

```bash
make e2e   # stream test: vote → update observed < 1s (or polling fallback)
```
