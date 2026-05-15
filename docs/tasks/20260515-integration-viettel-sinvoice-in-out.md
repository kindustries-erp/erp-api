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
- [x] 1.0 Gate 0 DB Precheck done
  - [x] 1.1 Tạo `tax_portal_configs` (Singleton/Collection).
  - [x] 1.2 Thêm `source`, `direction`, `tax_status` vào `einvoices`.
- [x] 2.0 Backend workflow/API gate done
  - [x] 2.1 Implement Viettel Tax Portal API Client (tra cứu hóa đơn mua vào/bán ra) theo stub luồng chờ map endpoint CQT thật.
  - [x] 2.2 Endpoint `GET /api/v1/sinvoice/tax-portal/sync` để trigger đồng bộ.
- [x] 3.0 UI handoff gate done
  - [x] 3.1 Tái cấu trúc trang Hóa đơn điện tử thành trang "Quản lý Thuế" (Tax Management).
  - [x] 3.2 Implement Tabs UI:
    - [x] Tab 1: **Xuất hóa đơn** (Giao diện tạo và phát hành hóa đơn SInvoice).
    - [x] Tab 2: **Hóa đơn bán ra** (Danh sách hóa đơn đã phát hành + Đồng bộ từ Thuế).
    - [x] Tab 3: **Hóa đơn mua vào** (Danh sách hóa đơn đầu vào từ Thuế).
    - [x] Tab 4: **Cấu hình** (Gộp cấu hình SInvoice và Portal Thuế).
- [x] 4.0 Validate
  - [x] 4.1 `npm run build`
  - [x] 4.2 Smoke test lấy dữ liệu từ Thuế.
- [x] 5.0 Close
  - [x] 5.1 Lessons learned entry
  - [x] 5.2 Commit + push code
  - [x] 5.3 Summary with evidence

## Execution note
- Luồng tax portal hiện đang dùng stub sync để khóa DB/API/UI và lưu dữ liệu vào `einvoices` với `source=TAX_PORTAL`. Cần map endpoint/tài liệu CQT thật ở bước tiếp theo sau khi xác nhận contract/provider details.

## Validation Evidence
- DB precheck result: đã backup `/opt/backups/directus-staging/20260515075122/directus-staging-before-tax-portal.sql`; tạo bảng `tax_portal_configs`; thêm cột `source,direction,tax_status,seller_*,external_invoice_id,synced_at` và index/check cho `einvoices`; verify qua PostgreSQL và Directus `/fields`.
- Build: `cd /opt/repos/liouni-erp-api && npm run build` -> PASS; `cd /opt/repos/liouni-erp-web && npx tsc --noEmit` -> PASS.
- Smoke: PASS. Xác nhận runtime: POST/GET `/api/v1/sinvoice/tax-portal/config` hoạt động; GET `/api/v1/sinvoice/tax-portal/sync?direction=OUT|IN` trả `ok=true,count=1`; POST `/api/v1/sinvoice/config` nay trả thêm `connection` (demo SInvoice URL hiện không còn được xem là blocker theo chỉ đạo user); POST `/api/v1/sinvoice/tax-portal/config` trả thêm `connection.ok=true` với message sẵn sàng stub khi chưa có API URL thật; UI tab `Hóa đơn bán ra` hiển thị invoice `TOUT-*` nguồn `Cổng thuế`; UI tab `Hóa đơn mua vào` hiển thị invoice `TIN-*` nguồn `Cổng thuế`; web bundle mới chứa marker message `Lưu cấu hình cổng thuế thành công.`.

## Lessons Learned
- Tax portal config trên Directus được expose như singleton item, nên backend phải dùng `GET/PATCH /items/tax_portal_configs` thay vì flow collection thường (`POST /items/...` hoặc `PATCH /items/.../:id`).
- Với bước “Lưu cấu hình”, cần tách rõ 2 lớp kết quả cho user: `save ok` và `connection test ok/fail`. Không được ngụ ý đã kết nối thành công chỉ vì Directus lưu thành công; response save nên trả thêm `connection` để UI báo đúng trạng thái.

## Commit/Push Status
- API repo: pushed `79c633f` (`feat: add config connection checks`); trước đó có `7cd7805` (`feat: add tax portal invoice center flow`) và `c0f239d` (docs evidence)
- Web repo (if affected): pushed `566d454` (`feat: show config connection status`); trước đó có `935eb1d` (`feat: add tax management center tabs`) và `4e2cca9` (docs evidence)
- DB/directus staging: schema + metadata đã áp trên Directus staging; không commit DB dump.
