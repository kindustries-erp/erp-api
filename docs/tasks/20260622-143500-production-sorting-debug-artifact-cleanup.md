# Task: Production sorting debug artifact cleanup

## Scope
Cleanup tracked debug artifacts accidentally committed during production sorting fix lineage on `erp-master`.

## Related commits
- `1806a1d` — `feat: enhance production orders with server-side sorting for all fields including joined item name and progress`
- `a702977` — `fix(production): simplify progress sorting to fix TypeORM parsing error`
- `0e9aae8` — `chore(core): add global exception filter to expose details for 500 errors`
- `e06188e` — `refactor: migrate file storage from directus to r2 and neon db`

## DB
- No DB schema change in this cleanup.
- DB gate result: `DB_READY` for docs/repo-hygiene-only closure.

## API
- Remove tracked root-level debug artifacts:
  - `test-sort.ts`
  - `error.txt`
- Preserve actual production sorting fix in `src/production-core/production-core.service.ts`.
- Reconcile lane docs so current checkpoint reflects recent API commits after `40dcf62`.

## UI
- No UI change.

## QC / Verification
- `git ls-files error.txt test-sort.ts` proves both files were tracked.
- `bun run check`
- `test -f dist/main.js`
- `git status --short`
- `git log --oneline -10`

## Risk
- Low. Removes non-runtime tracked debug files only.

## Rollback
- `git revert <cleanup-commit>` in `liouni-erp-api` restores both files from history if ever needed for forensic review.

## Status
- DONE — tracked debug artifacts removed; strict API verification passed.
- Commit/Push Status: pending cleanup/docs closure commit.
