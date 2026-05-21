# Operational ERP UX / Settlement / Inventory Posting

## Request Input (bạn chỉ cần điền phần này)
- Type: ENHANCE
- Mục tiêu: Fix backend contract cho modal detail, settlement partner filter/allocation, và posting kho receipt/issue.
- Bối cảnh/ngữ cảnh: Operational ERP MVP đã có collections/routes nền nhưng nghiệm thu phát hiện thiếu guard backend cho settlement theo đối tác, thiếu flow receipt/issue từ chứng từ nguồn, và cần payload detail tốt hơn cho UI modal.

## Goal
Hoàn thiện API contract cho phase nghiệm thu: detail/read-only payload, settlement guard đúng đối tác + allocation toàn cục, và posting kho từ PO/Sales với chặn double-post.

## Scope
- In-scope:
  - `src/operational-documents/**`
  - settlement validation theo `business_partners`
  - receipt posting từ `purchase_orders`
  - issue posting từ `sales_service_orders`
- Out-of-scope:
  - recurring scheduler redesign
  - accounting posting/journal redesign
  - expense inventory flow

## Relevant Files
- `src/operational-documents/operational-documents.controller.ts` - thêm endpoints receipt/issue
- `src/operational-documents/operational-documents.service.ts` - business rules settlement + posting kho
- `src/operational-documents/dto/operational-document.dto.ts` - DTO/query/update contract nếu cần

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `purchase_orders.inventory_status`
  - `sales_service_orders.inventory_status`
  - `inventory_transactions.source_type/source_id/transaction_type/inventory_item_id/branch_id`
  - `payment_vouchers.counterparty_id`
  - `purchase_orders.supplier_id`
  - `sales_service_orders.customer_id`
  - `operating_expenses.supplier_id`
- Data nền cần có:
  - chứng từ nguồn đã có line với `inventory_item_id` cho luồng kho
  - payment voucher dùng `counterparty_id` từ `business_partners`
- Constraint/index/default cần có:
  - field `inventory_status` tồn tại trước khi code API
  - DB guard cho duplicate inventory posting theo source document
- Kết quả: `DB_GAP_FOUND`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging):
  - `/opt/repos/liouni-erp/directus-staging/ops/tasks/20260521-operational-erp-ux-settlement-inventory-posting.md`

## Coordination Impact
- [x] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
  - [x] settlement partner guard + voucher allocation global draft
  - [x] receipt/issue posting routes draft
- [x] 3.0 UI handoff gate done
- [ ] 4.0 Validate
  - [x] 4.1 `npm run build`
  - [x] 4.2 Smoke test affected endpoints
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: `DB_GAP_FOUND` pending DB task apply
- Build:
- Smoke:

## Lessons Learned
- Link: `docs/lessons-learned/<file>.md#<anchor>` or "No issue"

## Commit/Push Status
- API repo:
- Web repo (if affected):
- DB/directus staging: apply+verify+document (no code push required)
