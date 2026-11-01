# Task 10.2 — Interview packaging (DA + STAR + CV)

**Phase:** 10 · **ID:** T10.2 · **Depends on:** T10.1, all Explain gates

## Objective

Convert the artifact into the three interview formats — defensible because
you personally passed every Explain gate.

## Subtasks

- [ ] **1 DA answer:** `DA12 polyglot microservices rebuild` — boundaries,
      contracts-only seam, outbox/Kafka, saga, chaos/SLOs, **and ground rule 1
      out loud**: "at day-job scale I'd ship a modular monolith; microservices
      here is justified by greenfield + learning + independent deploy
      evidence."
- [ ] **3 STAR stories** (each already seeded in a learning doc):
  1. serialised checkout (v1 R-14 → stable-order locking, Phase 3);
  2. SCAN trap (v1 6.26 s → SET index + MGET, Phase 2);
  3. contract-first polyglot (spectral + oasdiff + conformance harness, Phase 0/2).
- [ ] **CV bullet:** "rebuilt as 4-service polyglot platform (Nest/Spring/
      FastAPI/Next) on EKS, proven at N RPS / p95 < 200 ms, chaos-tested" —
      N from `source: eks` rows only.
- [ ] **Frontend evidence:** LHCI performance/CLS/LCP numbers as its own
      bullet or sub-claim.
- [ ] Archive: `docs/reviews/` complete (architecture, security, performance),
      `docs/learning/` complete per the phase mapping.

## Done when

- DA answer rehearsed and recorded; 3 STAR stories written with the 6-point
  Explain structure; CV bullet cites only sourced numbers.

## Verification

- Mock defense: answer each story's "what breaks at 10× / what's the
  alternative / why this" without notes.
