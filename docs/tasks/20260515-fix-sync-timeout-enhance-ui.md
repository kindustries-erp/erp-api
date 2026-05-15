# Task: Fix Sync Sold Invoices Timeout & Enhance UI Table

## Request Input
- Type: FIX | ENHANCE
- Mục tiêu: Khắc phục lỗi timeout khi đồng bộ hóa đơn bán ra từ cổng Thuế và cải tiến bảng danh sách hóa đơn trên UI giống module Tiền mặt (hỗ trợ tìm kiếm, filter ngày).
- Bối cảnh/ngữ cảnh: User báo lỗi timeout khi lấy danh sách hóa đơn bán ra. Đồng thời yêu cầu UI bảng hóa đơn phải đồng nhất với bảng Tiền mặt/Tiền gửi.

## Goal
1. Tối ưu code backend gọi API Tổng cục Thuế để tránh timeout (phân tách request hoặc tối ưu payload).
2. Cập nhật UI bảng danh sách hóa đơn: thêm ô tìm kiếm, bộ lọc ngày tháng.
3. Đảm bảo tính nhất quán UI/UX với module Tiền mặt.

## Relevant Files
- `src/sinvoice/sinvoice.service.ts` - Logic gọi API GDT
- `src/pages/HoaDonDienTu.tsx` - UI danh sách hóa đơn

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan: `tax_portal_configs` (đã có gdt_jwt, gdt_cookie), `einvoices`
- Data nền cần có: Cấu hình cổng thuế hợp lệ.
- Kết quả: `DB_READY`

## Coordination Impact
- [ ] Directus staging schema affected
- [x] ERP Web contract affected (Backend trả thêm metadata hoặc hỗ trợ filter query)
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend: Fix timeout & Optimize GDT API Call
- [x] 3.0 Backend: Support search/filter query cho einvoices list
- [x] 4.0 UI: Update HoaDonDienTu table (Search, Date Filter)
- [x] 5.0 Validate
  - [x] 5.1 `npm run build`
  - [x] 5.2 Smoke test sync sold invoices
  - [x] 5.3 Verify UI filter/search
- [ ] 6.0 Close
  - [ ] 6.1 Summary with evidence
  - [ ] 6.2 Commit + push code (web/api)

## Validation Evidence
- DB precheck result: `DB_READY`
- Build: Backend & Web build success.
- Smoke: Sync OUT thành công (count: 1, external_id: 76f0859d...). UI filters đã hiển thị.


## Lessons Learned
- 

## Commit/Push Status
- API repo:
- Web repo (if affected):
