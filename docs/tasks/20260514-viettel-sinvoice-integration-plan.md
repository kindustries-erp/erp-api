# Task: Tích hợp API Hóa đơn điện tử Viettel (IN PROGRESS)

## Request Input
- Type: FEATURE
- Mục tiêu: Nghiên cứu và tích hợp toàn bộ API hóa đơn điện tử Viettel, tạo UI phù hợp, đẹp, hòa hợp hệ thống và tận dụng hết tính năng API.
- Bối cảnh/ngữ cảnh: User cung cấp tài liệu tích hợp Viettel SInvoice qua Postman. Cần lập kế hoạch chi tiết (PLAN mode).

## Goal
Tích hợp quy trình quản lý hóa đơn điện tử (SInvoice Viettel) vào hệ thống ERP Liouni, bao gồm: khởi tạo hóa đơn, hủy hóa đơn, tra cứu/tải file hóa đơn (PDF/XML), chuyển đổi hóa đơn giấy, và quản lý danh sách hóa đơn.

## Scope
- In-scope:
    - Module `SInvoiceIntegration` tại API.
    - Module `HoaDonDienTu` tại ERP Web.
    - Luồng: Khởi tạo hóa đơn (Create) -> Ký số (Sign) -> Phát hành (Issue) -> Quản lý (Manage).
    - Tải file PDF/XML hóa đơn từ Viettel.
    - Hủy hóa đơn rủi ro/sai sót.
    - UI: Dashboard hóa đơn, Danh sách hóa đơn, Drawer chi tiết & thao tác.
- Out-of-scope:
    - Đăng ký tài khoản SInvoice (User tự cung cấp credentials).
    - Tích hợp các nhà cung cấp HDDT khác ngoài Viettel.

## Relevant Files
- API:
    - `src/sinvoice/` (Mới) - Module xử lý tích hợp Viettel API.
    - `src/app.module.ts` - Register module mới.
- Web:
    - `src/modules/accounting/pages/HoaDonDienTu.tsx` (Mới) - Trang quản lý chính.
    - `src/modules/accounting/components/HoaDonDrawer.tsx` (Mới) - Drawer chi tiết.
    - `src/services/sinvoiceApi.ts` (Mới) - Client gọi API tích hợp.

## Gate 0 — DB Precheck (PLAN ONLY)
- Collections/fields liên quan:
    - `einvoices`: collection lưu thông tin hóa đơn đã đồng bộ/phát hành.
    - Fields: `document_no`, `invoice_no`, `invoice_date`, `total_amount`, `vat_amount`, `status`, `viettel_transaction_id`, `pdf_url`, `xml_url`.
- Data nền cần có:
    - Bảng cấu hình `sinvoice_config`: lưu `supplierTaxCode`, `username`, `password`, `appKey`, `url_api`.
- Constraint/index/default cần có:
    - Unique index trên `viettel_transaction_id` hoặc `invoice_no` (khi đã phát hành).
- Kết quả: `DB_GAP_FOUND` (Cần tạo collections mới để lưu log và data hóa đơn).

## Plan Order: DB -> API -> UI

### Phase 1: DB (Directus Staging)
- [ ] 1.1 Tạo collection `sinvoice_configs` (Singleton) để lưu thông tin kết nối.
- [ ] 1.2 Tạo collection `einvoices` để lưu thông tin hóa đơn và trạng thái từ Viettel.
- [ ] 1.3 Tạo quan hệ M2O từ `einvoices` tới các chứng từ gốc (ví dụ `ar_documents`) để biết hóa đơn phát hành cho chứng từ nào.
- [ ] 1.4 Phân quyền read/write cho admin và role kế toán.

### Phase 2: API (NestJS)
- [ ] 2.1 Tạo `SinvoiceModule`, `SinvoiceService`.
- [ ] 2.2 Implement Viettel Client:
    - `createInvoice`: Khởi tạo hóa đơn nháp/chờ ký.
    - `issueInvoice`: Phát hành hóa đơn (nếu dùng chữ ký số server-side/HSM).
    - `cancelInvoice`: Hủy hóa đơn.
    - `getInvoiceRepresentationFile`: Lấy file PDF/Zip.
    - `getInvoices`: Tra cứu danh sách hóa đơn từ server Viettel để đồng bộ.
- [ ] 2.3 Webhook handler (nếu Viettel hỗ trợ callback) để cập nhật trạng thái hóa đơn tự động.
- [ ] 2.4 API endpoints cho ERP Web:
    - `POST /api/v1/sinvoice/issue/:doc_id`
    - `GET /api/v1/sinvoice/download/:invoice_id?type=pdf`
    - `GET /api/v1/sinvoice/sync`

### Phase 3: UI (React Vite)
- [x] 3.1 Khai báo `HoaDonDienTu` page trong route và sidebar (nhóm Kế toán).
- [ ] 3.2 UI Dashboard: Thống kê hóa đơn đã phát hành, chờ ký, bị hủy trong tháng.
- [ ] 3.3 List View:
    - Sử dụng `Table` chuẩn của hệ thống.
    - Filter theo ngày, trạng thái, khách hàng.
    - Action buttons: "Phát hành hóa đơn", "Đồng bộ từ Viettel".
- [ ] 3.4 Detail Drawer:
    - Hiển thị thông tin hóa đơn (Preview nội dung).
    - Buttons: "Tải PDF", "Tải XML", "Hủy hóa đơn", "Gửi mail khách hàng".
- [ ] 3.5 Tích hợp vào luồng AR: Khi xem một Hóa đơn bán hàng (`ar_documents`), thêm nút "Tạo hóa đơn điện tử" trực tiếp.

## Gate Validations
- [ ] API: Request tới Viettel Demo Sandbox thành công với Basic Auth.
- [ ] API: Parse được dữ liệu XML/JSON trả về từ Viettel.
- [ ] UI: Hiển thị đúng trạng thái hóa đơn đồng bộ từ API.

## Risk + Rollback
- Risk: Token/Basic Auth hết hạn hoặc Viettel đổi Endpoint API.
- Rollback DB: Xóa collections mới tạo.
- Rollback Code: Revert commits API/Web.

## Evidence Checklist (to be collected)
- [ ] DB: Ảnh snapshot schema `einvoices`.
- [ ] API: Log request/response thành công tới Viettel (Demo).
- [ ] UI: Ảnh màn hình danh sách hóa đơn và Drawer chi tiết.
- [ ] UI: Link tải PDF hóa đơn test thành công.

## Sẵn sàng thực thi
Trạng thái: **PLAN ONLY**. Chờ xác nhận từ user để bắt đầu thực hiện Phase 1 (DB).
