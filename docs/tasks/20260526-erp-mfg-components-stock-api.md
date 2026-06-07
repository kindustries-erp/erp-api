# Task: ERP Manufacturing Components + Stock API

## Request Input
- Type: FEATURE
- Mục tiêu: Thêm API cho danh mục linh kiện, create/update/view detail, stock summary, transaction history drill-down về PO/VIN.
- Bối cảnh: lane `erp_*` manufacturing đã QC full flow API PASS cho PO -> receipt -> vehicle -> issueByBom -> warranty.

## Goal
Cung cấp API đủ cho ERP Web render:
- danh mục linh kiện dạng table có search/filter
- modal create/edit/view linh kiện
- detail tồn kho của linh kiện
- lịch sử nhập/xuất và truy ngược nguồn PO/receipt/issue/VIN

## Scope
- In-scope:
  - `GET /erp-manufacturing/items/components`
  - `POST /erp-manufacturing/items/components`
  - `PATCH /erp-manufacturing/items/components/:id`
  - `GET /erp-manufacturing/items/components/:id`
  - `GET /erp-manufacturing/items/components/:id/stock-summary`
  - `GET /erp-manufacturing/items/components/:id/txns`
  - enrich payload PO/VIN/receipt/issue drill-down
- Out-of-scope:
  - schema change DB nếu Gate 0 xác nhận DB_READY
  - UI rendering

## Relevant Files
- `src/erp-manufacturing/erp-manufacturing.controller.ts`
- `src/erp-manufacturing/erp-manufacturing.service.ts`
- `src/erp-manufacturing/dto/erp-manufacturing.dto.ts`

## Gate 0 — DB Precheck
- Collections/tables:
  - `erp_inventory_items`
  - `erp_inventory_txns`
  - `erp_inventory_receipts`
  - `erp_inventory_receipt_lines`
  - `erp_purchase_orders`
  - `erp_purchase_order_lines`
  - `erp_inventory_issues`
  - `erp_inventory_issue_lines`
  - `erp_inventory_lots`
  - `erp_inventory_serials`
  - `erp_vehicle_vins`
- Required fields:
  - item master: `item_code`, `item_name`, `item_type`, `tracking_type`, `uom`, `is_active`, `notes`
  - txn drill-down: `txn_type`, `qty`, `tracking_type`, `source_type`, `source_id`, `source_line_id`, `lot_code`, `vin_id`, `txn_date`
- Constraints/defaults:
  - `source_type` valid values include `PURCHASE_RECEIPT`, `VIN_ISSUE`
  - `tracking_type` required on inventory txn
- Result: `DB_READY`

## Checklist
- [x] 1.0 Gate 0 DB precheck done
- [ ] 2.0 Add DTO/types for component CRUD + stock/txn responses
- [ ] 3.0 Implement service methods for components/detail/stock/history
- [ ] 4.0 Implement controller routes
- [ ] 5.0 Validate build/smoke
- [ ] 6.0 Close with evidence

## Acceptance Criteria
- List/search/filter components works on `item_type=COMPONENT`
- Create/update item works without inventing fields
- Detail returns item + stock summary snapshot
- Txn history returns enough fields to show PO number / receipt date / VIN / issue number
- No legacy/unprefixed tables involved

## Risks
- Directus relation overfetch may be brittle; prefer explicit enrich-by-id
- historical txns may miss some source linkage if old seeded data inconsistent

## Rollback
- Revert controller/service/DTO additions in API repo
- No DB rollback expected if Gate 0 stays DB_READY
