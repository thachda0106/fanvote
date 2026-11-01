# Task 3.1 — Service skeleton done RIGHT (your own Java gotchas)

**Phase:** 3 · **ID:** T3.1 · **Depends on:** T0.6 (pins)

## Objective

Get Boot 4 mechanics right the first time — the failure modes are already
known from v1 notes.

## Subtasks

- [ ] Spring Initializr → project in `services/commerce/`.
- [ ] **pom parent version patch:** `4.1.2` (NOT `4.1.0.RELEASE`).
- [ ] Boot 4 renamed starters: `spring-boot-starter-webmvc`, split `-test`
      starters — verify each artifact exists (T0.6 proof).
- [ ] Flyway = `spring-boot-starter-flyway` + `flyway-database-postgresql`.
- [ ] Run config: `-Duser.timezone=UTC` in the run/maven config; document
      `unset tmp` before `spring-boot:run` on this box (in
      `services/commerce/README.md`).
- [ ] Wire `/healthz`, `/readyz` (503 when degraded), `/metrics` (RED),
      logback JSON, correlation id, OTel agent — same "service done" checklist
      as T1.6.
- [ ] Dockerfile multi-stage + image builds in CI matrix.

## Done when

- `make -C services/commerce lint test` green; image builds; health endpoints
  behave per T1.6 checklist.

## Verification

```bash
mvn -q -f services/commerce/pom.xml verify && docker build services/commerce
```
