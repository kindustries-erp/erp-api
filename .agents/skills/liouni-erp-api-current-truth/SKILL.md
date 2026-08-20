---
name: liouni-erp-api-current-truth
description: API-specific local-only skill for Liouni ERP. Use when working in this repo to load the repo-local current-truth context, runtime contract, and implementation rules for the active ERP API lane.
---

# Liouni ERP API Current-Truth

Use this skill only inside this repository.

## Local read order

1. `@.agents/AGENTS.md`
2. `@README.md`
3. Antigravity Brain (`implementation_plan.md` & `walkthrough.md`)

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
- Manage all task execution, planning, and verification in Antigravity Brain (`implementation_plan.md` -> `walkthrough.md`)
- Keep task checklist updated in realtime
- **Strict Git Workflow**: Follow the exact sequence: pull -> build -> check:ci -> test -> commit -> push (see rules for exact trigger definitions).
- If backend source changed, run `bunx jest --forceExit` or a narrower affected test scope and report the scope used
- When task docs are stale, verify with code + build/test + git state before correcting status/checklist
- Query Postgres directly through the active `DATABASE_URL` before changing DTOs, filters, persistence, or business rules
- **New Module Registration**: Always verify that newly created NestJS modules (e.g. `feature.module.ts`) are explicitly imported in `src/app.module.ts` to prevent 404 Not Found endpoint errors.
- **TypeScript Build Configuration**: If adding `.ts` files outside of `src/` (e.g. in `scripts/`), ensure the directory is added to the `exclude` array in `tsconfig.build.json`. Otherwise, TypeScript alters the root directory structure in `dist/`, causing the runtime entrypoint (`dist/main.js`) to fail.
- **Git Commit & Push Process**: When the user requests to "commit and push", determine whether the changes belong to `liouni-erp-web` or `liouni-erp-api` (or both) and execute Git commands inside the respective repository directory. Do not commit/push from the workspace parent.

## Module Knowledge Repository (.agents/skills/modules/)

Mỗi domain/module backend đều có tài liệu tri thức chuyên sâu (DB, DTOs, API, Business Rules, Cross-module) được lưu tại `.agents/skills/modules/<module-name>/SKILL.md`.

- Khi làm việc trên module cụ thể: Đọc trực tiếp skill của module đó:
  - **Sản xuất & BOM**: `production-core`, `bom-core`
  - **Bán hàng & Sau bán hàng**: `erp-sales-orders`, `sales-report-dashboard`, `after-sales`
  - **Mua hàng & Nhà cung cấp**: `purchasing`, `purchasing-report-dashboard`, `erp-suppliers`
  - **Kho & Tồn kho**: `inventory-dashboard`, `erp-inventory-items`, `erp-inventory-stock`, `erp-inventory-tracking`, `erp-inventory-transactions`, `erp-inventory-adjustments`, `erp-inventory-vouchers`
  - **Tài chính, Dòng tiền, Hóa đơn & Tài khoản**: `bank-statement`, `cashflow-dashboard`, `erp-invoice`, `invoice-dashboard`, `settings-accounts`
  - **Phụ tùng VinFast**: `vinfast-parts-stock`, `vinfast-parts-dashboard`
  - **Dịch vụ Garage & Sửa chữa xe**: `garage-cases`, `garage-customers`, `garage-dashboard`, `garage-gross-profit`
  - **Hệ thống & Cấu hình**: `app-config`
- Khi cần quét mới hoặc cập nhật tài liệu cho một module: Sử dụng skill `scan-module-knowledge` (`.agents/skills/scan-module-knowledge/SKILL.md`).

## Team-scale reminders

- Use `must` only for standards already enforced in this repo; use `prefer` for target-direction conventions.
- Keep domain boundaries clear: controller -> DTO/validation -> service/use-case -> persistence/helper.
- If a new helper/service is created instead of reusing one, note the reason in the task artifact.
- A backend task is not done until validation evidence and commit/push status are recorded.

