# Task: Tích hợp API Hóa đơn điện tử Viettel (IN PROGRESS)

## Request Input
- Type: FEATURE
- Mục tiêu: Nghiên cứu và tích hợp API hóa đơn điện tử Viettel demo, tạo UI phù hợp hệ thống và test toàn bộ flow trên web.
- Bối cảnh/ngữ cảnh: User đã xác nhận thực thi sau PLAN mode; yêu cầu dùng Postgres/Directus, test web, breadcrumb trang hóa đơn giống trang Dòng tiền.

## Goal
Tích hợp quy trình quản lý hóa đơn điện tử SInvoice Viettel demo vào ERP Liouni: cấu hình, phát hành demo, tra cứu/đồng bộ, lưu log hóa đơn, và UI quản trị có breadcrumb cùng nhánh Dòng tiền.

## Scope
- In-scope:
  - Directus/Postgres collections `sinvoice_configs`, `einvoices`.
  - API NestJS `src/sinvoice/`: health, local logs, create demo, cancel, download, sync, demo-flow.
  - ERP Web `HoaDonDienTu`: dashboard KPI, danh sách log, nút đồng bộ/phát hành/test full demo flow.
  - Breadcrumb: `Kế toán > Dòng tiền > Hóa đơn điện tử` giống nhóm Dòng tiền.
- Out-of-scope:
  - Chữ ký số/HSM production.
  - Nhà cung cấp HDDT khác ngoài Viettel.
  - Gửi mail khách hàng và drawer chi tiết nâng cao.

## Gate 0 — DB Precheck
- Collections/fields liên quan:
  - Trước khi làm: chưa có `sinvoice_configs`/`einvoices` trong Directus runtime DB.
  - Đã tạo `sinvoice_configs` singleton: `supplier_tax_code`, `username`, `password`, `app_key`, `api_url`, `environment`, `is_active`.
  - Đã tạo `einvoices`: `document_no`, `invoice_no`, `pattern`, `invoice_series`, `buyer_*`, `total_amount`, `vat_amount`, `status`, `viettel_transaction_id`, payload JSONB, `error_message`.
- Data nền:
  - Demo config: `supplier_tax_code=0100109106-215`, `username=0100109106-215`, `api_url=https://demo-sinvoice.viettel.vn:8443/InvoiceAPI`, `environment=demo`.
- Constraint/index/default:
  - `sinvoice_configs_single_active_idx`.
  - `einvoices_transaction_unique`, `einvoices_invoice_no_unique`, `einvoices_ar_document_idx`, `einvoices_status_idx`.
  - Status check: `DRAFT|ISSUED|CANCELLED|ERROR|SYNCED`.
- Kết quả: `DB_GAP_FOUND` -> đã xử lý gap bằng SQL migration trực tiếp trên Directus DB đang được ERP API dùng.

## Plan Order: DB -> API -> UI

### Phase 1: DB (Directus/Postgres)
- [x] 1.1 Tạo collection `sinvoice_configs` singleton để lưu thông tin kết nối.
- [x] 1.2 Tạo collection `einvoices` để lưu thông tin hóa đơn và trạng thái từ Viettel.
- [x] 1.3 Thêm index/constraint cho active config, transaction id, invoice no, status.
- [x] 1.4 Đăng ký Directus metadata `directus_collections`/`directus_fields` để API đọc qua Directus.
- [x] 1.5 Verify API đọc được singleton config sau khi fix singleton shape.

### Phase 2: API (NestJS)
- [x] 2.1 Hoàn thiện `SinvoiceModule`, `SinvoiceService`, `SinvoiceController`.
- [x] 2.2 Implement Viettel client:
  - [x] `createInvoice` / demo payload.
  - [x] `cancelInvoice`.
  - [x] `getInvoiceRepresentationFile` / `getInvoiceFile`.
  - [x] `getInvoices` để tra cứu danh sách.
  - [x] `fullDemoFlow`: health -> create -> sync.
