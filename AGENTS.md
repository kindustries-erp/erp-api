<!-- GENERATED FILE - DO NOT EDIT. Gộp từ: AGENTS.md (workspace root), erp/AGENTS.md, erp/erp-api/.agents/AGENTS.md. Sửa nguồn rồi chạy /sync-agents. -->
<!-- Đường dẫn tương đối ở phần workspace và family tính từ workspace root; từ repo này dùng ../../ để lên root. -->

---

<!-- Nguồn: AGENTS.md (workspace root) -->

# Multi-Family Workspace Router

**ROUTING & RULES ONLY:** This is the single source of truth for this multi-family workspace (Liouni ERP + Klotus). Application-specific implementation rules live in each family or repo router, not here.

This workspace contains two independent application families: Liouni ERP (multi-module backend) and Klotus (public warranty & landing page).

---

## 🧭 Family Routing

Mandatory reading order when working on a specific family:

- **ERP** (API or Web): load 👉 [`./erp/AGENTS.md`](./erp/AGENTS.md), then the repo router:
  - Backend API: [`./erp/erp-api/.agents/AGENTS.md`](./erp/erp-api/.agents/AGENTS.md) + [`./erp/erp-api/CLAUDE.md`](./erp/erp-api/CLAUDE.md)
  - Frontend Web: [`./erp/erp-web/.agents/AGENTS.md`](./erp/erp-web/.agents/AGENTS.md) + [`./erp/erp-web/CLAUDE.md`](./erp/erp-web/CLAUDE.md)
- **Klotus** (Landing Page API or Web): load 👉 [`./klotus/AGENTS.md`](./klotus/AGENTS.md), then:
  - Landing API: [`./klotus/landing-page-api/.agents/AGENTS.md`](./klotus/landing-page-api/.agents/AGENTS.md)
  - Landing Web: [`./klotus/landing-page-web/.agents/AGENTS.md`](./klotus/landing-page-web/.agents/AGENTS.md)

---

## 🛡️ Critical Guardrails (MUST FOLLOW)

### No Root Pushing
- **FORBIDDEN**: Running `git add`, `git commit`, or `git push` from workspace root or intermediate directories (`./erp`, `./klotus`).
- **REQUIRED**: `cd` into the concrete child repository before any git operation:
  - `./erp/erp-api` (API changes)
  - `./erp/erp-web` (frontend changes)
  - `./klotus/landing-page-api` (Klotus API)
  - `./klotus/landing-page-web` (Klotus web)

### Tool Standards
- **BUN ONLY**: Use `bun` / `bunx` exclusively. NEVER use `npm` or `yarn`.
- **No Manual Containers**: Do NOT build or start production deployment containers on the local machine.
- **Local Dev Only**: Use `bun run start:dev` / `bun run dev` for local testing.

### Branch & Deployment Strategy
- **ERP**: Work on `erp-master` FIRST, then sync downstream to `erp-greenway-*`, `erp-klotus-*`.
- **Klotus**: Work on `master` branch.
- **Delivery Sequence**: `Database (Phase 1)` → `API Backend (Phase 2)` → `Web Frontend (Phase 3)` → `QC (Phase 4)`.
- **Remote**: Always push to `github-industries`.

### Database & Environment
- **By Default**: Dùng `DATABASE_URL` trong `.env` (DB `erp_local` trên `db-dev.liouni.com:5433`) làm DB master. Tenant khác dùng file `.env.<tenant>-<stage>` tương ứng với nhánh deploy (`greenway-production`, `greenway-staging`, `klotus-production`, `klotus-staging`). Không có biến `ERP_MASTER_DATABASE_URL`; `.env` trần có thể đang trỏ DB production nên luôn kiểm tra `DATABASE_URL` trước khi chạy script, và script phải nhận file env tường minh.
- **Xác nhận DB**: trước khi quét hoặc ghi DB, chạy `SELECT current_database();` để biết DB thực tế, báo anh tên DB trước khi ghi; không suy ra DB từ tên file.
- **Context Isolation**: Do NOT mix databases, `.env`, or schema between ERP and Klotus.
- **Verify Runtime**: Read the actual `.env` before making changes (no outdated assumptions).

### Pre-Commit/Push Checklist
Before committing or pushing, run in order:
```bash
bun run build
bun run check:ci
bun run test  # or: bunx jest --forceExit (for API)
git commit
git push github-industries [target-branch]
```

---

## 📋 Workflow Catalog (single source of truth)

