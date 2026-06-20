# Task: Production start/complete flow with auto GI/GR

## Request Input (bạn chỉ cần điền phần này)
- Type: FEATURE
- Mục tiêu: Thay flow xuất/nhập kho thủ công của MO bằng flow Sản xuất / Hoàn thành có tự tạo GI/GR ngầm.
- Bối cảnh/ngữ cảnh: Theo implementation plan `/home/lio/.gemini/antigravity-ide/brain/f2f914ad-a6b2-4f1f-923a-6d523dfd1593/artifacts/implementation_plan.md`, đã reconcile với source hiện tại để tránh regression GI inline / GR prefill cũ.

## Goal
Cho phép user thao tác sản xuất theo từng phần trên MO bằng 2 action nghiệp vụ:
- `Sản xuất`: auto issue NVL + chuyển MO sang `IN_PROGRESS`
- `Hoàn thành`: auto receipt thành phẩm + tăng `qtyProduced`, tự chuyển `COMPLETED` khi đủ số lượng

## Scope
- In-scope:
  - API endpoint `POST /api/v1/production/orders/:id/start`
  - API endpoint `POST /api/v1/production/orders/:id/complete`
  - inventory shortage validation cho số lượng partial
  - auto-create GI/GR records và inventory transactions liên quan
  - cập nhật `qtyIssued` trên MO materials, `qtyProduced` + status trên MO header
- Out-of-scope:
  - đổi schema DB
  - redesign module warehouse độc lập ngoài flow MO
  - deploy runtime

## Relevant Files
- `src/production-core/production-core.controller.ts` - add start/complete endpoints
- `src/production-core/production-core.service.ts` - core business flow start/complete
- `src/production-core/dto/*` - request DTO mới cho partial start/complete

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `erp_production_orders.qty_to_produce`
  - `erp_production_orders.qty_produced`
  - `erp_production_orders.status`
  - `erp_production_orders.warehouse_code`
  - `erp_production_order_materials.qty_required`
  - `erp_production_order_materials.qty_issued`
  - `erp_goods_issues.production_order_id`
  - `erp_goods_issue_lines.production_order_material_id`
  - `erp_goods_receipts.production_order_id`
  - `erp_goods_receipt_lines.item_id`, `qty_received`
  - `erp_inventory_balances`
  - `erp_inventory_transactions`
- Data nền cần có:
  - MO đã có BOM/material lines
  - inventory item/balance cho NVL và thành phẩm
- Constraint/index/default cần có:
  - không cần field mới; status lifecycle phải support `CONFIRMED` -> `IN_PROGRESS` -> `COMPLETED`
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging):

## Coordination Impact
- [ ] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [ ] 2.0 Backend workflow/API gate done
- [ ] 3.0 UI handoff gate done
- [ ] 4.0 Validate
  - [ ] 4.1 `bun run lint:check`
  - [ ] 4.2 `bun run build`
  - [ ] 4.3 Test scope liên quan (`bunx jest --forceExit` hoặc scope hẹp hơn, ghi rõ evidence)
  - [ ] 4.4 Smoke test affected endpoints (nếu đổi contract/runtime flow)
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: `DB_READY`
- `bun run lint:check`:
- Build:
- Test:
- Smoke:

## Lessons Learned
- Link: `docs/lessons-learned/<file>.md#<anchor>` or "No issue"

## Commit/Push Status
- API repo:
- Web repo (if affected):
- DB/directus staging: apply+verify+document (no code push required)
