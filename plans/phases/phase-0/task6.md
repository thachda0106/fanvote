# Task 0.6 — Version pin verification

**Phase:** 0 · **ID:** T0.6 · **Depends on:** G-I · **Kills C6**

## Objective

Prove every pinned version exists and every Boot-4 gotcha is real, before
scaffold code depends on them.

## Subtasks

- [x] Pin exact versions in each manifest (no `^`/`latest` on critical deps):
  Spring Boot parent **4.1.x**, NestJS **11**, Next.js **15** (deliberate:
  decide 15 vs 16 once — G-I), FastAPI pins, kind node
  **v1.34.2** (cgroup v1 hard-refuses k8s ≥ 1.35 on this box). OTel SDK
  pins land with the tracing work in T1.4.
- [x] Verify Boot 4 facts and record them in `docs/decisions.md`:
  parent version `4.1.2` (NOT `.RELEASE`); renamed starters (`webmvc`,
  split `-test` starters); Flyway = `spring-boot-starter-flyway` +
  `flyway-database-postgresql`.
- [x] Verify gateway image per G-A resolves (release v1.9.3; Helm chart
      version pinned at T1.2 install).
- [x] Record `-Duser.timezone=UTC` and `unset tmp` before `spring-boot:run`
      in `services/commerce/README`.
- [x] Note versions in the plan if any differ — update plan § Tech stack
      (Boot parent reconciled to `4.1.2`).

## Done when

- One dependency install per stack succeeds with pinned versions; decisions
  doc lists every pin with a one-line proof.

## Verification

```bash
npm ci / mvn -q dependency:resolve / uv sync   # all succeed with pins
```
