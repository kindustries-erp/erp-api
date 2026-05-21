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
  - [x] partial receipt + moving-average issue costing harden draft
- [x] 3.0 UI handoff gate done

  - [x] 4.1 `npm run build`
  - [x] 4.2 Smoke test affected endpoints
- [x] 5.0 Close
  - [x] 5.1 Lessons learned entry (if issue)
  - [x] 5.2 Commit + push code (web/api)
  - [x] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: `DB_GAP_FOUND` đã được xử lý qua migration inventory status + source_line_id
- Build: `npm run build` PASS
- Smoke:
  - partial receipt line-level nhiều lần trên cùng line: PASS (`2 + 2 + 1`)
  - status chuyển `PARTIAL -> PARTIAL -> FULLY_RECEIVED`: PASS
  - lần receipt dư tiếp theo: FAIL đúng với `PO đã nhập đủ, không thể post nhập kho lại`
  - transaction log đã có `source_line_id`
  - DB partial issue guard update: dropped unique index `inventory_tx_issue_source_line_guard_idx`; sales inventory status CHECK now allows `NOT_ISSUED | PARTIAL | ISSUED`.
  - Sales partial issue smoke after deploy: `SMOKE-PARTIAL-ISSUE-20260522062422`, line qty 3: issue `1 -> 1 -> 1` PASS (`PARTIAL -> PARTIAL -> ISSUED`, issued_line `1 -> 2 -> 3`, stock_issued `1 -> 2 -> 3`); 4th issue FAIL 400 `Chứng từ đã xuất kho, không thể post lại`.

## Lessons Learned
- No issue

## Commit/Push Status
- API repo: pushed `331e4ed fix operational partial sales issue posting`, `4f3a243 docs record operational partial issue smoke`
- Web repo (if affected): pushed `d0eb568 add operational line-level inventory posting UI`
- DB/directus staging: apply+verify+document (no code push required)