- [x] 2.3 Lưu log request/response/error vào `einvoices`.
- [x] 2.4 API endpoints cho ERP Web:
  - [x] `GET /api/v1/sinvoice/health`
  - [x] `GET /api/v1/sinvoice/local`
  - [x] `POST /api/v1/sinvoice/create`
  - [x] `POST /api/v1/sinvoice/cancel`
  - [x] `GET /api/v1/sinvoice/download`
  - [x] `GET /api/v1/sinvoice/sync`
  - [x] `POST /api/v1/sinvoice/demo-flow`

### Phase 3: UI (React Vite)
- [x] 3.1 Khai báo `HoaDonDienTu` page trong route/sidebar nhóm Kế toán.
- [x] 3.2 Breadcrumb giống trang Dòng tiền: `Kế toán > Dòng tiền > Hóa đơn điện tử`.
- [x] 3.3 UI Dashboard KPI: đã phát hành, bản nháp, bị hủy, lỗi.
- [x] 3.4 List View dùng `Table` chuẩn, hiển thị chứng từ, số hóa đơn, khách hàng, MST, tổng tiền, trạng thái.
- [x] 3.5 Actions: `Đồng bộ`, `Phát hành demo`, `Test full demo flow`.
- [ ] 3.6 Detail Drawer/tải PDF/XML/hủy qua row action nâng cao.
- [ ] 3.7 Tích hợp sâu vào luồng AR document.

## Gate Validations
- [x] Build API: `npm run build` thành công.
- [x] Build Web: `npx tsc --noEmit` và Docker/Vite build thành công.
- [x] Deploy API/Web bằng Docker Compose, container healthy/running.
- [x] API health: `GET /api/v1/sinvoice/health` trả `200 OK`, demo config đúng.
- [x] UI: trang `/hoa-don-dien-tu` render đúng title, KPI, table, breadcrumb giống Dòng tiền.
- [x] UI/API wiring: web gọi đúng `/api/v1/sinvoice/health`, `/local`, `/demo-flow` sau fix `API_BASE_URL`.
- [x] Full demo flow trên web: click `Test full demo flow` tạo log lỗi trong `einvoices` và UI cập nhật KPI/table.
- [ ] Viettel demo endpoint trả nghiệp vụ thành công: chưa đạt do upstream Viettel demo reset/fetch failed từ host/container.

## Risk + Rollback
- Risk: Viettel demo endpoint `demo-sinvoice.viettel.vn:8443` reset kết nối hoặc chặn môi trường, khiến create/sync trả `fetch failed` dù ERP/API/UI wiring đúng.
- Risk: Demo credentials/pattern/series có thể không còn hợp lệ cho sandbox.
- Rollback DB: drop `einvoices`, `sinvoice_configs` và metadata Directus liên quan nếu user yêu cầu.
- Rollback Code: revert API commit `df78a8d`/`5937dd0` và Web commit `37ec2cb`/`866908c` nếu cần.
- Rollback Deploy: rebuild từ commit trước trên `/opt/stacks/liouni-erp-api` và `/opt/stacks/liouni-erp-web`.

## Evidence Checklist
- [x] DB: `sinvoice_configs` có 1 active row; `einvoices` nhận log sau demo-flow.
- [x] API: `GET http://127.0.0.1:10000/api/v1/sinvoice/health` -> `200 OK` với SInvoice demo config.
- [x] API routes: Nest log mapped `/api/v1/sinvoice/*`.
- [x] Web: `/hoa-don-dien-tu` hiển thị `SInvoice demo • 0100109106-215 • https://demo-sinvoice.viettel.vn:8443/InvoiceAPI`.
- [x] Web: breadcrumb hiển thị `Kế toán › Dòng tiền › Hóa đơn điện tử`.
- [x] Web: click `Test full demo flow` làm KPI `Lỗi` tăng và thêm dòng `DEMO-*`.
- [ ] Viettel: chưa có PDF/XML thành công vì upstream create/sync thất bại `fetch failed`.

## Sẵn sàng thực thi
Đã thực thi các phần DB/API/UI/deploy/test có thể hoàn tất. Còn blocker ngoài hệ thống: Viettel demo endpoint reset/fetch failed; cần xác nhận endpoint/credentials/pattern sandbox hoặc whitelist network để đạt flow phát hành thật và tải PDF/XML.
