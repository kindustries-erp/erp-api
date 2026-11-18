---
name: erp-api-truth
description: Ngữ cảnh hiện hành của erp-api (backend NestJS của ERP) - lane giao hàng, hợp đồng DB/API, tooling, quy trình git/CI, bản đồ module và checklist bảo mật (references/security-baseline.md). Load đầu tiên trước mọi task trong erp-api. Với việc tổ chức lại code hoặc refactor, dùng skill erp-api-structure.
---

# ERP API — Current Truth

Chỉ dùng trong repo `erp/erp-api`. Skill này chỉ giữ ngữ cảnh ngắn và các rule đã kiểm chứng. Chi tiết nằm ở file được trỏ tới, không sao chép lại.

## 1. Đọc theo thứ tự

1. `.agents/AGENTS.md` — router và mandates của API (Auto-TDD, DB-first, pre-push).
2. `README.md`.
3. Plan và task hiện hành: Plane, project KINDU (skill `plane-work-items`). Antigravity Brain (`implementation_plan.md`, `walkthrough.md`) chỉ là bản phụ.

## 2. Lane và trạng thái

- Lane giao hàng chính: branch `erp-master`. Repo `erp/erp-api` đang ở `erp-master`.
- Thứ tự giao hàng: DB → API → UI → QC.
- Đẩy code chỉ từ `erp/erp-api`, không từ thư mục workspace cha.
- Không suy đoán từ note cũ, mock data hay trạng thái task chưa xác minh. Trước khi sửa status, đối chiếu code + build/test + git state.

## 3. Hợp đồng DB và runtime

- Nguồn sự thật về schema là Postgres runtime, truy cập qua `DATABASE_URL`. Mẫu cấu hình nằm trong `.env.example`. Không ghi credential thật vào repo.
- Endpoint PostgreSQL chuẩn (cập nhật 2026-11-14): Production DB đặt tại `db-elite.liouni.com:5432` (trên Elite); Dev DB đặt tại `db-dev.liouni.com:5433` (trên Dev). Không dùng domain cũ `db.liouni.com`.
- Trước khi đổi DTO, filter, persistence hoặc business rule: query trực tiếp DB để xác nhận tên cột, kiểu dữ liệu, constraint và relation. Skill hỗ trợ: `erp-gate-0-precheck`.
- Không đoán tên field.

## 4. Tooling

- Dùng `bun` / `bunx`. Stack: NestJS, TypeORM, Jest.
- Script trong `package.json`:
  - `type:check` = `tsc --noEmit`
  - `check:ci` = tsc + eslint `--max-warnings=0` + `prettier --check`
  - `build` = `nest build && tsc-alias`
  - `test` = `jest`
- Jest: `rootDir: src`, `testRegex: .*\.spec\.ts$`. Khi đổi source backend, chạy `bunx jest --forceExit` hoặc scope hẹp hơn, và ghi rõ scope đã chạy.
- `tsconfig.build.json` loại trừ `test`, `dist`, `**/*spec.ts`, `scripts`, `*.ts` ở root. Thêm file `.ts` nằm ngoài `src/` thì phải thêm thư mục đó vào `exclude`, nếu không `dist/main.js` sẽ lệch đường dẫn.

## 5. Git, hook và CI (đã đối chiếu với `.husky/` và `.github/workflows/`)

- **pre-commit**: `bunx lint-staged` (eslint, prettier, `jest --findRelatedTests` trên file đã stage).
- **pre-push**: `bun run type:check`. Chỉ bypass bằng `SKIP_TESTS=1` hoặc `HUSKY_SKIP_TESTS=1` khi đã verify thủ công. Không dùng để bỏ qua lỗi thật.
- **CI `pipeline-erp-master.yml`** (trigger push và PR vào `erp-master`):
  - Type, Lint & Format: `bun run check:ci`
  - Unit tests: `bunx jest --forceExit`
  - Build: `bun run build`
  - Build & push image
  - Deploy qua Komodo
