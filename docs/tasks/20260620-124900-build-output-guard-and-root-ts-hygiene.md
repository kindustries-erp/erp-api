# Task: Harden API build-output guard against rogue root TypeScript files

> **Created:** 2026-06-20
> **Lane:** erp-master
> **Repo:** `liouni-erp-api`
> **Status:** IN_PROGRESS

## Scope
- Verify and harden API build config so stray root `.ts` files do not change Nest build output path unexpectedly
- Update agent/build rules to prevent recurrence
- Audit tracked root probe/debug files for follow-up hygiene note

## DB
- No DB/schema change

## API
- Review `tsconfig.build.json` exclude coverage
- Add explicit guard for root-level scratch/test files if needed
- Add rule/checklist so build output remains `dist/main.js`

## UI
- N/A

## QC
- `bun run build`
- verify output entry path under `dist/`
- verify current rules/docs mention the guard

## Risks
- Over-broad exclude may hide legitimate build inputs if mis-scoped

## Rollback
- Revert the hardening commit in `liouni-erp-api`

## Checklist
- [ ] inspect current tsconfig/build behavior
- [ ] harden exclude/guard as needed
- [ ] update agent contract / docs
- [ ] verify build output path
- [ ] update artifact to DONE with evidence
