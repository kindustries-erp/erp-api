---
name: invoice-dashboard
description: Module tri thức Dashboard & Báo cáo Phân tích Hóa đơn (Invoice Dashboard, Cash Trend, VAT Stats, Partner Debt & Multi-sheet Excel Export) trong erp-api (erp-invoices-core). Chứa toàn bộ database schema, entities, API endpoints, logic đối soát công nợ phải thu/phải trả qua netoff và xuất báo cáo đa sheet.
---

# 📦 Module Tri Thức: Dashboard & Báo Cáo Phân Tích Hóa Đơn (`invoice-dashboard`) - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Module `invoice-dashboard` (được triển khai tại `src/erp-invoices-core/invoice-dashboard.service.ts` và `src/erp-invoices-core/invoice-dashboard.controller.ts`) là trung tâm dữ liệu phân tích hóa đơn tài chính và đối soát công nợ VAT trong hệ thống Liouni ERP.

### 1.1. Các tính năng cốt lõi:
- **Biểu đồ Xu hướng Hóa đơn theo Tháng (`cashTrend` & VAT Stats)**:
  - `cashIn`: Tổng doanh thu từ hóa đơn đầu ra (`direction = 'OUT'`).
  - `cashOut`: Tổng chi phí mua vào từ hóa đơn đầu vào (`direction = 'IN'`).
  - `vatIn`: Tổng thuế VAT đầu vào được khấu trừ (`direction = 'IN'`).
  - `vatOut`: Tổng thuế VAT đầu ra phải nộp (`direction = 'OUT'`).
- **Phân tích & Quản lý Công nợ Đối tác Hóa đơn (`getDashboardPartners`)**:
  - Tự động nhận diện vai trò đối tác: Với hóa đơn `IN`, đối tác là Bên bán (`seller_tax_code`, `seller_name`); với hóa đơn `OUT`, đối tác là Bên mua (`buyer_tax_code`, `buyer_name`).
  - Đối soát tức thời với dòng tiền thực thanh toán thông qua bảng cấn trừ chứng từ `erp_invoice_voucher_netoff`.
  - Tính toán dư nợ:
    - **Phải trả (`payableAmount`)**: $\max(\text{totalInAmount} - \text{paidAmount}, 0)$ (Hóa đơn đầu vào chưa thanh toán đủ qua sổ quỹ/ngân hàng).
    - **Phải thu (`receivableAmount`)**: $\max(\text{totalOutAmount} - \text{receivedAmount}, 0)$ (Hóa đơn đầu ra chưa thu đủ tiền từ khách).
  - Hỗ trợ phân trang, tìm kiếm toàn văn (`search`), lọc từng cột (`column_search`), lọc danh sách giá trị (`column_filters`) và sắp xếp theo công nợ.
- **Thống kê Lịch sử Xu hướng Từng Đối tác (`getPartnerStats`)**:
  - Tra cứu xu hướng thu/chi theo tháng của riêng một mã số thuế đối tác cụ thể (`seller_tax_code` hoặc `buyer_tax_code`).
- **Xuất Báo Cáo Excel Đa Bảng Chuyên Sâu 5 Worksheets (`exportExcel`)**:
  - **Sheet 1: Tổng quan**: Xu hướng Doanh thu & Chi phí theo từng tháng.
  - **Sheet 2: Phải thu**: Danh sách khách hàng kèm dư nợ phải thu (sắp xếp giảm dần).
  - **Sheet 3: Phải trả**: Danh sách nhà cung cấp kèm dư nợ phải trả (sắp xếp giảm dần).
  - **Sheet 4: Chi tiết phải thu**: Toàn bộ chi tiết các hóa đơn đầu ra (OUT) kèm trạng thái thu tiền.
  - **Sheet 5: Chi tiết phải trả**: Toàn bộ chi tiết các hóa đơn đầu vào (IN) kèm trạng thái trả tiền.

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Sơ đồ Quan hệ Dữ liệu (ER Diagram)

```text
erp_invoices (Hóa đơn điện tử / Thuế)
  ├── 1:N ── erp_invoice_voucher_netoff ── N:1 ── erp_bank_transactions (Dòng tiền thực thu/chi)
  ├── N:1 ── erp_branches (Chi nhánh)
  └── 1:N ── erp_invoice_items (Chi tiết mặt hàng)
```

### 2.2. Chi tiết các Bảng tham gia Dashboard:

