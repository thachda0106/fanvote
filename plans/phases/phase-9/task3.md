# Task 9.3 — Teardown (same day) + cost record

**Phase:** 9 · **ID:** T9.3 · **Depends on:** T9.2 · **cloud rule applies**

## Objective

Zero orphaned resources; a recorded duration + total cost for the report.

## Subtasks

- [ ] User runs the `DELETE-PLAYBOOK.md` commands in order (numbered report).
- [ ] AI verifies:
  - `aws eks describe-cluster` → **not found**;
  - **zero leftover ELB/SG/NAT/GatewayLB** — note: the in-tree service
    controller creates **CLASSIC ELBs → check `aws elb`, not `aws elbv2`**
    (your learn-eks lesson);
  - `aws rds describe-db-instances`, `aws elasticache ...`,
    `aws ecr describe-repositories` (decide: delete images too?), secrets
    deleted or explicitly retained;
  - S3 state bucket empty/deleted if used.
- [ ] Record: teardown wall-clock duration + **total cost of the lab**
      (control plane hours + data + NAT + RDS hours) into
      `docs/capacity.md` / report inputs.
- [ ] Any resource that resists deletion → documented reason + manual step
      (never "we'll get it later").

## Done when

- Verification commands all confirm absence; cost + duration recorded;
  zero known orphans.

## Verification

```bash
aws eks describe-cluster ...            # not found
aws elb describe-load-balancers ...     # empty  (classic ELBs!)
aws ec2 describe-nat-gateways --filter Name=state,Values=available   # empty
```
