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
- do not use historical Directus/Gitea docs as default guidance
- before commit/push, `cd` into the repo root
- before commit/push, remember to run `bun build`, `bun lint`, and `bun lint:check`
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
1. `.agents/README.md`
2. `.agents/context/current-truth.md`
3. `.agents/context/working-contract.md`
4. `.agents/tasks/current-lane.md`
5. `AGENTS.md`
6. `docs/ai/technical-instructions.md`
7. `docs/tasks/<relevant>.md`