| Tên Bảng | Vai trò trong Dashboard | Các cột truy vấn trọng tâm |
| :--- | :--- | :--- |
| `erp_invoices` | Nguồn dữ liệu hóa đơn gốc | `id`, `branch_id`, `invoice_no`, `serial_no`, `invoice_date`, `direction` (`IN`/`OUT`), `seller_name`, `seller_tax_code`, `buyer_name`, `buyer_tax_code`, `pre_vat_amount`, `vat_amount`, `total_amount`, `tax_invoice_status`, `status`, `is_deleted` |
| `erp_invoice_voucher_netoff` | Bảng cấn trừ hóa đơn - chứng từ thanh toán | `id`, `invoice_id`, `bank_transaction_id`, `net_off_amount` |
| `erp_bank_transactions` | Giao dịch sao kê ngân hàng & sổ quỹ tiền mặt | `id`, `trans_date`, `debit_amount`, `credit_amount`, `is_deleted` |

### 2.3. Quy tắc Lọc Bắt buộc (Business Filter Rules):
- Bỏ qua các hóa đơn đã bị xóa mềm: `inv.is_deleted = false`.
- Bỏ qua các hóa đơn bị hủy trên hệ thống thuế: `(inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)` (Trạng thái `4` = Hóa đơn đã bị hủy/thay thế).

---

## 3. Cấu trúc Source Code Backend (`erp-api`)

```text
src/erp-invoices-core/
├── invoice-dashboard.controller.ts     # Controller khai báo endpoints, Swagger & RBAC guard
├── invoice-dashboard.service.ts        # Service xử lý aggregation SQL, tính công nợ & xuất ExcelJS
├── erp-invoices-core.module.ts         # Đăng ký Controller & Service, exports cho module khác
├── entities/
│   ├── erp_invoice.entity.ts           # Entity hóa đơn chính
│   └── erp_invoice_voucher_netoff.entity.ts # Entity cấn trừ hóa đơn - sao kê
└── dto/                                # DTOs dùng chung cho invoice module
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Base Path: `/api/v1/erp-invoices/dashboard`  
Guards: `JwtAuthGuard`, `CoreRbacGuard`  
Resource RBAC: `invoices`

| Method | Endpoint | Quyền yêu cầu | Query Parameters | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/stats` | `{ resource: 'invoices', action: 'read' }` | `date_from`, `date_to`, `branch_id` | Lấy biểu đồ xu hướng hóa đơn theo tháng (`cashIn`, `cashOut`, `vatIn`, `vatOut`) |
| `GET` | `/partners` | `{ resource: 'invoices', action: 'read' }` | `page`, `pageSize`, `search`, `date_from`, `date_to`, `branch_id`, `sortBy`, `sortOrder`, `column_search`, `column_filters` | Danh sách phân trang tổng hợp doanh thu/chi phí và công nợ phải thu/phải trả theo đối tác |
| `GET` | `/partners/:taxCode/stats` | `{ resource: 'invoices', action: 'read' }` | `taxCode` (param), `date_from`, `date_to` | Biểu đồ xu hướng doanh thu/chi phí riêng của một đối tác theo MST |
| `GET` | `/export` | `{ resource: 'invoices', action: 'read' }` | `date_from`, `date_to`, `branch_id` | Xuất file báo cáo Excel 5 worksheets (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) |

---

## 5. Logic Nghiệp vụ & Thuật toán Trọng tâm

### 5.1. Thuật toán Tổng hợp Xu hướng Hóa đơn Tháng (`getDashboardStats`)
1. Sử dụng QueryBuilder gom nhóm theo tháng phát sinh: `TO_CHAR(inv.invoice_date, 'YYYY-MM')`.
2. Phân loại theo chiều `direction`:
   - `cashIn`: `SUM(CASE WHEN inv.direction = 'OUT' THEN CAST(inv.total_amount AS NUMERIC) ELSE 0 END)`
   - `cashOut`: `SUM(CASE WHEN inv.direction = 'IN' THEN CAST(inv.total_amount AS NUMERIC) ELSE 0 END)`
   - `vatIn`: `SUM(CASE WHEN inv.direction = 'IN' THEN CAST(inv.vat_amount AS NUMERIC) ELSE 0 END)`
   - `vatOut`: `SUM(CASE WHEN inv.direction = 'OUT' THEN CAST(inv.vat_amount AS NUMERIC) ELSE 0 END)`
3. Xử lý thời gian `dateTo`: Nếu độ dài chuỗi là 10 (`YYYY-MM-DD`), tự động bổ sung `23:59:59.999`.
4. Xử lý chi nhánh: Hỗ trợ lọc `branch_id = 'null'` (hóa đơn chưa phân chi nhánh) hoặc UUID chi nhánh cụ thể.

