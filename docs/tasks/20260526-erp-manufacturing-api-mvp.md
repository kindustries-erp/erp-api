# Task: ERP Manufacturing API MVP + PO Excel Import

## Request Input
- Type: FEATURE
- Mục tiêu: Dựng module API mới `erp-manufacturing` cho manufacturing MVP, bao gồm PO, receipt nhiều lần, vehicle VIN/frame/engine, issue theo VIN, warranty theo VIN, download template PO và upload Excel import PO hàng loạt.
- Bối cảnh/ngữ cảnh: DB gate đã xong ở Directus staging/public schema với 12 bảng `erp_*` mới. Không sửa flow legacy cũ.

## Goal
Hoàn tất API gate cho manufacturing MVP theo DB -> API -> UI -> QC, với validation rõ ràng cho import PO Excel.

## Scope
- In-scope:
  - module `src/erp-manufacturing/`
  - endpoints item / purchase-order / confirm / receipt / vehicle / issue / warranty
  - endpoint download PO template
  - endpoint upload/import PO Excel
  - row-level validation summary
- Out-of-scope:
  - BOM/work-order/costing
  - claim warranty
  - import receipt/issue Excel

## Relevant Files
- `src/app.module.ts` - register module
- `src/files/files.controller.ts` - pattern upload multipart
- `src/business-partners/*` - Directus CRUD pattern
- `src/operational-documents/*` - numbering + inventory status pattern

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `erp_inventory_items`
  - `erp_purchase_orders`
  - `erp_purchase_order_lines`
  - `erp_inventory_receipts`
  - `erp_inventory_receipt_lines`
  - `erp_vehicle_vins`
  - `erp_inventory_serials`
  - `erp_inventory_lots`
  - `erp_inventory_issues`
  - `erp_inventory_issue_lines`
  - `erp_inventory_txns`
  - `erp_vehicle_warranties`
  - reuse `erp_branches`, `erp_business_partners`
- Data nền cần có:
  - `erp_branches.code`
  - `erp_business_partners.code`
  - `erp_inventory_items.item_code`
- Constraint/index/default cần có:
  - unique VIN/frame_no/engine_no
  - tracking_type NONE/LOT/SERIAL
  - PO/receipt/issue status checks
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): N/A

## Coordination Impact
- [ ] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
- [x] 3.0 UI handoff gate done
- Evidence: `npx tsc --noEmit` PASS, `npm run build` PASS
- [ ] 4.0 Validate
  - [ ] 4.1 `npm run build`
  - [ ] 4.2 Smoke test affected endpoints
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: DB_READY
- Build:
- Smoke:

## Lessons Learned
- Link: No issue

## Commit/Push Status
- API repo:
- Web repo (if affected): pending
- DB/directus staging: applied + verified already
