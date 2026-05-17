# Task — SInvoice split draft/issued sync endpoints

## Request Input (bạn chỉ cần điền phần này)
- Type: ENHANCE
- Mục tiêu: Tách luồng hóa đơn nháp và hóa đơn đã phát hành thành 2 endpoint sync + 2 list riêng để UI tách 2 tab/2 table.
- Bối cảnh/ngữ cảnh: User xác nhận endpoint draft thật là `/api/cluster3/.../invoice/search-draft-all` (invoiceStatus=0). Dữ liệu cũ trong einvoices đã được xóa sạch để đồng bộ lại từ Viettel.

## Goal
Backend cung cấp bề mặt API rõ ràng cho 2 trạng thái DRAFT/ISSUED, map đầy đủ field hiển thị tối thiểu, và hỗ trợ UI đọc list tách biệt.

## Scope
- In-scope:
  - Thêm sync endpoint draft
  - Thêm sync endpoint issued
  - Thêm local list endpoint draft/issued có pagination
  - Normalize mapping field Viettel -> einvoices
- Out-of-scope:
  - Không thay đổi schema DB
  - Không đụng luồng Tax Portal

## Relevant Files
- `src/sinvoice/sinvoice.controller.ts` - expose route mới
- `src/viettel-v2/viettel-v2.service.ts` - logic fetch/map/upsert draft vs issued
- `src/viettel-v2/viettel-v2.controller.ts` - nếu cần bề mặt route phụ trợ

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `einvoices`: id, external_invoice_id, invoice_no, supplier_tax_code, status, source, direction, invoice_date, buyer_name, total_amount, vat_amount, response_payload
  - `sinvoice_configs`: api_url, supplier_tax_code, username, password, is_active
- Data nền cần có:
  - 1 config active trong `sinvoice_configs`
  - runtime có thể gọi login Viettel thành công
- Constraint/index/default cần có:
  - upsert theo `external_invoice_id`, fallback `supplier_tax_code + invoice_no`
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): N/A

## Coordination Impact
- [ ] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [ ] 2.0 Backend workflow/API gate done
- [ ] 3.0 UI handoff gate done
- [ ] 4.0 Validate
  - [ ] 4.1 `npm run build`
  - [ ] 4.2 Smoke test affected endpoints
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: einvoices currently empty (all=0), sinvoice config active và login Viettel OK, endpoint draft `search-draft-all` chạy 200.
- Build: pending
- Smoke: pending

## Lessons Learned
- No issue

## Commit/Push Status
- API repo: pending
- Web repo (if affected): pending
- DB/directus staging: apply+verify+document (no code push required)
