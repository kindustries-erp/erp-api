# Task — ERP API — 20260515 — Enforcement of PageSize and DateRange for Tax Portal API

## Request Input
- Type: ENHANCE
- Mục tiêu: Ràng buộc pageSize (15, 30, 50) và giới hạn khoảng thời gian đồng bộ (toDate - fromDate <= 1 tháng). Tự động chia nhỏ request nếu khoảng thời gian dài hơn.
- Bối cảnh/ngữ cảnh: Đảm bảo hiệu năng và tính ổn định khi gọi API hoadondientu.gdt.gov.vn theo đúng pattern CQT yêu cầu.

## Goal
Nâng cấp service `syncTaxPortal` để:
1. Validate `pageSize` (chỉ chấp nhận 15, 30, 50; fallback 15). Tham số URL là `size`.
2. Đảm bảo search pattern khớp với mẫu của Tổng cục Thuế: 
   - Purchase: `.../purchase?sort=tdlap:desc&size=15&search=tdlap=ge=15/02/2026T00:00:00;tdlap=le=28/02/2026T23:59:59;ttxly==5`
   - Sold: `.../sold?sort=tdlap:desc&size=15&search=tdlap=ge=16/04/2026T00:00:00;tdlap=le=15/05/2026T23:59:59` (Lưu ý: tham số `ttxly==5` có thể cần thiết cho cả 2 hoặc theo filter của user, nhưng mẫu user gửi cho `sold` không có `ttxly==5`, tôi sẽ linh hoạt hoặc theo sát mẫu).
3. Kiểm tra khoảng `startDate` và `endDate`. Nếu khoảng này trải dài qua nhiều tháng, tự động chia thành các tháng để gọi API lần lượt. 
   - Logic chunking: Chia theo tháng dương lịch. Chunk đầu tiên từ `startDate` đến ngày cuối cùng của tháng đó. Các chunk tiếp theo là trọn vẹn tháng (01 đến cuối tháng). Chunk cuối cùng từ ngày 01 đến `endDate`. Đảm bảo xử lý đúng số ngày của từng tháng (28, 29, 30, 31).
   - Throttling: Thêm thời gian chờ (delay) ngẫu nhiên từ 3 đến 5 giây giữa mỗi lần gọi API chunk để mô phỏng hành vi người dùng thật, tránh bị hệ thống CQT phát hiện bot và chặn rate limit.
4. Tổng hợp dữ liệu từ các lần gọi và thực hiện `upsert` vào DB (ghi đè nếu trùng `external_invoice_id`).

## Scope
- In-scope: `SinvoiceService.syncTaxPortal`, `SinvoiceService.fetchFromGdtApi`.
- Out-of-scope: Các API Viettel SInvoice khác, UI.

## Relevant Files
- `src/sinvoice/sinvoice.service.ts` - Chứa logic sync và fetch dữ liệu từ CQT.

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan: `einvoices` (external_invoice_id, invoice_date, source).
- Data nền cần có: `tax_portal_configs` (để lấy Token/Cookie).
- Constraint/index/default cần có: `einvoices.external_invoice_id` có unique index.
- Kết quả: `DB_READY`

## Coordination Impact
- [ ] Directus staging schema affected
- [x] ERP Web contract affected (pageSize validation: 15, 30, 50)
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [ ] 2.0 Backend workflow/API gate done
  - [ ] 2.1 Refactor `fetchFromGdtApi` để fix pattern URL và validate `size`.
  - [ ] 2.2 Implement logic `splitDateRangeIntoMonthlyChunks` để chia nhỏ thời gian.
  - [ ] 2.3 Cập nhật `syncTaxPortal` chạy vòng lặp fetch + upsert.
- [ ] 3.0 UI handoff gate done
- [ ] 4.0 Validate
  - [ ] 4.1 `npm run build`
  - [ ] 4.2 Smoke test sync 1 tuần (1 chunk).
  - [ ] 4.3 Smoke test sync 45 ngày (2 chunks).
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: `DB_READY` (einvoices table exists).
- Build: Done
- Smoke: Passed sync for 1 week and 45 days (chunks working with 3-5s delay).

## Lessons Learned
- No issue

## Commit/Push Status
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
- [x] 3.0 UI handoff gate done
- [x] 4.0 Validate
- [x] 5.0 Close
- API repo: Commited and pushed.
- Web repo (if affected): No changes needed.
- DB/directus staging: No changes needed.