- Luồng chuẩn: test → commit → `git pull --rebase` → push. Không push khi CI của nhánh đang đỏ. Chi tiết: skill `erp-git-workflow`.
- Chỉ commit/push khi user yêu cầu, và chỉ trong đúng repo con (`erp-api`).

## 6. Trách nhiệm của tầng API

Backend contract, auth, DTO, persistence, business rule, bằng chứng build/test/smoke.

## 7. Quy tắc làm việc

- Plan theo `/erp-plan` (cơ chế plan của agent). Chỉ làm sau khi user xác nhận `OK`. Theo dõi task trên Plane bằng skill `plane-work-items`.
- Module NestJS mới phải được import trong `src/app.module.ts`, nếu không endpoint sẽ 404.
- Mỗi thay đổi service, controller hoặc logic quan trọng phải có `.spec.ts` đi kèm (Auto-TDD, theo `.agents/AGENTS.md`).
- Dùng `must` cho chuẩn đã được enforce trong repo, `prefer` cho hướng đi mục tiêu.
- Phân tầng: controller → DTO/validation → service/use-case → persistence/helper.
- Endpoint mới hoặc sửa auth, upload, DTO, xử lý lỗi, truy vấn SQL: đối chiếu `references/security-baseline.md` (guard, DTO class thay vì `any`, giới hạn upload, secret không có giá trị mặc định, không lộ lỗi nội bộ) và ghi mục đã kiểm khi báo xong.
- Nếu tạo helper hoặc service mới thay vì dùng lại cái cũ, ghi lý do vào task.
- Task chỉ xong khi có bằng chứng validate và trạng thái commit/push.

## 8. Cấu trúc code và refactor

Playbook tách Controller/Service, scanner kích thước file và generator module v2 nằm trong skill `erp-api-structure`. Không tự refactor khi chưa có yêu cầu hoặc task đã được duyệt.

## 9. Bản đồ module

Tài liệu chi tiết của từng module nằm tại `.agents/skills/modules/<module>/SKILL.md`. Mỗi file mô tả DB, DTO, API, business rule và quan hệ cross-module.