Each workflow is a slash command (e.g. `/plan-and-task`, `/erp-git-workflow`). Claude command stubs in `.claude/commands/` are generated from the canonical file; only edit the originals in `.agents/workflows/`. After changing anything in `.agents/`, run `/sync-agents`.

Global workflows in `./.agents/workflows/`:

- `sync-agents.md` — sync `.agents` sang `.claude` và `.trae` bằng `sync-agents.sh`.
- `routing.md` — workspace routing.
- `plan-and-task.md` — plan, approval, execution, and checkpoint workflow.
- `clean-brain.md` — session and plan cleanup.
- `erp-git-workflow.md` — ERP master-first Git workflow.
- `erp-web-v2-refactor.md` — ERP Web v2 migration workflow.
- `api-service-refactor.md` — ERP API service/controller refactoring.
- `standardize-table.md` — ERP table standardization.
- `ui-atomic-refactor.md` — UI atomic refactoring.

ERP workflows in `./erp/.agents/workflows/`:

- `erp-branch-sync-workflow.md` — sync `erp-master` to downstream branches.

Repo-level workflows (e.g. `erp/erp-web/.agents/workflows/standardize-drawer.md`) are listed in each repo's own router.

---

## 🚀 Quick Reference: Common Scenarios

### Scenario 1: Starting a New Feature / Refactor / Bugfix
1. Load `/plan-and-task` workflow.
2. Execute **5 phases**: Discovery → Tech Plan → Task Breakdown (X.Y.Z) → Approval → Execution.
3. Create `implementation_plan.md` with clear DoD and verification commands.
4. Use Antigravity Brain (`walkthrough.md` for execution tracking).
5. Update the task checklist in realtime as you progress.
6. When done: update the Module Skill (`erp/erp-api/.agents/skills/modules/<module>/SKILL.md` or `erp/erp-web/.agents/skills/modules/<module>/SKILL.md`).

### Scenario 2: Committing & Pushing Code (ERP)
1. Load `/erp-git-workflow` workflow.
2. Ensure you're on `erp-master`.
3. Run the pre-push checklist (build, check:ci, test), then `git commit` and `git push github-industries erp-master`.
4. If conflict: `git pull --rebase github-industries erp-master`.

### Scenario 3: Building a Data Table (ERP Web)
1. Load `/standardize-table` workflow.
2. Follow 4 steps: Table component, Header Filters, Server-side API call, STT 1-based, QC.
3. Use existing `SpreadsheetPageTemplate` and `DataTable` components.
4. Verify filter, sort, pagination work end-to-end.

### Scenario 4: Building a Form Drawer (ERP Web)
1. Load `/standardize-drawer` workflow.
2. Follow 4 steps: StandardFormDrawer, Responsive sizing (`vw`), Collapsible sections, Top tabs.
3. Ensure form fields use proper validation and translation keys.

### Scenario 5: Refactoring Large Service (ERP API)
1. Load `/api-service-refactor` workflow.
2. Scan file sizes: Controller >300 LoC, Service >500 LoC.
3. Choose a pattern: Sub-Controllers, Sub-Services Facade, Pure Engine.
4. Maintain 100% backward compatibility via the Facade pattern.
5. Use a clean DI constructor (NO overloading / union types).
6. Add unit tests co-located with each sub-service.

---

## 📚 Skills & Module Knowledge

- All skills are registered in [`./.agents/skills.json`](./.agents/skills.json) and organized by repo:
  - `erp/erp-api/.agents/skills/` — Backend skills (DB migrate, module scanning, deployment)
  - `erp/erp-web/.agents/skills/` — Frontend skills (UI pattern detection, components)
  - `klotus/landing-page-api/.agents/skills/` — Klotus API skills
  - `klotus/landing-page-web/.agents/skills/` — Klotus web skills
- Module knowledge: `erp/erp-api/.agents/skills/modules/<module-name>/SKILL.md` (backend) or `erp/erp-web/.agents/skills/modules/<module-name>/SKILL.md` (frontend).
- Before modifying any core module, read its SKILL.md first. After schema/API changes, update it with `scan-module-knowledge` or manually.

---

## 🧠 Brain & Planning

- Create `implementation_plan.md` for every feature/refactor/bugfix.
- Use `walkthrough.md` for real-time execution tracking.
- Save progress in `.agents/` ➔ Antigravity Brain (Claude Code internal storage).
- Use `/clean-brain` periodically to clean old sessions.
- **Pause**: document current state in `## ⏸️ Session Checkpoint`.
- **Resume**: read the checkpoint to identify exactly where you left off.

---

## 🔗 Canonical Routers

