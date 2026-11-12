# ERP API Agent Bootstrap

Source of truth for this repo (`./erp-api`).

## Read order

1. `.agents/skills/erp-api-truth/SKILL.md`

## API Specific Agent Mandates

### 1. API Auto-TDD (Test Driven)

- After creating or modifying a service or logic with business rules (tiền, công nợ, tồn kho, khóa `pessimistic_write`, trạng thái chứng từ), you **MUST** generate or update a corresponding `.spec.ts` file covering the happy path and obvious edge cases.
- Luồng nghiệp vụ nhiều bước (netoff hóa đơn, voucher tồn kho, giao dịch có QueryRunner) ưu tiên **integration spec** (`*.integration.spec.ts`) bên cạnh unit spec. Mẫu: `src/erp-invoices-core/services/invoice-netoff-decoupling.integration.spec.ts`, `src/inventory-core/services/inventory-voucher-flow.integration.spec.ts`.
- Controller mỏng (chỉ parse và gọi service) và CRUD đơn giản không bắt buộc spec riêng; phải có test khi thêm logic.

### 2. API Contract DB-First

- Before creating or modifying a DTO (Data Transfer Object) or service logic, you **MUST** check the actual database schema (PostgreSQL) to ensure field names and types match.
- Use the `erp-gate-0-precheck` skill or directly query the database to verify the contract. DO NOT guess database fields.

### 3. Strict Pre-push Hook

- Commit: pre-commit tự chạy lint-staged (eslint, prettier, `jest --findRelatedTests` trên file staged). Không chạy full test thủ công.
- Push: pre-push chạy `bun run type:check`. Do NOT push if it fails.
- Full test / build / check:ci chạy trên GitHub CI (job `check`, `test`, `build`). Không push tiếp khi CI của nhánh đang đỏ.

### 4. Rebase First Conflict Resolution

- When pushing code and encountering a conflict, your **first priority** is to use `git pull --rebase github-industries erp-master`.
- Only if the rebase presents overly complex conflicts, you may `git rebase --abort` and resolve using a standard merge (`git pull origin erp-master`).

### 5. E2E/Smoke Mandate

- Luồng nghiệp vụ nhiều bước (PR/PO, nhân bản, duyệt, tồn kho) phải có unit/integration spec, và smoke trên API đang chạy trong `test/smoke/` khi thay đổi hành vi nghiệp vụ. Ghi vào skill `erp-e2e-api-smoke`.
- Smoke không hardcode mật khẩu hay URL; đọc qua biến môi trường (`E2E_PASSWORD` bắt buộc).
- Mỗi lần chạy smoke/E2E: nếu shell chưa có `E2E_PASSWORD`, đọc dòng `E2E_PASSWORD=` trong `erp-api/.env` (nguồn chuẩn) và nạp vào tiến trình chạy script (xem skill `erp-e2e-api-smoke`). Không in giá trị ra log, không ghi vào repo, không hỏi lại người dùng nếu `.env` đã có.
- Trước khi ghi DB, xác nhận `SELECT current_database();`. Không chạy smoke trên DB production.

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
- **Strict Git Workflow**: You MUST follow the exact commit/push sequence defined below (test -> commit -> pull --rebase -> check:ci -> push, theo `erp-git-workflow`).
- push this repo with `github-industries`
- when debugging localhost, run `bun start:dev` on the port defined by `PORT` in `.env` and log in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env` (đọc giá trị từ `.env`, không ghi vào repo)
- by default, work on the `DATABASE_URL` in `.env` (master; luôn đọc `.env` để xác nhận DB thực tế); use the matching `.env.<tenant>-<stage>` file (greenway/klotus) only when explicitly indicated; scripts must take the env file explicitly (a bare `.env` may point at a production DB)
- before any DB scan or write, run `SELECT current_database();` to confirm the actual DB and report it before writing; never infer the DB from a file name
- reuse existing components/modules/services/DTOs/helpers/utils/functions first
- extend/adapt before forking parallel patterns
- cancel or delete actions must have modal confirm (on UI side)
- delete operations must be soft delete with `isDeleted` flag
  - Ngoại lệ có điều kiện: xóa cứng chứng từ nháp (PO/PR garage) qua quyền `PURGE`, chỉ admin, chặn khi còn bản ghi phụ thuộc. Chi tiết: `.agents/workflows/api-structure.md` mục "Chính sách xóa".
- **NEVER** leave ad-hoc `.ts` files at the repo root (they bypass `tsconfig.build.json` and shift `dist/` output structure from `dist/main.js` to `dist/src/main.js`, crashing the container). Root-level `.ts` files that are not `src/` code must be added to `.gitignore` or deleted before commit.
- After `bun run build`, verify `dist/main.js` exists (not `dist/src/main.js`) before declaring build PASS.

---

## ERP API Rules

### Git Workflow Mandates

1. **Master-First Mandate**: ALL code modifications, features, bug fixes, and refactoring **MUST** be performed and tested on `erp-master` FIRST. Direct commits to downstream branches (`erp-greenway-*`, `erp-klotus-*`) are strictly prohibited.

2. When asked to **commit code**, you MUST execute the following in order:
   - Ensure current branch is `erp-master`
   - `git commit` (pre-commit tự chạy lint-staged và `jest --findRelatedTests` trên file staged; không chạy full test thủ công)

3. When asked to **pull code**, you MUST execute the following in order:
   - If there are uncommitted changes, you MUST execute the full **commit code** sequence first.
   - `git pull --rebase github-industries erp-master` (and resolve conflicts if any)

4. When asked to **push code**, you MUST execute the following in order:
   - If there are uncommitted changes, you MUST execute the full **commit code** sequence first.
   - `git pull --rebase github-industries erp-master` (and resolve conflicts if any)
   - `git push github-industries erp-master` (pre-push chạy `bun run type:check`; full test/build/check:ci chạy trên GitHub CI, theo dõi CI sau khi push)

5. When asked to **sync/deploy to downstream branches** (`erp-greenway-production`, `erp-greenway-staging`, `erp-klotus-*`):
   - First ensure `erp-master` is committed, tested, and pushed to `github-industries erp-master`.
   - Run `../.agents/scripts/sync-branch.sh <target-branch> --push` or follow `erp-git-workflow.md` Scenario 4.
   - Always return back to `erp-master` after syncing.

**Git Execution Context**: You MUST perform all Git operations (add, commit, pull, push) exclusively inside the `erp-api` directory. NEVER run git commands from the workspace root. When pulling or pushing, ALWAYS specify the remote `github-industries` (e.g., `git push github-industries erp-master`).

### Required behavior

- load `@.agents/skills/erp-api-truth/SKILL.md`
- use repo-local context as default guidance
- MUST use bun/bunx exclusively (do NOT use npm)
- when debugging and testing API locally, always start dev on the port defined by `PORT` in `erp/erp-api/.env`
- by default, work on the `DATABASE_URL` in `.env` (master; luôn đọc `.env` để xác nhận DB thực tế); use the matching `.env.<tenant>-<stage>` file (greenway/klotus) only when explicitly indicated; scripts must take the env file explicitly (a bare `.env` may point at a production DB)
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
- plan trình trong hội thoại và chờ `OK`; theo dõi task trên Plane (project KINDU) bằng skill `plane-work-items`. Antigravity Brain chỉ là bản phụ.
- keep task checklist updated in realtime
- if task status in docs drifts from code reality, verify by code + build/test + git state before correcting the artifact

### Architecture & Development Standards

- **TDD**: Prefer Test-Driven Development for new features and non-trivial fixes. If not practical, add or update the nearest affected automated test before closing the task. Ưu tiên integration spec cho luồng nghiệp vụ nhiều bước (xem mục Auto-TDD).
- **Modularity**: Apply a modular mindset to backend code. Split controllers, services, DTOs, mappers, and helper functions by domain responsibility; do not grow "god services".
- **Imports**: Use alias imports. Group 3rd-party imports first, followed by a blank line, then custom code imports.
- **Module boundaries**: New domain work should stay inside `src/<domain>/...`. Cross-domain orchestration is allowed, but hidden coupling and DTO leakage across domains are not.
- **Reuse-first**: Before creating a new helper/service/util, inspect existing code in `src/common/**`, the current domain, and adjacent ERP domains. If creating a new primitive, note the reason in the task.
- **Route v2**: `@Controller('api/v2/<tên thư mục module>')`, một chuỗi, không alias `api/v1` (xem `api-structure`, mục 0a).
- **Response list v2**: `{ items, pagination, summaries?, extraData? }`; dữ liệu phụ chung của list (ví dụ `unreadCount`) đặt trong `extraData`, không thêm key phẳng ở gốc (xem `api-structure`, `references/v2-module.md`).
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
