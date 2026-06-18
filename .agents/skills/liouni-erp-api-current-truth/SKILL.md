---
name: liouni-erp-api-current-truth
description: API-specific local-only skill for Liouni ERP. Use when working in this repo to load the repo-local current-truth context, index, and implementation rules without relying on external docs.
---

# Liouni ERP API Current-Truth

Use this skill only inside this repository.

## Local read order
1. `@.agents/context/current-truth.md`
2. `@AGENTS.md`
3. `@docs/api-current-truth-index.md`
4. `@docs/ai/technical-instructions.md`
5. `@README.md`
6. Relevant file in `@docs/tasks/`

## Current truth
- Main ERP lane = GitHub + branch `erp-master`
- Directus = legacy/reference only unless task explicit says legacy scope
- Gitea = historical only
- Old dev domains are not default smoke endpoints
- Removed `liouni-erp-core-*` stacks must not be assumed to exist

## API responsibilities
- backend contract
- auth
- DTOs
- persistence
- business rules
- build / test / smoke evidence

## Working rules
- Follow DB -> API -> UI -> QC
- Inspect current state before edits
- Use Bun/Bunx first
- Be evidence-first
- Do not let historical Directus/Gitea-era docs drive new implementation by default
- No code without a task file under `docs/tasks/`
- Keep task checklist updated in realtime
- Before commit/push, run `bun run lint:check` and `bun run build`
- If backend source changed, run `bunx jest --forceExit` or a narrower affected test scope and report the scope used
- When task docs are stale, verify with code + build/test + git state before correcting status/checklist
- **New Module Registration**: Always verify that newly created NestJS modules (e.g. `feature.module.ts`) are explicitly imported in `src/app.module.ts` to prevent 404 Not Found endpoint errors.
- **TypeScript Build Configuration**: If adding `.ts` files outside of `src/` (e.g. in `scripts/`), ensure the directory is added to the `exclude` array in `tsconfig.build.json`. Otherwise, TypeScript alters the root directory structure in `dist/`, causing the Docker container entrypoint (`dist/main.js`) to fail and return `000` status on health check.
- **Git Commit & Push Process**: When the user requests to "commit and push", determine whether the changes belong to `liouni-erp-web` or `liouni-erp-api` (or both) and execute Git commands inside the respective repository directory. Do not commit/push from the workspace parent.

## Team-scale reminders
- Use `must` only for standards already enforced in this repo; use `prefer` for target-direction conventions.
- Keep domain boundaries clear: controller -> DTO/validation -> service/use-case -> persistence/helper.
- If a new helper/service is created instead of reusing one, note the reason in the task artifact.
- A backend task is not done until validation evidence and commit/push status are recorded.
