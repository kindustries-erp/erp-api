---
name: liouni-erp-api-current-truth
description: API-specific local-only skill for Liouni ERP. Use when working in this repo to load the repo-local current-truth context, runtime contract, and implementation rules for the active ERP API lane.
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
- Main ERP API lane = branch `erp-master`
- Database contract = Postgres runtime thật, xác minh qua `DATABASE_URL`
- API contract phải bám schema, constraint, relation, và runtime config đang dùng thật
- Build, test, và smoke evidence phải lấy từ repo/runtime hiện hành của lane này
- Không suy đoán từ note cũ, mock data, hoặc status task chưa verify lại

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
- No code without a task file under `docs/tasks/`
- Keep task checklist updated in realtime
- **Strict Git Workflow**: Follow the exact sequence: pull -> build -> check:ci -> test -> commit -> push (see rules for exact trigger definitions).
- If backend source changed, run `bunx jest --forceExit` or a narrower affected test scope and report the scope used
- When task docs are stale, verify with code + build/test + git state before correcting status/checklist
- Query Postgres directly through the active `DATABASE_URL` before changing DTOs, filters, persistence, or business rules
- **New Module Registration**: Always verify that newly created NestJS modules (e.g. `feature.module.ts`) are explicitly imported in `src/app.module.ts` to prevent 404 Not Found endpoint errors.
- **TypeScript Build Configuration**: If adding `.ts` files outside of `src/` (e.g. in `scripts/`), ensure the directory is added to the `exclude` array in `tsconfig.build.json`. Otherwise, TypeScript alters the root directory structure in `dist/`, causing the runtime entrypoint (`dist/main.js`) to fail.
- **Git Commit & Push Process**: When the user requests to "commit and push", determine whether the changes belong to `liouni-erp-web` or `liouni-erp-api` (or both) and execute Git commands inside the respective repository directory. Do not commit/push from the workspace parent.

## Team-scale reminders
- Use `must` only for standards already enforced in this repo; use `prefer` for target-direction conventions.
- Keep domain boundaries clear: controller -> DTO/validation -> service/use-case -> persistence/helper.
- If a new helper/service is created instead of reusing one, note the reason in the task artifact.
- A backend task is not done until validation evidence and commit/push status are recorded.