- **Workspace canonical router**: [`./.agents/AGENTS.md`](./.agents/AGENTS.md)
- **ERP Family**: [`./erp/AGENTS.md`](./erp/AGENTS.md)
- **Klotus Family**: [`./klotus/AGENTS.md`](./klotus/AGENTS.md)
- **Validate agent system**: `bash ./.agents/scripts/validate-agent-system.sh`

---

## ⚠️ Common Anti-Patterns (AVOID)

- ❌ Don't run git from workspace root or intermediate directories
- ❌ Don't mix ERP (`erp-master`) and Klotus (`master`) branches
- ❌ Don't use `npm` or `yarn` (use `bun`/`bunx` only)
- ❌ Don't hardcode strings in UI (use i18n translation keys)
- ❌ Don't start with code before creating an `implementation_plan.md`
- ❌ Don't leave ad-hoc `.ts` files at repo root (breaks `dist/` output structure)
- ❌ Don't reference outdated docs (always verify with actual code state)
- ❌ Don't mix database schemas, `.env`, or domain models between ERP and Klotus
- ❌ Don't commit code without running the pre-push checklist (build, check:ci, test)

---

## 🎯 Hierarchy

1. **Workspace** (`CLAUDE.md` → `AGENTS.md`) — guardrails, routing, workflow catalog
2. **Family** (`./erp/AGENTS.md`, `./klotus/AGENTS.md`) — family rules
3. **Repo** (`./erp/erp-api/CLAUDE.md`, etc.) — repo mandates
4. **Workflow** (`.agents/workflows/`) — executable procedures
5. **Module** (`erp/erp-*/.agents/skills/modules/*/SKILL.md`) — domain knowledge

**Always read in order** when starting work on a specific part of the codebase.

---

<!-- Nguồn: erp/AGENTS.md -->

# Liouni ERP Family Agent Entry

Entry point for AI agents working in the Liouni ERP family (thư mục `erp/` trong workspace root). Workspace-level rules and the global workflow catalog live in `../AGENTS.md`.

## Child Repositories

| Việc | Vào repo | Rule chi tiết |
|------|----------|---------------|
| Backend (NestJS, TypeORM, PostgreSQL) | `./erp-api` (Remote `github-industries`, branch `erp-master`) | [`./erp-api/.agents/AGENTS.md`](./erp-api/.agents/AGENTS.md) |
| Frontend (React, Vite, React Query) | `./erp-web` (Remote `github-industries`, branch `erp-master`) | [`./erp-web/.agents/AGENTS.md`](./erp-web/.agents/AGENTS.md) |

Skills nằm ở `erp-api/.agents/skills/` và `erp-web/.agents/skills/`, đăng ký trong `./.agents/skills.json`. Đọc `liouni-erp-*-current-truth/SKILL.md` của repo trước khi sửa code.

## Strict Guardrails

1. **MASTER-FIRST**: Mọi thay đổi (feature, bugfix, refactor, UI, config) phải làm và test trên `erp-master` trước. Commit trực tiếp vào `erp-greenway-*` hoặc `erp-klotus-*` bị cấm. Sync xuống nhánh downstream theo workflow merge chuẩn (`git merge erp-master`).
2. **NO ROOT PUSHING**: Cấm chạy `git add`, `git commit`, `git push` từ `./erp` hoặc workspace root. Luôn `cd` vào `./erp-api` hoặc `./erp-web`.
3. **Delivery Sequence**: `DB -> API -> UI -> QC`.
4. **Tooling**: Chỉ dùng `bun` / `bunx`. Không dùng `npm` hay `yarn`.
5. **Local Dev Only**: Dev local chạy `bun run start:dev` / `bun run dev` (API port 10010). Không build container thủ công.
6. **Isolation**: ERP dùng nhánh `erp-master`, Klotus dùng `master`. Không trộn database, `.env`, schema hay collection (`klotus_*`) giữa hai hệ.
7. **Pre-commit/push**: `bun run build`, `bun run check:ci`, `bun run test` (API: `bunx jest --forceExit`), theo đúng thứ tự.

## ERP Workflows

Workflow ERP nằm ở `./.agents/workflows/`:

- `erp-branch-sync-workflow.md` — sync `erp-master` sang nhánh downstream.
- `routing.md`, `clean-brain.md`, `erp-web-v2-refactor.md`.

Workflow global (`plan-and-task.md`, `erp-git-workflow.md`, `standardize-table.md`, `api-service-refactor.md`, `ui-atomic-refactor.md`, ...) xem catalog ở `../AGENTS.md`.

Kế hoạch và verify theo Antigravity Brain: `implementation_plan.md` -> `walkthrough.md`, cập nhật checklist realtime.

