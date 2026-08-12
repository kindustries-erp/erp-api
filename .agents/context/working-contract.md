# Working Contract

## Order
1. DB
2. API
3. UI
4. QC

## Rules
- inspect before edits
- MUST use bun/bunx exclusively (do NOT use npm)
- evidence-first
- before commit/push, `cd` into the repo root (`./erp-api`)
- **Strict Git Workflow**: You MUST follow the exact commit/push sequence defined in your `.agents/rules/` file (pull -> build -> check:ci -> test -> commit -> push).
- push this repo with `github-industries`
- when debugging localhost, remember to run `bun start:dev` on port 10010 and use the admin account: `admin@liouni.com` | `admiN@123`
- by default, always work on ERP_MASTER_DATABASE_URL unless ERP_KLTOUS_STAGING_DATABASE_URL or ERP_KLTOUS_MASTER_DATABASE_URL is explicitly indicated
- reuse existing components/modules/services/DTOs/helpers/utils/functions first
- extend/adapt before forking parallel patterns
- cancel or delete actions must have modal confirm (on UI side)
- delete operations must be soft delete with `isDeleted` flag
- **NEVER** leave ad-hoc `.ts` files at the repo root (they bypass `tsconfig.build.json` and shift `dist/` output structure from `dist/main.js` to `dist/src/main.js`, crashing the container). Root-level `.ts` files that are not `src/` code must be added to `.gitignore` or deleted before commit.
- After `bun run build`, verify `dist/main.js` exists (not `dist/src/main.js`) before declaring build PASS.

## Read path
1. `.agents/context/current-truth.md`
2. `.agents/context/working-contract.md`
3. `.agents/tasks/current-lane.md`
4. `AGENTS.md`
5. `.agents/rules/ai-instructions/technical-instructions.md`
6. `.agents/tasks/<relevant>.md`