- **Sản xuất & BOM**: `production-core`, `bom-core`
- **Bán hàng & sau bán hàng**: `erp-sales-orders`, `sales-report-dashboard`, `after-sales`
- **Mua hàng & nhà cung cấp**: `purchasing`, `purchasing-report-dashboard`, `erp-suppliers`
- **Kho & tồn kho**: `inventory-dashboard`, `erp-inventory-items`, `erp-inventory-stock`, `erp-inventory-tracking`, `erp-inventory-transactions`, `erp-inventory-adjustments`, `erp-inventory-vouchers`, `goods-receipts-core`
- **Tài chính, dòng tiền, hóa đơn**: `bank-statement`, `cashflow-dashboard`, `erp-invoice`, `invoice-netoff`, `invoice-dashboard`, `invoice-debts`, `journal-entry`, `settings-accounts`
- **Garage**: `garage-cases`, `garage-customers`, `garage-dashboard`, `garage-cashflow`, `garage-bank-reconciliation`, `garage-invoice-reconciliation`, `garage-goods-receipts`, `garage-opex`, `operating-expenses`, `cases-garage` (v2, `api/v2/cases-garage`), `debts-garage` (v2, `api/v2/debts-garage`), `debts-core` (lõi `src/v2/core/debts-core`), `cashflow-vouchers-core` (lõi `src/v2/core/cashflow-vouchers-core`, entity base + abstract command/query phiếu thu chi), `cashflow-vouchers-garage` (v2, `api/v2/cashflow-vouchers-garage`, đọc), `debts-flow-garage` (v2, orchestrator ghi thu chi + phân bổ, mirror/projector V1)
- **Phụ tùng VinFast**: `vinfast-parts-stock`, `vinfast-parts-dashboard`
- **Đối tác**: `business-partners-core` (lõi `src/v2/core/business-partners-core`, module `src/v2/modules/business-partners-management`)
- **Nhân viên (v2)**: `employees-core` (lõi `src/v2/core/employees-core`, module `src/v2/modules/employees-management`, route `/api/v2/employees`, bảng `employees_management`; V1 `erp_employees` đóng băng)
- **Chi nhánh**: `branches-core` (lõi base-only `src/v2/core/branches-core`, module `src/v2/modules/branches-management`, bảng `branches_management` đổi tên từ `erp_branches`, view tương thích `erp_branches` tạm thời, `DELETE` xóa mềm; consumers import `BranchManagement` từ module; route `/api/v2/branches`)
- **Xác thực v2**: `auth-sessions` (lõi `src/v2/core/auth-core`, module `src/v2/modules/auth-sessions`, route `/api/v2/auth-sessions`, bảng `auth_sessions`; người dùng từ `users_management`; v1 `/api/v1/auth` chạy song song, dùng chung JWT)
- **Thông báo (v2, theo user, không RBAC)**: `notifications-inbox` (`/api/v2/notifications-inbox`, bảng `notifications_inbox`; job xóa cứng định kỳ; base dùng chung ở lõi `notifications-core`)
- **AI Hub v2**: `ai-hub-v2` (lõi `src/v2/core/ai-hub-core`; module `ai-hub-gateway` gọi 9router theo tier từ `NINE_ROUTER_TIER_MODELS`, `items-core` (lõi) + `items-garage` (module) là danh mục mã hàng garage dùng chung qua cổng `ItemCatalogPort`, `ai-hub-garage` đọc hóa đơn tạo đề nghị mua nháp; không import `ai-hub-core` v1)
- **File đính kèm (v2)**: `file-attachments` (lõi `src/v2/core/file-attachments-core`, module `src/v2/modules/file-attachments-management`, route `/api/v2/file-attachments-management` và owner hóa đơn `/api/v2/invoices/:id/attachments`, bảng `file_attachments`, `file_attachment_settings`; lưu R2, xóa mềm → xóa cứng có kiểm tra tham chiếu khóa; V1 `erp-attachments` còn song song)
- **Job nền xuất Excel (v2)**: lõi `src/v2/core/export-jobs-core` (runner, `AbstractExportJobService`, helper SSE/download/fingerprint, cờ `EXPORT_JOBS_V2` mặc định bật) và lõi `src/v2/core/xlsx-core` (biểu đồ xlsx dùng chung, chưa có pdf-core). Module `export-jobs-bank-statements`, `export-jobs-invoice-debts`, `export-jobs-vinfast-parts` bọc service nền cũ; invoices và garage dùng thẳng `ExportJobRunner` của lõi. Không controller mới, URL giữ nguyên
- **Lịch chạy nền (v2)**: `scheduler-jobs` (tự tìm job kế thừa `ScheduledJob` từ lõi `scheduler-core`, cổng `ENABLE_CRON` duy nhất). Cron mới là class kế thừa `ScheduledJob` trong module
- **Hệ thống, cấu hình, phân quyền, nhật ký**: `admin-dashboard-core`, `ai-hub-core`, `app-config`, `audit-core` (v2: lõi `src/v2/core/audit-core`, module `src/v2/modules/audit-logs`, route `/api/v2/audit-logs`, bảng `audit_logs`; v1 `src/audit-core` độc lập, bảng `erp_audit_logs`, không import chéo với v2), `erp-users` (V1 `users-admin` và V2 `users-management`, xem mục 0 của skill; auth v2 xem `auth-sessions`), `module-config`, `rbac-core`, `system-operations-core`

Khi cần quét mới hoặc cập nhật tài liệu module: skill `scan-module-knowledge`.

## 10. Bằng chứng cần có

- Số liệu build/test/smoke phải lấy từ lần chạy hiện tại, không lấy từ note cũ.
- Báo cáo scope test đã chạy. Nếu không chạy được, nói rõ là chưa chạy và lý do.
