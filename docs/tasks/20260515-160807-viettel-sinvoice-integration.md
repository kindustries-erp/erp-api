# Task: Tích hợp Viettel SInvoice 2.0 (Hóa đơn đầu vào & đầu ra nháp)

## Request Input
- Type: FEATURE | ENHANCE
- Mục tiêu: Đọc tài liệu Viettel SInvoice 2.0 (v2.49) để tích hợp hóa đơn đầu vào/đầu ra cho hệ thống ERP.
- Bối cảnh/ngữ cảnh: Cần tách biệt code mới với logic Tổng cục Thuế (Tax Portal) hiện tại. Đối với hóa đơn đầu ra, chỉ thực hiện đến bước tạo bản nháp (Draft), tạm dừng các bước ký và phát hành thật.

## Goal
Tích hợp API Viettel SInvoice 2.0 để:
1. Đồng bộ hóa đơn đầu vào (Purchase Invoices) từ hệ thống Viettel.
2. Đồng bộ hóa đơn đầu ra (Sold Invoices) từ hệ thống Viettel.
3. Tạo hóa đơn đầu ra bản nháp (Draft Invoice) từ ERP lên Viettel.

## Scope
- In-scope:
    - Đọc và phân tích tài liệu Viettel SInvoice 2.0 v2.49.
    - Thiết lập cấu hình API (URL, Token, AppID) cho Viettel SInvoice.
    - Logic đồng bộ hóa đơn đầu vào/đầu ra (In/Out).
    - Logic tạo hóa đơn nháp (Draft).
- Out-of-scope:
    - Ký số hóa đơn (Sign).
    - Phát hành hóa đơn thật (Issue/Publish).
    - Logic cũ của Tax Portal (giữ nguyên nhưng tạm tắt/tách biệt).

## Relevant Files
- `src/sinvoice/sinvoice.service.ts` - Nơi chứa logic tích hợp API.
- `src/sinvoice/viettel-sinvoice.service.ts` - (Mới) Tách biệt logic Viettel SInvoice.
- `src/sinvoice/sinvoice.module.ts` - Đăng ký service mới.

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan: `tax_portal_configs` (cần thêm hoặc tận dụng cho Viettel credentials), `einvoices` (table lưu trữ hóa đơn).
- Data nền cần có: Credentials Viettel SInvoice (Username, Password, AppID, MST, Pattern, Serial).
- Constraint/index/default cần có: Đảm bảo không trùng `external_invoice_id` khi sync từ nhiều nguồn.
- Kết quả: `DB_READY`

## Coordination Impact
- [x] Directus staging schema affected (Có thể cần thêm fields cấu hình Viettel)
- [ ] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [ ] 1.0 Gate 0 DB Precheck done
- [ ] 2.0 [PLAN] Nghiên cứu tài liệu Viettel SInvoice 2.0 (v2.49)
    - [ ] 2.1 API Authentication (Get Token)
    - [ ] 2.2 API Truy vấn hóa đơn đầu vào
    - [ ] 2.3 API Truy vấn hóa đơn đầu ra
    - [ ] 2.4 API Tạo hóa đơn nháp (Draft)
- [ ] 3.0 [DEV] Khởi tạo service `ViettelSInvoiceService`
- [ ] 4.0 [DEV] Triển khai logic In/Out sync
- [ ] 5.0 [DEV] Triển khai logic Draft creation
- [ ] 6.0 Validate
  - [ ] 6.1 `npm run build`
  - [ ] 6.2 Smoke test API endpoints
- [ ] 7.0 Close
  - [ ] 7.1 Commit + push code

## Validation Evidence
- DB precheck result: `DB_READY`
- Build:
- Smoke:

## Risks + Rollback
- Risk: Token hết hạn hoặc bị rate limit.
- Rollback: Revert về code cũ (logic Tax Portal) nếu cần thiết.

## Danh sách Evidence cần thu thập
1. Nội dung JSON request/response của API Token.
2. Nội dung JSON request/response của API Query Invoices.
3. Nội dung JSON request/response của API Create Draft Invoice.

## San sàng thực thi
Sẵn sàng thực thi sau khi User xác nhận kế hoạch và kết quả đọc tài liệu.
