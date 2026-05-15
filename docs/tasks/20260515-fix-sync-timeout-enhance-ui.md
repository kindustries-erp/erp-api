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
- [x] 6.0 Close
  - [x] 6.1 Summary with evidence
  - [ ] 6.2 Commit + push code (web/api)
- [x] 7.0 Hotfix timeout sync IN/OUT
  - [x] 7.1 Root cause confirmed: response payload sync quá nặng, frontend timeout 15000ms
  - [x] 7.2 Backend chỉ trả summary nhẹ cho sync tax portal
  - [x] 7.3 Build/deploy/test hotfix
  - [x] 7.4 Commit + push hotfix

## Validation Evidence
- DB precheck result: `DB_READY`
- Build: Backend `npm run build` thành công; Web `npx tsc --noEmit` thành công.
- Smoke (trước hotfix): Sync OUT thành công nhưng response quá lớn.
- Smoke (hotfix): gọi `sync?direction=IN&startDate=&endDate=` nội bộ trả `200` trong ~12.15s, payload giảm còn `240 bytes`, body chỉ còn summary `{ok,count,synced_at,invoice_nos,note}`.
- Deploy: API + Web docker compose build/up -d thành công.


## Lessons Learned
- Root cause timeout không nằm ở GDT chết mà ở response sync trả full `items` + `response_payload` rất nặng; nội bộ mất ~11.9s cho IN nên qua browser timeout 15000ms là dễ vỡ.
- Hotfix đúng là trả summary nhẹ từ backend và tăng timeout riêng cho request sync ở frontend, thay vì chỉ tăng timeout toàn cục.

## Commit/Push Status
- API repo:
- Web repo (if affected):
