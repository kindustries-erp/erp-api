# Working Contract

## Order
1. DB
2. API
3. UI
4. QC

## Rules
- inspect before edits
- Bun/Bunx first
- evidence-first
- do not use historical Directus/Gitea docs as default guidance
- before commit/push, `cd` into the repo root
- before commit/push, remember to run `bun build`, `bun lint`, and `bun lint:check`
- push this repo with `github-industries`
- when debugging localhost, remember to run `bun start:dev` and use the admin account: `admin@liouni.com` | `admiN@123`
- reuse existing components/modules/services/DTOs/helpers/utils/functions first
- extend/adapt before forking parallel patterns

## Read path
1. `.agents/README.md`
2. `.agents/context/current-truth.md`
3. `.agents/context/working-contract.md`
4. `.agents/tasks/current-lane.md`
5. `AGENTS.md`
6. `docs/ai/technical-instructions.md`
7. `docs/tasks/<relevant>.md`
