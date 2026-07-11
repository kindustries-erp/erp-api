# Task — ERP Core Inventory Audit Implementation

## Request Input (bạn chỉ cần điền phần này)
- Type: ENHANCE
- Mục tiêu: Triển khai bộ audit tồn kho ERP core để rà soát nhập kho, sản xuất, bán hàng/xuất kho theo kế hoạch đã chốt.
- Bối cảnh/ngữ cảnh: Cần bắt đầu implementation ngay để chạy đối soát toàn bộ dữ liệu hiện có.

## Goal
Tạo script audit có thể chạy trực tiếp vào DB ERP core, trả ra mismatch theo từng phase nghiệp vụ và đối soát tồn cuối với inventory balance.

## Scope
- In-scope:
  - Tạo script audit trong API repo.
  - Chạy script trên DB hiện tại và ghi kết quả ban đầu.
  - Cập nhật tài liệu task + evidence.
- Out-of-scope:
  - Sửa dữ liệu lệch.
  - Vá logic business service.

## Relevant Files
- src/inventory-stock-core/audit-inventory-stock.ts - Script audit tổng hợp theo phase.
- package.json - Thêm command chạy audit.
- docs/tasks/20260711-erp-core-inventory-audit-implementation.md - Theo dõi triển khai + evidence.

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - erp_goods_receipts, erp_goods_receipt_lines
  - erp_goods_issues, erp_goods_issue_lines
  - erp_production_orders, erp_production_order_materials
  - erp_sales_orders, erp_sales_order_lines
  - erp_inventory_transactions, erp_inventory_balances
- Data nền cần có:
  - Chứng từ POSTED và transaction tương ứng.
- Constraint/index/default cần có:
  - Không bắt buộc index mới cho phase audit read-only.
- Kết quả: DB_READY (đã xác nhận bằng baseline query từ script audit)
- Nếu DB_GAP_FOUND: link DB task (directus-staging): N/A

## Coordination Impact
- [ ] Directus staging schema affected
- [ ] ERP Web contract affected
- [x] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
- [ ] 3.0 UI handoff gate done
- [ ] 4.0 Validate
  - [ ] 4.1 bun run lint:check
  - [ ] 4.2 bun run build
  - [ ] 4.3 Test scope liên quan (bunx jest --forceExit hoặc scope hẹp hơn, ghi rõ evidence)
  - [ ] 4.4 Smoke test affected endpoints (nếu đổi contract/runtime flow)
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: DB_READY
  - Baseline counts:
    - erp_goods_receipts POSTED: 59
    - erp_goods_issues POSTED: 38
    - erp_inventory_transactions: 4879
    - erp_production_orders active: 38
    - erp_sales_orders active: 11
  - Initial mismatch snapshot (limit=10):
    - Phase 2 (GR line vs txn): 34 rows mismatch
    - Phase 3A (MO material qtyIssued vs GI lines): 0 rows mismatch
    - Phase 3A (Production GI lines vs ISSUE txn): 4046 rows mismatch
    - Phase 3B (MO qtyProduced vs FG receipts): 0 rows mismatch
    - Phase 4 (SO delivered vs GI lines): 11 rows mismatch
    - Phase 4 (Sales GI lines vs ISSUE txn): 0 rows mismatch
    - Phase 5 (balance vs ledger): 119 rows mismatch
    - Total mismatches (excluding baseline): 4210
- bun run lint:check: Pending
- Build: Pending
- Test: Pending
- Smoke: N/A (không đổi endpoint)

## Lessons Learned
- Link: No issue

## Commit/Push Status
- API repo: Pending
- Web repo (if affected): N/A
- DB/directus staging: N/A
