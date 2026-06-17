---
name: liouni-erp-api-current-truth
description: API-specific local-only skill for Liouni ERP. Use when working in this repo to load the repo-local current-truth context, index, and implementation rules without relying on external docs.
---

# Liouni ERP API Current-Truth

Use this skill only inside this repository.

## Local read order
1. `@docs/ai/current-truth-context.md`
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
- **New Module Registration**: Always verify that newly created NestJS modules (e.g. `feature.module.ts`) are explicitly imported in `src/app.module.ts` to prevent 404 Not Found endpoint errors.
- **TypeScript Build Configuration**: If adding `.ts` files outside of `src/` (e.g. in `scripts/`), ensure the directory is added to the `exclude` array in `tsconfig.build.json`. Otherwise, TypeScript alters the root directory structure in `dist/`, causing the Docker container entrypoint (`dist/main.js`) to fail and return `000` status on health check.
- **Git Commit & Push Process**: When the user requests to "commit and push", you MUST determine whether the changes belong to `liouni-erp-web` or `liouni-erp-api` (or both) and execute the Git commands inside the respective repository directory. BEFORE committing, you MUST run `bun lint:check` to ensure there are no linting errors.
