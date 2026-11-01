# eventista v2 — root Makefile (source of truth for commands; see `make help`)
# Gates are lazy/cumulative (plan ground rule 7):
#   Phase 0+: lint, test, contract
#   Phase 1+: e2e, smoke, kind-up, deploy-kind
#   Phase 2+: load, seed
#   Phase 3+: migrate-test becomes real
#   Phase 5.5+: web-lighthouse
#   Phase 6+: chaos

SHELL := bash
.DEFAULT_GOAL := help

OASDIFF := .tools/bin/oasdiff$(if $(findstring Windows_NT,$(OS)),.exe,)
OASDIFF_VERSION := 1.35.0
SERVICES_JS := services/identity services/voting

.PHONY: help install up down lint test contract e2e migrate-test load \
	web-lighthouse chaos kind-up deploy-kind smoke tools seed fmt

help: ## list targets with one-line descriptions
	@grep -E '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

tools: ## fetch contract tooling (oasdiff) if missing
	@if [ ! -x "$(OASDIFF)" ]; then \
		echo "fetching oasdiff $(OASDIFF_VERSION)…"; \
		mkdir -p .tools/bin; \
		if [ "$(OS)" = "Windows_NT" ]; then \
			curl -sL -o .tools/oasdiff.tgz "https://github.com/oasdiff/oasdiff/releases/download/v$(OASDIFF_VERSION)/oasdiff_$(OASDIFF_VERSION)_windows_amd64.tar.gz" && \
			tar -xzf .tools/oasdiff.tgz -C .tools/bin && rm .tools/oasdiff.tgz; \
		else \
			curl -sL -o .tools/oasdiff.tgz "https://github.com/oasdiff/oasdiff/releases/download/v$(OASDIFF_VERSION)/oasdiff_$(OASDIFF_VERSION)_linux_amd64.tar.gz" && \
			tar -xzf .tools/oasdiff.tgz -C .tools/bin && rm .tools/oasdiff.tgz; \
		fi; \
	fi

install: ## install deps for contract tooling + all four services
	npm install --no-fund --no-audit
	@for d in $(SERVICES_JS); do echo "-- $$d"; (cd $$d && npm install --no-fund --no-audit); done
	@echo "-- services/commerce"; mvn -q -f services/commerce/pom.xml -DskipTests dependency:resolve
	@echo "-- services/analytics"; cd services/analytics && uv sync

up: ## start local datastores + services (docker compose, full profile)
	docker compose up -d --build

down: ## stop compose stack
	docker compose down

lint: ## lint all four services + contract specs
	npm run contract:lint
	@for d in $(SERVICES_JS); do echo "-- $$d lint"; (cd $$d && npm run lint); done
	@echo "-- services/commerce lint"; mvn -q -f services/commerce/pom.xml -DskipTests compile
	@echo "-- services/analytics lint"; cd services/analytics && uv run ruff check app tests

test: ## unit tests for all four services
	@for d in $(SERVICES_JS); do echo "-- $$d test"; (cd $$d && npm test); done
	@echo "-- services/commerce test"; mvn -q -f services/commerce/pom.xml test
	@echo "-- services/analytics test"; cd services/analytics && uv run pytest -q

contract: tools ## spectral + ownership + oasdiff breaking vs baseline + asyncapi evolution
	npm run contract:lint
	npm run contract:ownership
	@for f in identity vote commerce analytics; do \
		echo "-- oasdiff breaking $$f"; \
		"$(OASDIFF)" breaking --fail-on ERR contracts/baseline/$$f.yaml contracts/openapi/$$f.yaml; \
	done
	npm run contract:asyncapi-breaking

migrate-test: ## fresh init · upgrade-from-previous · expand-contract (no-op on empty schemas until Phase 2/3)
	bash scripts/migrate-test.sh

e2e: ## Phase 1+: kind + full stack + trace assertion + async doc <1s
	@echo "STUB: make e2e starts in Phase 1 (walking skeleton)" && exit 0

load: ## Phase 2+: k6 vs the phase target (relative numbers locally, G-C)
	@echo "STUB: make load starts in Phase 2 (vote-ramp)" && exit 0

web-lighthouse: ## Phase 5.5+: LHCI perf ≥ 90, CLS < 0.1 (stub mode)
	@echo "STUB: make web-lighthouse starts in Phase 5.5" && exit 0

chaos: ## Phase 6+: failure modes executable; every alert fired by Phase 8
	@echo "STUB: make chaos starts in Phase 6" && exit 0

kind-up: ## Phase 1+: kind cluster (kindest/node:v1.34.2 — cgroup v1 pin)
	@echo "STUB: make kind-up starts in Phase 1 (Task 1.1)" && exit 0

deploy-kind: ## Phase 1+: load images into kind + helm install
	@echo "STUB: make deploy-kind starts in Phase 1 (Task 1.2)" && exit 0

smoke: ## Phase 1+: 10 RPS through gateway to every service
	@echo "STUB: make smoke starts in Phase 1 (Task 1.2)" && exit 0

seed: ## Phase 2+: test-data factory (users, events, k6 cohorts)
	@echo "STUB: make seed starts in Phase 2 (Task 2.1)" && exit 0

fmt: ## format contract tooling sources
	npx prettier --write scripts/*.mjs contracts/*.yaml 2>/dev/null || true