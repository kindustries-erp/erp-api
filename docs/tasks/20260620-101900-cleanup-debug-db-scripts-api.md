# Task: Cleanup tracked debug DB scripts in API repo

- Scope: remove tracked ad-hoc debug scripts accidentally committed at repo root
- Order: DB -> API -> UI -> QC
- Gate 0 DB: N/A — no schema/runtime mutation

## Status: DONE — verified build + tests PASS 2026-06-20

## Problem

Recent API commits introduced root-level debug scripts that are not part of the ERP API runtime/module structure:
- `check-status.js`
- `do-update.js`
- `query-po-cols.js`
- `update-po-status.js`
- `update-po-status2.js`

These files are ad-hoc DB inspection/update helpers, bypass repo architecture, and create maintenance/security drift if left tracked.

## Checklist

- [x] Inspect whether files are still tracked
- [x] Confirm they are outside module/runtime contract
- [x] Remove tracked debug scripts
- [x] Run build + tests
- [x] Commit + push to `github-industries/erp-master`
- [x] Mark artifact DONE with evidence

## Evidence

- `git ls-files` no longer returns those 5 files
- `bun run build` PASS
- `bunx jest --forceExit` PASS
- Commit: `91edea9` — `chore(cleanup): remove accidentally tracked debug DB scripts from repo root`

## Risk

- Low: files were not imported by Nest module graph
- Rollback: restore files from commit history if they were intentionally needed for one-off operator debugging