### 5.2. Thuật toán Nhóm Đối tác & Tính Công nợ Cấn trừ (`getDashboardPartners`)
1. **Dynamic Grouping**: Gom nhóm theo mã số thuế và tên đối tác tùy theo chiều hóa đơn:
   ```sql
   SELECT 
     CASE WHEN inv.direction = 'IN' THEN inv.seller_tax_code WHEN inv.direction = 'OUT' THEN inv.buyer_tax_code END as "taxCode",
     MAX(CASE WHEN inv.direction = 'IN' THEN inv.seller_name WHEN inv.direction = 'OUT' THEN inv.buyer_name END) as "partnerName",
     SUM(CASE WHEN inv.direction = 'IN' THEN CAST(inv.total_amount AS NUMERIC) ELSE 0 END) as "totalInAmount",
     SUM(CASE WHEN inv.direction = 'OUT' THEN CAST(inv.total_amount AS NUMERIC) ELSE 0 END) as "totalOutAmount",
     SUM(CASE WHEN inv.direction = 'IN' THEN COALESCE(netoff.net_off_amount, 0) ELSE 0 END) as "paidAmount",
     SUM(CASE WHEN inv.direction = 'OUT' THEN COALESCE(netoff.net_off_amount, 0) ELSE 0 END) as "receivedAmount"
   FROM erp_invoices inv
   LEFT JOIN (
     SELECT invoice_id, SUM(net_off_amount) as net_off_amount
     FROM erp_invoice_voucher_netoff
     GROUP BY invoice_id
   ) netoff ON netoff.invoice_id = inv.id
   WHERE inv.is_deleted = false AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
   GROUP BY 1 HAVING 1 IS NOT NULL AND 1 != ''
   ```
2. **Dynamic Filter & Search**:
   - `search`: Quét `ILIKE` trên cả `taxCode` và `partnerName`.
   - `column_search`: Parse JSON để tìm kiếm từng cột riêng biệt.
   - `column_filters`: Parse JSON mảng giá trị `IN (...)`.
   - `sortBy = 'payableAmount'`: Tự động thêm điều kiện `(p."totalInAmount" - p."paidAmount") > 0` và order theo chênh lệch.
   - `sortBy = 'receivableAmount'`: Tự động thêm điều kiện `(p."totalOutAmount" - p."receivedAmount") > 0` và order theo chênh lệch.
3. **Tính Dư Nợ Client Output**:
   - `payableAmount`: `totalInAmount > paidAmount ? totalInAmount - paidAmount : 0`
   - `receivableAmount`: `totalOutAmount > receivedAmount ? totalOutAmount - receivedAmount : 0`

### 5.3. Thuật toán Xuất Excel 5 Worksheets (`exportExcel`)
Sử dụng thư viện `ExcelJS` dựng workbook với định dạng bảng chuyên nghiệp:
- **Style chuẩn**: Header in đậm (`bold: true`), căn giữa (`alignment: center`), nền xám nhạt (`fgColor: FFE0E0E0`), đóng băng dòng tiêu đề (`frozen: ySplit 1`), bật bộ lọc tự động (`autoFilter`).
- **Định dạng số**: Cột tiền tệ được format số chuẩn `#,##0.00`.
- **Phân tách luồng chi tiết**: Tự động bóc tách hóa đơn đầu ra vào sheet *Chi tiết phải thu* và hóa đơn đầu vào vào sheet *Chi tiết phải trả*.

---

## 6. Tích hợp Liên Module & Frontend

- **`erp-invoices-core`**: Cung cấp toàn bộ dữ liệu hóa đơn, XML, trạng thái hóa đơn điện tử.
- **`bank-transactions-core`**: Dữ liệu thanh toán sổ quỹ & sao kê qua bảng cấn trừ `erp_invoice_voucher_netoff`.
- **`dashboard-core`**: `DashboardCoreService` có thể tích hợp dữ liệu hóa đơn vào overview điều hành chung.
- **Frontend (`erp-web`)**:
  - API Client: `src/modules/erp-invoices-core/api/erpInvoiceDashboardApi.ts`
  - Màn hình chính: `src/pages/InvoiceDashboard.tsx`
  - Drawers & Biểu đồ: `PartnerInvoiceDrawer.tsx`, `BranchVatChart.tsx`, `BranchInvoiceChart.tsx`.

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

1. **TypeCheck**: Chạy `bun run check:ci` trong `erp-api/`.
2. **Index Database**: Đảm bảo bảng `erp_invoices` có index trên:
   - `direction`
   - `(seller_tax_code, buyer_tax_code)`
   - `(invoice_date, is_deleted, branch_id)`
3. **Bảo toàn Số liệu**:
   - Không được tính hóa đơn hủy (`tax_invoice_status = 4`) vào doanh thu/chi phí/công nợ.
   - Khi cấn trừ một hóa đơn nhiều lần qua nhiều phiếu thanh toán, subquery `GROUP BY invoice_id` phải đảm bảo không nhân đôi dòng (fan-out prevention).
