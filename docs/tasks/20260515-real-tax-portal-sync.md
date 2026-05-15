# Task: Tích hợp dữ liệu thật từ Cổng Thuế (Smart Invoice API)

## Request Input
- Type: FEATURE
- Mục tiêu: Chuyển đổi tính năng Đồng bộ Hóa đơn (mua vào/bán ra) từ dữ liệu giả lập (stub) sang gọi API thật của cổng thuế thông qua dịch vụ trung gian Smart Invoice (Viettel).
- Bối cảnh: Người dùng đã nhập thông tin tài khoản cổng thuế thật và URL `http://smart-invoice.vn/API` vào cấu hình. ERP cần dùng cấu hình này để sync hóa đơn.

## Goal
1. Bỏ stub dữ liệu tĩnh trong `syncTaxPortal`.
2. Thay bằng luồng gọi API thật (`/login` nếu cần, rồi gọi `/search` hoặc tương tự tùy đặc tả API).
3. Map JSON response từ API vào entity `einvoices` của ERP.
4. Xử lý timeout/error duyên dáng.

## Scope
- In-scope:
  - Gọi API Tax Portal (Smart Invoice).
  - Ánh xạ JSON schema trả về vào cơ sở dữ liệu.
- Out-of-scope:
  - Cập nhật UI (UI đã hoàn thiện ở task trước).
  - Tích hợp SInvoice phát hành (giữ nguyên draft-only mode).

## Gate 0 — DB Precheck
- Collections liên quan:
  - `tax_portal_configs` (is_active, api_url, username, password, tax_code)
  - `einvoices`
- Data nền: Tài khoản thật đã lưu.
- Kết quả: `DB_READY`

## Checklist
- [x] 1.0 Gate 0 DB Precheck
- [x] 2.0 Gọi thử và phân tích schema API của hoadondientu.gdt.gov.vn
- [x] 3.0 Sửa `syncTaxPortal` gọi API thật qua Token/Cookie từ UI
- [x] 4.0 Mapping request/response chuẩn
- [x] 5.0 Validate (build & smoke test)
- [ ] 6.0 Close (Commit, Push)

## Evidence
- Đã thêm trường gdtJwt và gdtCookie lên giao diện UI.
- Đã thay đổi logic sync để gọi trực tiếp tới `hoadondientu.gdt.gov.vn/api/query/invoices/purchase` và `sold`.
- Đã sync thành công 35 hóa đơn thật.