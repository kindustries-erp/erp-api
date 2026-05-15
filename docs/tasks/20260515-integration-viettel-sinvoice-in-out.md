# Task: Tích hợp lấy hóa đơn đầu vào/đầu ra từ SInvoice (Viettel)

## Request Input
- Type: FEATURE
- Mục tiêu: Tích hợp API lấy hóa đơn mua vào (đầu vào) và bán ra (đầu ra) từ hệ thống Tổng cục Thuế (thông qua dịch vụ tích hợp của Viettel).
- Bối cảnh/ngữ cảnh: Hệ thống đã có API xuất hóa đơn qua SInvoice Viettel. Cần mở rộng để lấy dữ liệu hóa đơn từ trang thuế điện tử. Lưu ý: API và User/Password để lấy hóa đơn mua vào/bán ra từ Tổng cục Thuế khác với API/User của SInvoice xuất hóa đơn.

## Goal
Bổ sung tính năng đồng bộ hóa đơn mua vào (đầu vào) và bán ra (đầu ra) từ Tổng cục Thuế vào ERP thông qua API Viettel. Thiết lập cấu hình riêng cho tài khoản Thuế và lưu trữ dữ liệu tập trung phục vụ đối soát.

## Scope
- In-scope:
  - DB: Tạo collection `tax_portal_configs` để lưu account Tổng cục Thuế (khác với `sinvoice_configs`).
  - DB: Mở rộng `einvoices` để lưu hóa đơn từ Thuế (phân biệt `source`: SINVOICE | TAX_PORTAL).
  - API NestJS: Tạo `TaxPortalService` hoặc mở rộng `SinvoiceService` (tùy theo độ tách biệt của API Viettel cung cấp) để gọi API tra cứu hóa đơn.
  - UI: Bổ sung cấu hình Tài khoản Thuế và màn hình tra cứu hóa đơn từ Thuế.
- Out-of-scope:
  - Xử lý captcha (nếu API Viettel không tự giải).
  - Tự động khớp hóa đơn với chứng từ kế toán.

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `tax_portal_configs`: Cần tạo mới (username, password, tax_code, is_active).
  - `einvoices`: Thêm field `source` (enum: SINVOICE, TAX_PORTAL) và `direction` (enum: IN, OUT).
- Data nền cần có: Tài khoản trang hoadondientu.gdt.gov.vn để test.
- Constraint/index/default cần có: Index cho `source` và `direction`.
- Kết quả: `DB_GAP_FOUND`

## Coordination Impact
- [x] Directus staging schema affected (tạo config mới + thêm field tracking)
- [x] ERP Web contract affected (giao diện cấu hình mới + tab tra cứu)
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [ ] 1.0 Gate 0 DB Precheck done
  - [ ] 1.1 Tạo `tax_portal_configs` (Singleton/Collection).
  - [ ] 1.2 Thêm `source`, `direction`, `tax_status` vào `einvoices`.
- [ ] 2.0 Backend workflow/API gate done
  - [ ] 2.1 Implement Viettel Tax Portal API Client (tra cứu hóa đơn mua vào/bán ra).
  - [ ] 2.2 Endpoint `GET /api/v1/tax-portal/sync` để trigger đồng bộ.
- [ ] 3.0 UI handoff gate done
  - [ ] 3.1 Tái cấu trúc trang Hóa đơn điện tử thành trang "Quản lý Thuế" (Tax Management).
  - [ ] 3.2 Implement Tabs UI:
    - [ ] Tab 1: **Xuất hóa đơn** (Giao diện tạo và phát hành hóa đơn SInvoice).
    - [ ] Tab 2: **Hóa đơn bán ra** (Danh sách hóa đơn đã phát hành + Đồng bộ từ Thuế).
    - [ ] Tab 3: **Hóa đơn mua vào** (Danh sách hóa đơn đầu vào từ Thuế).
    - [ ] Tab 4: **Cấu hình** (Gộp cấu hình SInvoice và Portal Thuế).
- [ ] 4.0 Validate
  - [ ] 4.1 `npm run build`
  - [ ] 4.2 Smoke test lấy dữ liệu từ Thuế.
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry
  - [ ] 5.2 Commit + push code
  - [ ] 5.3 Summary with evidence
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result:
- Build:
- Smoke:

## Lessons Learned
- Link: `docs/lessons-learned/<file>.md#<anchor>` or "No issue"

## Commit/Push Status
- API repo:
- Web repo (if affected):
- DB/directus staging:
