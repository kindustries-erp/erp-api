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
- Trước mỗi lần chạy E2E/smoke: dừng tiến trình đang nghe `PORT` trong `erp/erp-api/.env` nếu đúng là repo này (cwd `erp/erp-api`), rồi chạy lại `bun run start:dev` để đảm bảo code mới nhất. Chi tiết: skill `erp-e2e-api-smoke` mục 3.
- Mỗi lần API test/smoke/E2E: đọc `PORT` trong `erp/erp-api/.env` và đặt `E2E_API_URL=http://localhost:<PORT>`. Web đi kèm theo: API 10001→5171, 10002→5172, 10003→5173 (bảng đầy đủ trong skill `erp-e2e-api-smoke`). Không dùng port mặc định cố định.
- Smoke không hardcode mật khẩu hay URL; đọc qua biến môi trường (`E2E_PASSWORD` bắt buộc).
- Mỗi lần chạy smoke/E2E: nếu shell chưa có `E2E_PASSWORD`, đọc dòng `E2E_PASSWORD=` trong `erp-api/.env` (nguồn chuẩn) và nạp vào tiến trình chạy script (xem skill `erp-e2e-api-smoke`). Không in giá trị ra log, không ghi vào repo, không hỏi lại người dùng nếu `.env` đã có.
- Không chạy smoke trên DB production. Xác nhận DB trước khi ghi theo mục Working Contract.

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

`DB -> API -> UI -> QC`

### Rules

- inspect current state before edits; evidence-first (code state, build/test evidence, git state)
- use repo-local context as default guidance
- MUST use bun/bunx exclusively (do NOT use npm)
- by default, work on the `DATABASE_URL` in `.env` (master; luôn đọc `.env` để xác nhận DB thực tế); use the matching `.env.<tenant>-<stage>` file (greenway/klotus) only when explicitly indicated; scripts must take the env file explicitly (a bare `.env` may point at a production DB)
- before any DB scan or write, run `SELECT current_database();` to confirm the actual DB and report it before writing; never infer the DB from a file name
- when debugging localhost, run `bun start:dev` on the port defined by `PORT` in `.env` and log in with the test accounts `ai-test-tao@example.com` / `ai-test-admin@example.com` using `E2E_PASSWORD` from `.env` (đọc giá trị từ `.env`, không ghi vào repo, không dùng tài khoản admin)
- reuse existing components/modules/services/DTOs/helpers/utils/functions first; extend/adapt before forking parallel patterns
- cancel or delete actions must have modal confirm (on UI side)
- delete operations must be soft delete with `isDeleted` flag
  - Ngoại lệ có điều kiện: xóa cứng chứng từ nháp (PO/PR garage) qua quyền `PURGE`, chỉ admin, chặn khi còn bản ghi phụ thuộc. Chi tiết: `.agents/workflows/erp-api-structure.md` mục "Chính sách xóa".
- **NEVER** leave ad-hoc `.ts` files at the repo root (they bypass `tsconfig.build.json` and shift `dist/` output structure from `dist/main.js` to `dist/src/main.js`, crashing the container). Root-level `.ts` files that are not `src/` code must be added to `.gitignore` or deleted before commit.
- After `bun run build`, verify `dist/main.js` exists (not `dist/src/main.js`) before declaring build PASS.
- if backend source changed, also run `bunx jest --forceExit` or a narrower affected test scope and report which scope was used
- plan trình trong hội thoại và chờ `OK`; theo dõi task trên Plane (project KINDU) bằng skill `plane-work-items`. Antigravity Brain chỉ là bản phụ.
- keep task checklist updated in realtime
- if task status in docs drifts from code reality, verify by code + build/test + git state before correcting the artifact

---

## ERP API Rules

### Git Workflow Mandates

Quy trình chi tiết (commit, pull, push, rebase, conflict) nằm trong skill `erp-git-workflow`. Phần bắt buộc:

1. **Master-First Mandate**: ALL code modifications, features, bug fixes, and refactoring **MUST** be performed and tested on `erp-master` FIRST. Direct commits to downstream branches (`erp-greenway-*`, `erp-klotus-*`) are strictly prohibited. Always check the current branch first.
2. **Commit / pull / push order**: commit (on `erp-master`; pre-commit hook runs lint-staged) → `git pull --rebase github-industries erp-master` (resolve conflicts per mandate 4) → `git push github-industries erp-master` (pre-push hook and CI per mandate 3). If there are uncommitted changes, ALWAYS commit before pull or push.
3. **Sync/deploy to downstream branches** (`erp-greenway-production`, `erp-greenway-staging`, `erp-klotus-*`): first ensure `erp-master` is committed, tested, and pushed to `github-industries erp-master`; run `../.agents/scripts/sync-branch.sh <target-branch> --push` or follow `erp-git-workflow.md` Scenario 4; always return back to `erp-master` after syncing.

**Git Execution Context**: You MUST perform all Git operations (add, commit, pull, push) exclusively inside the `erp-api` directory (`cd ./erp-api` from workspace root). NEVER run git commands from the workspace root. When pulling or pushing, ALWAYS specify the remote `github-industries` (e.g., `git push github-industries erp-master`).

### Architecture & Development Standards

- **TDD**: Prefer Test-Driven Development for new features and non-trivial fixes. If not practical, add or update the nearest affected automated test before closing the task. Ưu tiên integration spec cho luồng nghiệp vụ nhiều bước (xem mục Auto-TDD).
- **Modularity**: Apply a modular mindset to backend code. Split controllers, services, DTOs, mappers, and helper functions by domain responsibility; do not grow "god services".
- **Imports**: Use alias imports. Group 3rd-party imports first, followed by a blank line, then custom code imports.
- **Module boundaries**: New domain work should stay inside `src/<domain>/...`. Cross-domain orchestration is allowed, but hidden coupling and DTO leakage across domains are not.
- **Reuse-first**: Before creating a new helper/service/util, inspect existing code in `src/common/**`, the current domain, and adjacent ERP domains. If creating a new primitive, note the reason in the task.
- **Route v2**: `@Controller('api/v2/<tên thư mục module>')`, một chuỗi, không alias `api/v1` (xem `erp-api-structure`, mục 0a).
- **Response list v2**: `{ items, pagination, summaries?, extraData? }`; dữ liệu phụ chung của list (ví dụ `unreadCount`) đặt trong `extraData`, không thêm key phẳng ở gốc (xem `erp-api-structure`, `references/v2-module.md`).
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
