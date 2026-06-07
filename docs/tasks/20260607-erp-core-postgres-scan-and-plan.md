# ERP Core Postgres Scan and Plan

- [x] Read AGENTS.md
- [x] Read docs/ai/technical-instructions.md
- [x] Read README.md
- [x] Confirm scope with PM/user
- [ ] Inspect existing API module structure and Directus dependency footprint
- [ ] Define keep/remove scope for erp-core
- [ ] Define Postgres-only architecture and migration strategy
- [ ] Write detailed planning artifact under /opt/docs/ai/liouni-erp/artifacts
- [ ] Handoff summary with phased delivery plan

## Scope
- Planning/audit only.
- No code changes in this turn.
- Need evidence-first scope split for new erp-core repo/branch.

## Gate 0
- Source DB schema: inspect from directus-staging first.
- Expected result: DB_GAP_FOUND for target erp-core until local auth + business schema are provisioned in standalone Postgres.
