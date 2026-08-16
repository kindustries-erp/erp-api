# Liouni ERP API Agent Bootstrap

Source of truth for this repo (`./erp-api`).

## Read order

1. `.agents/skills/liouni-erp-api-current-truth/SKILL.md`

## API Specific Agent Mandates

### 1. API Auto-TDD (Test Driven)

- After creating or modifying a core function, service, controller, or critical logic, you **MUST** generate a corresponding `.spec.ts` file.
- The unit test must cover the happy path and any obvious edge cases.

### 2. API Contract DB-First

- Before creating or modifying a DTO (Data Transfer Object) or service logic, you **MUST** check the actual database schema (PostgreSQL) to ensure field names and types match.
- Use the `erp-gate-0-precheck` skill or directly query the database to verify the contract. DO NOT guess database fields.

### 3. Strict Pre-push Hook

- Before running `git push`, you **MUST** run `bun run check:ci` and `bun run test` (or the equivalent test script for API).
- Do NOT push if any of these commands fail. Fix the issues first.

### 4. Rebase First Conflict Resolution

- When pushing code and encountering a conflict, your **first priority** is to use `git pull --rebase github-industries erp-master`.
- Only if the rebase presents overly complex conflicts, you may `git rebase --abort` and resolve using a standard merge (`git pull origin erp-master`).

---

## Current Truth

- Main ERP lane hiện tại: **GitHub + branch `erp-master`**
- Repo này là API repo của lane active.
- Old dev domains không phải current-truth endpoints mặc định.

### Repo role

- backend contract
- auth
- DTOs
- persistence
- business rules
- build/test/smoke evidence cho API lane

---

## Working Contract

### Order

1. DB
2. API
3. UI
4. QC

### Rules

- inspect before edits
- MUST use bun/bunx exclusively (do NOT use npm)
- evidence-first
- before commit/push, `cd` into the repo root (`./erp-api`)
- **Strict Git Workflow**: You MUST follow the exact commit/push sequence defined below (pull -> build -> check:ci -> test -> commit -> push).
- push this repo with `github-industries`
- when debugging localhost, remember to run `bun start:dev` on port 10010 and use the admin account: `admin@liouni.com` | `admiN@123`
- by default, always work on ERP_MASTER_DATABASE_URL unless ERP_KLTOUS_STAGING_DATABASE_URL or ERP_KLTOUS_MASTER_DATABASE_URL is explicitly indicated
- reuse existing components/modules/services/DTOs/helpers/utils/functions first
- extend/adapt before forking parallel patterns
- cancel or delete actions must have modal confirm (on UI side)
- delete operations must be soft delete with `isDeleted` flag
- **NEVER** leave ad-hoc `.ts` files at the repo root (they bypass `tsconfig.build.json` and shift `dist/` output structure from `dist/main.js` to `dist/src/main.js`, crashing the container). Root-level `.ts` files that are not `src/` code must be added to `.gitignore` or deleted before commit.
- After `bun run build`, verify `dist/main.js` exists (not `dist/src/main.js`) before declaring build PASS.

---

## Liouni ERP API Rules

Apply to all work in this repo.

### Git Workflow Mandates

When asked to **commit code**, you MUST execute the following in order:
1. `bun run build`
2. `bun run check:ci`
3. `bun run test`
4. `git commit`

When asked to **pull code**, you MUST execute the following in order:
1. If there are uncommitted changes, you MUST execute the full **commit code** sequence first (build -> check:ci -> test -> commit).
2. `git pull --rebase github-industries erp-master` (and resolve conflicts if any)

When asked to **push code**, you MUST execute the following in order:
1. If there are uncommitted changes, you MUST execute the full **commit code** sequence first (build -> check:ci -> test -> commit).
2. `git pull --rebase github-industries erp-master` (and resolve conflicts if any)
3. `bun run build`
4. `bun run check:ci`
5. `bun run test`
6. `git push github-industries erp-master`

**Git Execution Context**: You MUST perform all Git operations (add, commit, pull, push) exclusively inside the `erp-api` directory. NEVER run git commands from the workspace root. When pulling or pushing, ALWAYS specify the remote `github-industries` (e.g., `git push github-industries erp-master`).

### Required behavior

- load `@.agents/skills/liouni-erp-api-current-truth/SKILL.md`
- use repo-local context as default guidance
- MUST use bun/bunx exclusively (do NOT use npm)
- when debugging and testing API locally, always start dev on port 10010
- by default, always work on ERP_MASTER_DATABASE_URL unless ERP_KLTOUS_STAGING_DATABASE_URL or ERP_KLTOUS_MASTER_DATABASE_URL is explicitly indicated
- follow DB -> API -> UI -> QC
- inspect current state before edits
- use evidence-first wording
- before push/commit, `cd` vào root của repo hiện tại (`./erp-api` từ workspace root)
- **Strict Git Workflow**: You MUST follow the `Git Workflow Mandates` defined above for all commits and pushes.
- if backend source changed, also run `bunx jest --forceExit` or a narrower affected test scope and report which scope was used
- push with `github-industries`
- always check branch 1st when push. all commit must be push on erp-master 1st, then I will create PR to another branch
- reuse existing components/modules/services/DTOs/helpers/utils/functions first
- extend/adapt before duplicating
- manage all task execution, planning, and verification in Antigravity Brain (`implementation_plan.md` -> `walkthrough.md`)
- keep task checklist updated in realtime
- if task status in docs drifts from code reality, verify by code + build/test + git state before correcting the artifact

### Architecture & Development Standards

- **TDD**: Prefer Test-Driven Development for new features and non-trivial fixes. If not practical, add or update the nearest affected automated test before closing the task.
- **Modularity**: Apply a modular mindset to backend code. Split controllers, services, DTOs, mappers, and helper functions by domain responsibility; do not grow "god services".
- **Imports**: Use alias imports. Group 3rd-party imports first, followed by a blank line, then custom code imports.
- **Module boundaries**: New domain work should stay inside `src/<domain>/...`. Cross-domain orchestration is allowed, but hidden coupling and DTO leakage across domains are not.
- **Reuse-first**: Before creating a new helper/service/util, inspect existing code in `src/common/**`, the current domain, and adjacent ERP domains. If creating a new primitive, note the reason in the task.
- **Definition of done**: A backend task is not done until task checklist is updated, validation evidence is recorded, and commit/push status is stated clearly.

### Teamwork guardrails

- Use `must` only for standards already enforced or verified in this repo; use `prefer` for target-direction conventions.
- When introducing a new module, record registration points explicitly: module file, controller path, `src/app.module.ts`, DTO/validation, and affected Web contract.
- If response shape or route path changes, call out required Web follow-up in the task artifact before closing.

### Anti-drift / anti-patterns

- Do not reference non-existent bootstrap files.
- Do not let historical docs override repo-local current truth.
- Do not duplicate business logic in multiple services when a shared domain helper or mapper is enough.
- Do not report a task DONE from docs alone; verify with code state, build/test evidence, and git state.

### Historical warning

If a file mentions Directus-first flows, Gitea deploys, old dev domains, or `erp-core`, classify it first.
Only repo-local current-truth docs should drive new implementation by default.
