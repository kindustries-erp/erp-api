# ERP TASK: Enhance Cash/Bank Tag Presets Integration

**STATUS: COMPLETED**

## Request Input
- Type: ENHANCE
- Mục tiêu: Tích hợp nghiệp vụ nhanh (Thu KH, Đặt cọc, Trả NCC) trực tiếp vào danh sách cash_bank_tag_presets thay vì tạo thêm nút riêng trên header. Giữ nguyên 4 nút lập phiếu cơ bản.
- Bối cảnh/ngữ cảnh: User muốn tinh gọn header, chuyển các nghiệp vụ đặc thù vào trong danh sách preset để auto-fill form khi chọn.

## Scope
- In-scope:
  - Thu gọn nút bấm trên Header Tiền mặt/Tiền gửi về 2 nút mỗi trang (Thu/Chi, UNT/UNC).
  - Refactor onTagPresetSelect để auto-switch counterparty_source sang EXTERNAL khi chọn preset CUSTOMER_* hoặc PAYMENT_*.
  - Xóa COUNTERPARTY_ROLE_OPTS và import tương ứng (dọn dẹp code thừa).
- Out-of-scope:
  - Thay đổi schema DB.
  - Thay đổi logic hạch toán.

## Gate 0 — DB Precheck
- Kết quả: DB_READY (schema không đổi, presets đã tồn tại)

## Checklist
- [x] 1.0 Gate 0 DB Precheck done (Status: READY)
- [x] 2.0 Backend N/A
- [x] 3.0 UI & Logic Implementation
  - [x] 3.1 TienMatView.tsx: giữ 2 nút (Thu/Chi)
  - [x] 3.2 TienGuiDashboard.tsx: giữ 2 nút (UNT/UNC)
  - [x] 3.3 useCashVoucherHandlers.ts: handleTagPresetSelect auto-switch EXTERNAL
  - [x] 3.4 useBankVoucherHandlers.ts: handleTagPresetSelect auto-switch EXTERNAL
  - [x] 3.5 BankVoucherDrawer.tsx: xóa import COUNTERPARTY_ROLE_OPTS
  - [x] 3.6 voucherForm.ts: xóa const COUNTERPARTY_ROLE_OPTS
- [x] 4.0 Validate
  - [x] 4.1 tsc --noEmit: exit 0
  - [x] 4.2 docker compose build: success
- [x] 5.0 Close
  - [x] 5.1 Commit: f07c968
  - [x] 5.2 Push: master -> github.com:Liouni/liouni-erp-web.git

## Commit/Push Status
- Web repo: f07c968 pushed to master
- API repo: N/A
- DB/directus: DB_READY, no change
