# Task 9.1 — Terraform (design → applied by you)

**Phase:** 9 · **ID:** T9.1 · **Depends on:** T8.3, gate 5 · **cloud rule applies**

## Objective

Infrastructure as code, with a delete playbook written BEFORE anything is
created.

## Subtasks

- [ ] Create `infra/terraform/` modules:
  - **ECR** — 4 image repos (+ lifecycle policy);
  - **EKS** — terraform-aws-modules or eksctl, **k8s 1.34**, 2–3 node groups;
  - **RDS PG Multi-AZ ×2** — `commerce` DB + `vote` DB with **`postgis`
    extension** enabled (T2.5);
  - **ElastiCache Redis**;
  - **Kafka** — Strimzi operator on EKS (default) or MSK per gate 5;
  - **Secrets Manager** (identity keys per T4.1) + external-secrets wiring;
  - **ALB (+ Cloud Map)** for the gateway ingress.
- [ ] **`DELETE-PLAYBOOK.md` with full resource inventory BEFORE any apply**
      (your lab pattern): every resource, its CLI delete command, order,
      expected time, verification command.
- [ ] Ordered apply report: numbered commands the user runs one at a time,
      each with expected output + verification step.
- [ ] State: local or S3+lock (decide; S3 adds resources → delete playbook
      covers them; document choice).
- [ ] Region hard-locked to `ap-southeast-1` in provider config.
- [ ] Post-apply: `make deploy-eks` (helm install with `values-eks.yaml`),
      images pushed to ECR.

## Done when

- User runs the numbered report → cluster + datastores healthy; delete
  playbook inventory complete and reviewed BEFORE the first apply.

## Verification

```bash
aws eks describe-cluster --name eventista-v2 --region ap-southeast-1   # ACTIVE
```