## TypeORM Query Relations

Khi dùng `relations` trong `find`, `findAndCount`, ... phải kiểm tra relation đã khai báo trong entity với decorator tương ứng (`@OneToMany`, `@ManyToOne`, `@OneToOne`, `@ManyToMany`). Thiếu sẽ gây lỗi 500 `EntityPropertyNotFoundError` lúc runtime.

---

<!-- Nguồn: erp/erp-api/.agents/AGENTS.md -->

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
- by default, work on the `DATABASE_URL` in `.env` (DB `erp_local`, master); use the matching `.env.<tenant>-<stage>` file (greenway/klotus) only when explicitly indicated; scripts must take the env file explicitly (a bare `.env` may point at a production DB)
- before any DB scan or write, run `SELECT current_database();` to confirm the actual DB and report it before writing; never infer the DB from a file name
- reuse existing components/modules/services/DTOs/helpers/utils/functions first
- extend/adapt before forking parallel patterns
- cancel or delete actions must have modal confirm (on UI side)
- delete operations must be soft delete with `isDeleted` flag
- **NEVER** leave ad-hoc `.ts` files at the repo root (they bypass `tsconfig.build.json` and shift `dist/` output structure from `dist/main.js` to `dist/src/main.js`, crashing the container). Root-level `.ts` files that are not `src/` code must be added to `.gitignore` or deleted before commit.
- After `bun run build`, verify `dist/main.js` exists (not `dist/src/main.js`) before declaring build PASS.

---

## Liouni ERP API Rules

### Git Workflow Mandates

1. **Master-First Mandate**: ALL code modifications, features, bug fixes, and refactoring **MUST** be performed and tested on `erp-master` FIRST. Direct commits to downstream branches (`erp-greenway-*`, `erp-klotus-*`) are strictly prohibited.

2. When asked to **commit code**, you MUST execute the following in order:
   - Ensure current branch is `erp-master`
   - `bun run build`
   - `bun run check:ci`
   - `bun run test` (or `bunx jest --forceExit`)
   - `git commit`

3. When asked to **pull code**, you MUST execute the following in order:
   - If there are uncommitted changes, you MUST execute the full **commit code** sequence first.
   - `git pull --rebase github-industries erp-master` (and resolve conflicts if any)

4. When asked to **push code**, you MUST execute the following in order:
   - If there are uncommitted changes, you MUST execute the full **commit code** sequence first.
   - `git pull --rebase github-industries erp-master` (and resolve conflicts if any)
   - `bun run build`
   - `bun run check:ci`
   - `bun run test` (or `bunx jest --forceExit`)
   - `git push github-industries erp-master`

5. When asked to **sync/deploy to downstream branches** (`erp-greenway-production`, `erp-greenway-staging`, `erp-klotus-*`):
   - First ensure `erp-master` is committed, tested, and pushed to `github-industries erp-master`.
   - Run `../.agents/scripts/sync-branch.sh <target-branch> --push` or follow `erp-git-workflow.md` Scenario 4.
   - Always return back to `erp-master` after syncing.

**Git Execution Context**: You MUST perform all Git operations (add, commit, pull, push) exclusively inside the `erp-api` directory. NEVER run git commands from the workspace root. When pulling or pushing, ALWAYS specify the remote `github-industries` (e.g., `git push github-industries erp-master`).

### Required behavior

- load `@.agents/skills/liouni-erp-api-current-truth/SKILL.md`
- use repo-local context as default guidance
- MUST use bun/bunx exclusively (do NOT use npm)
- when debugging and testing API locally, always start dev on port 10010
- by default, work on the `DATABASE_URL` in `.env` (DB `erp_local`, master); use the matching `.env.<tenant>-<stage>` file (greenway/klotus) only when explicitly indicated; scripts must take the env file explicitly (a bare `.env` may point at a production DB)
- before any DB scan or write, run `SELECT current_database();` to confirm the actual DB and report it before writing; never infer the DB from a file name
- follow DB -> API -> UI -> QC
- inspect current state before edits
- use evidence-first wording
- before push/commit, `cd` vào root của repo hiện tại (`./erp-api` từ workspace root)
- **Strict Git Workflow**: You MUST follow the `Git Workflow Mandates` defined above for all commits and pushes (Master-First).
- if backend source changed, also run `bunx jest --forceExit` or a narrower affected test scope and report which scope was used
- push with `github-industries`
- always check branch 1st when push. All modifications must be developed and pushed on `erp-master` 1st, then merged/synced downstream to other branches.
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
