# Task: ERP Manufacturing full flow API — BOM + Production + Mock/QC

## Request Input (bạn chỉ cần điền phần này)
- Type: FEATURE
- Mục tiêu: Hoàn tất API full flow cho manufacturing: supplier FK contract, PO CRUD usable from UI, receipt, BOM, production order/BOM explosion, issue to vehicle, warranty, mock data seed endpoints if needed.
- Bối cảnh/ngữ cảnh: manufacturing API MVP đã deploy nhưng FE chưa có form; DB gate hiện cần bổ sung BOM/production schema và mock data.

## Goal
Hoàn tất backend workflow/API gate cho manufacturing full flow business QC.

## Scope
- In-scope:
  - extend `src/erp-manufacturing/*`
  - lookups for branches/suppliers/items/BOMs
  - PO create/update/detail usable by UI
  - receipt create/list
  - BOM CRUD/list
  - production order create/list/issue-by-bom flow
  - vehicle create/update/list/detail
  - warranty activation/list
  - mock data seed helper if needed for staging QC
- Out-of-scope:
  - costing, routing, work center, warranty claim

## Relevant Files
- `src/erp-manufacturing/erp-manufacturing.controller.ts` - route surface
- `src/erp-manufacturing/erp-manufacturing.service.ts` - business workflow
- `src/erp-manufacturing/dto/erp-manufacturing.dto.ts` - DTO/validation

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - existing manufacturing tables + new `erp_bom_headers`, `erp_bom_lines`, `erp_production_orders`
- Data nền cần có:
  - active branch, supplier, items, BOM test data
- Constraint/index/default cần có:
  - FK and status contract from DB task `/opt/repos/liouni-erp/directus-staging/ops/tasks/20260526-2333-erp-manufacturing-bom-production-db.md`
- Kết quả: `DB_GAP_FOUND` -> chờ DB apply xong rồi chuyển `DB_READY`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): `/opt/repos/liouni-erp/directus-staging/ops/tasks/20260526-2333-erp-manufacturing-bom-production-db.md`

## Coordination Impact
- [x] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [ ] 2.0 Backend workflow/API gate done
- [ ] 3.0 UI handoff gate done
- [ ] 4.0 Validate
  - [ ] 4.1 `bun run build`
  - [ ] 4.2 Smoke test affected endpoints
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: DB_GAP_FOUND (pending DB apply)
- Build:
- Smoke:

## Lessons Learned
- Link: No issue

## Commit/Push Status
- API repo:
- Web repo (if affected): pending
- DB/directus staging: apply+verify+document (no code push required)
