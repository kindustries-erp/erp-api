# ERP Core API Neon Bootstrap

## Request Input (bạn chỉ cần điền phần này)
- Type: FEATURE
- Mục tiêu: Tạo lane `erp-core` trên branch mới, bootstrap backend sang TypeORM + Neon + local auth skeleton, loại dần phụ thuộc Directus runtime.
- Bối cảnh/ngữ cảnh: Reuse repo `liouni-erp-api`, chung remote, branch `erp-core`. Scope backend phase đầu chỉ dựng nền Postgres-only và cắt app xuống core bootstrap.

## Goal
Biến `liouni-erp-api` branch `erp-core` thành backend có thể build với Neon Postgres config và local auth skeleton, không còn phụ thuộc bắt buộc vào Directus module trong app bootstrap.

## Scope
- In-scope:
  - Tạo branch `erp-core`
  - Thêm TypeORM + pg + config Neon
  - Tạo `src/db/data-source.ts`
  - Tạo local auth skeleton (`core_users` entity + module cơ bản nếu cần)
  - Cắt `AppModule` xuống bootstrap tối thiểu để build được
- Out-of-scope:
  - Hoàn tất full auth/login runtime production-ready
  - Hoàn tất full purchasing/sales/manufacturing flow
  - Web implementation chi tiết

## Relevant Files
- `package.json` - thêm dependency/runtime scripts
- `src/app.module.ts` - cắt module cũ, thêm DB bootstrap
- `src/db/data-source.ts` - TypeORM datasource
- `src/**` - auth/db/core bootstrap files mới

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - Source scan: `directus_users`, `erp_employees`, `erp_purchase_orders`, `erp_purchase_order_lines`, `erp_inventory_items`, `erp_inventory_receipts`, `erp_inventory_receipt_lines`, `erp_bom_headers`, `erp_bom_lines`, `erp_production_orders`, `erp_inventory_issues`, `erp_inventory_issue_lines`, `erp_inventory_txns`
  - Target bootstrap: local table `core_users` và config Neon
- Data nền cần có:
  - Chưa cần migrate data trong phase bootstrap
- Constraint/index/default cần có:
  - Source schema đã scan và documented trong `/opt/docs/ai/liouni-erp/artifacts/260607-erp-core-postgres-plan.md`
  - Target chưa tồn tại đầy đủ
- Kết quả: `DB_GAP_FOUND`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): `/opt/repos/liouni-erp/directus-staging/ops/tasks/20260607-erp-core-postgres-scan-and-plan.md`

## Coordination Impact
- [ ] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
- [x] 3.0 UI handoff gate done
- [ ] 4.0 Validate
  - [x] 4.1 `bun run build`
  - [ ] 4.2 Smoke test affected endpoints
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: `DB_GAP_FOUND`
- Build: `bun run build` -> PASS on branch `erp-core` after adding `@nestjs/typeorm`, `pg`, `typeorm@0.3.20`, local auth skeleton, and minimal `AppModule`
- Smoke: pending (Neon credentials/env chưa cấu hình trong turn này)

## Lessons Learned
- Link: `docs/lessons-learned/<file>.md#<anchor>` or "No issue"

## Commit/Push Status
- API repo:
- Web repo (if affected):
- DB/directus staging: apply+verify+document (no code push required)
