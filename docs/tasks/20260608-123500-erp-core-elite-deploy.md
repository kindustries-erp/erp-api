# Task — ERP Core Elite deploy lane

## Request Input
- Type: DEPLOYMENT
- Goal: create separate Elite deploy lane for `erp-core` API with Gitea Actions, stack wrapper, and docs update.

## Gate 0 — DB Precheck
- Collections/tables: TypeORM ERP core business tables in liouni-erp DB
- Result: DB_READY (no schema mutation in this task)

## Checklist
- [x] Inspect existing staging workflow and runtime
- [x] Create separate erp-core stack/workflow
- [x] Deploy and verify on Elite
- [x] Update docs

## Evidence
- Stack wrapper created: `/opt/stacks/liouni-erp-core-api`
- Runtime env: Postgres/Neon + local JWT auth (`DATABASE_URL`, `JWT_*`, no Directus runtime env)
- Workflow created: `.gitea/workflows/deploy-erp-core.yml`
- Local runtime verify:
  - `http://127.0.0.1:10010/api/v1/auth/profile` -> `401`
- Public runtime verify:
  - `https://api.erp-core.liouni.com/api/v1/auth/profile` -> `401`
- NPM route verify on Head:
  - `api.erp-core.liouni.com` -> `100.75.67.115:10010`
- Container verify:
  - `liouni-erp-core-api` Up
