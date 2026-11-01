# commerce — Spring Boot 4.1

Order state machine `HELD → AWAITING_PAYMENT → SOLD | RELEASED`, payments
behind a PSP adapter (mock in v2 — **payments simulated**, Q-39), ticket
inventory + issuance (ADR-0001). Store: logical DB `commerce` on `pg-app`
(ADR-0004). `event_id` is an opaque FK (event-config rule).

## Commands

```bash
mvn -q test
mvn -q spring-boot:run -Duser.timezone=UTC     # :8081
# this box: unset tmp before spring-boot:run if the JVM trips on %TMP%
```

## Gotchas (your own Java gotchas — plan T3.1, verified T0.6)

- Parent POM is **`4.1.2`** (a `4.1.x`, never `.RELEASE`).
- Boot 4 starter renames: **`spring-boot-starter-webmvc`** (not `-web`),
  split test starters (**`spring-boot-starter-webmvc-test`**).
- Flyway (Phase 3): `spring-boot-starter-flyway` +
  `org.flywaydb:flyway-database-postgresql`.
- Always `-Duser.timezone=UTC` for run/test (quota math is business-GMT+7,
  storage is UTC).
- Host JDK: `JAVA_HOME` must point at **JDK 21+** (Boot 4 baseline).

## Endpoints (Phase 0 skeleton)

`GET /healthz` · `GET /readyz` · `GET /metrics` — domain endpoints are
contract-first: `contracts/openapi/commerce.yaml` (Phase 3).
