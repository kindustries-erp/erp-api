---
name: cashflow-dashboard
description: Module tri thức Báo cáo, Phân tích & Dự báo Dòng tiền (Cashflow Dashboard & Forecast) trong Liouni ERP (dashboard-core & bank-transactions-core). Chứa toàn bộ database schema, API endpoints, DTOs, logic tính toán KPI dòng tiền, phân bổ đối tác, dự báo chi phí và gợi ý ngân sách tự động từ sao kê.
---

# 📦 Module Tri Thức: Dashboard Phân Tích & Dự Báo Dòng Tiền (`cashflow-dashboard`) - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Module `cashflow-dashboard` (được hiện thực qua `src/bank-transactions-core/services/transaction-analytics.service.ts` và `src/dashboard-core/`) là trung tâm tình báo tài chính, chịu trách nhiệm tổng hợp, phân tích số liệu thực thu/thực chi và dự phóng dòng tiền tương lai trong hệ thống Liouni ERP.

### 1.1. Các tính năng cốt lõi:
- **KPI Dòng tiền Tổng quan (`dashboard-stats`)**:
  - `totalCashIn`: Tổng số tiền thu vào thực tế trong kỳ (từ Ghi Có ngân hàng & Thu quỹ).
  - `totalCashOut`: Tổng số tiền chi ra thực tế trong kỳ (từ Ghi Nợ ngân hàng & Chi quỹ).
  - `netCashFlow`: Dòng tiền ròng khả dụng ($\text{totalCashIn} - \text{totalCashOut}$).
  - `cashTrend`: Biểu đồ xu hướng biến động thu/chi theo chu kỳ 6 tháng gần nhất.
- **Phân bổ Cơ cấu Dòng tiền**:
  - `categoryBreakdown`: Phân bổ dòng tiền theo Danh mục/Tag chi tiêu (`sys_tags`, `sys_entity_tags`) kèm mã màu trực quan.
  - `sourceBreakdown`: So sánh tỷ trọng và biến động giữa các Nguồn tiền (Tài khoản ngân hàng vs Sổ quỹ tiền mặt).
- **Top Giao dịch Dòng tiền Lớn**:
  - `topTransactionsIn`: Top 10 giao dịch tiền vào có giá trị lớn nhất.
  - `topTransactionsOut`: Top 10 giao dịch tiền ra có giá trị lớn nhất.
- **Báo cáo Thu Chi Đối Tác (`partner-stats`)**:
  - Gom nhóm tổng thu/chi theo từng Đối tác / Tài khoản đối ứng (`correspondentName`, `correspondentAccount`).
  - Tự động liên kết và hiển thị Tên đối tác hóa đơn (`invoiceSubject`) thông qua cấn trừ hóa đơn (`erp_invoice_voucher_netoff`).
  - Hỗ trợ phân trang, sắp xếp và bộ lọc tìm kiếm động đa cột.
- **Dự phóng Dòng tiền Tương lai (`cashflow-forecast`)**:
  - **Quá khứ (`past`)**: Dữ liệu thực chi 3 tháng gần nhất để làm cơ sở xu hướng.
  - **Công nợ hiện tại (`presentLiabilities`)**: Các khoản nợ phải trả từ Đơn mua hàng chưa thanh toán (`purchase_orders`) và Chi phí vận hành chưa trả (`operating_expenses`).
  - **Cam kết định kỳ tương lai (`futureProjections`)**: Dự toán các hợp đồng/chi phí phát sinh định kỳ trong tương lai.
- **Gợi ý Ngân sách Tự động từ Sao kê (`budget-suggestions`)**:
  - Thuật toán tự động rà soát dữ liệu sao kê ngân hàng trong 6 tháng gần nhất.
  - Phát hiện các khoản chi lặp lại cho cùng đối tác ($\ge 2$ tháng khác nhau) để tự động đề xuất tạo Chi phí vận hành định kỳ.

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Sơ đồ Quan hệ Bảng (Data Relations)

```text
erp_bank_transactions (Dòng tiền thực thu / thực chi)
  ├── N:1 ── erp_bank_accounts / erp_cash_books (Nguồn tiền)
  ├── 1:N ── erp_invoice_voucher_netoff ── N:1 ── erp_invoices (Hóa đơn liên kết)
  └── 1:N ── sys_entity_tags ── N:1 ── sys_tags (Danh mục phân loại)

erp_purchase_orders (Đơn mua hàng) ──────────┐
                                             ├──> Cashflow Forecast (Dự báo dòng tiền)
erp_operating_expenses (Chi phí vận hành) ──┘
```

### 2.2. Chi tiết các Bảng tham gia Dashboard:

| Tên Bảng | Vai trò trong Dashboard | Các cột truy vấn trọng tâm |
| :--- | :--- | :--- |
| `erp_bank_transactions` | Nguồn dữ liệu dòng tiền thực tế | `id`, `source_type`, `trans_date`, `debit_amount`, `credit_amount`, `correspondent_name`, `correspondent_account`, `branch_id`, `is_deleted` |
| `erp_bank_accounts` | Master data tài khoản ngân hàng | `id`, `bank_code`, `bank_name`, `account_number`, `branch_id` |
| `erp_cash_books` | Master data sổ quỹ tiền mặt | `id`, `name`, `branch_id` |
| `sys_tags` & `sys_entity_tags` | Danh mục & Phân loại dòng tiền | `tag.id`, `tag.name`, `tag.color`, `entity_id`, `entity_type` |
| `erp_invoice_voucher_netoff` | Bảng cấn trừ hóa đơn - sao kê | `bank_transaction_id`, `invoice_id`, `net_off_amount` |
| `erp_invoices` | Dữ liệu đối tác trên hóa đơn VAT | `id`, `seller_name`, `seller_tax_code`, `buyer_name`, `buyer_tax_code`, `direction` |
| `erp_purchase_orders` | Nguồn công nợ PO & Đơn định kỳ | `id`, `po_number`, `total_amount`, `payment_status`, `is_recurring`, `branch_id` |
| `erp_operating_expenses` | Nguồn chi phí vận hành chưa trả | `id`, `code`, `amount`, `payment_status`, `is_recurring`, `branch_id` |

---

## 3. Cấu trúc Source Code Backend (`erp-api`)

```text
src/
├── bank-transactions-core/
│   ├── services/
│   │   └── transaction-analytics.service.ts   # Tính toán KPI dashboard, cash trend, category, source, partner stats
│   ├── dto/
│   │   └── bank-transaction-filter.dto.ts     # Filter: startDate, endDate, branchId, sourceType, tagIds, search
│   └── bank-transactions-core.controller.ts   # Endpoints: /dashboard-stats, /partner-stats
├── dashboard-core/
│   ├── dashboard-core.controller.ts           # Endpoints: /overview, /cashflow-forecast, /budget-suggestions
│   ├── dashboard-core.service.ts              # Tổng hợp forecast, budget suggestions và overview 4 trụ cột
│   └── dashboard-core.module.ts               # Module kết nối các service liên quan
└── reports-core/                              # Hỗ trợ báo cáo doanh thu & mua hàng cho overview
```

---

## 4. Danh sách API Endpoints & RBAC Contract

### 4.1. Endpoints Phân tích Dòng tiền (`BankTransactionsCoreController`)
Base Path: `/api/v1/bank-transactions-core`  
Guards: `JwtAuthGuard`, `CoreRbacGuard`

| Method | Endpoint | Quyền yêu cầu | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/dashboard-stats` | `{ resource: 'bank_statements', action: 'read' }` | Lấy toàn bộ chỉ số KPI dòng tiền (In, Out, Net, Trend 6 tháng, Category Donut, Source breakdown, Top 10) |
| `GET` | `/partner-stats` | `{ resource: 'bank_statements', action: 'read' }` | Báo cáo tổng hợp thu chi theo Đối tác / Tài khoản đối ứng (kèm liên kết hóa đơn VAT) |

### 4.2. Endpoints Dự báo & Điều hành Tổng hợp (`DashboardCoreController`)
Base Path: `/api/v1/dashboard-core`  
Guards: `JwtAuthGuard`

| Method | Endpoint | Quyền yêu cầu | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/cashflow-forecast` | Authenticated | Dự báo dòng tiền (Quá khứ 3 tháng + Công nợ hiện tại PO/OE + Dự phóng định kỳ tương lai) |
| `GET` | `/budget-suggestions`| Authenticated | Tự động phân tích sao kê 6 tháng gần nhất để gợi ý ngân sách chi phí vận hành định kỳ |
| `GET` | `/overview` | Authenticated | Dashboard điều hành tổng hợp 4 trụ cột: Sales, Purchasing, Inventory, Cashflow |

---

## 5. Logic Nghiệp vụ & Thuật toán Trọng tâm

### 5.1. Thuật toán Tính Xu hướng Dòng tiền 6 Tháng (`TransactionAnalyticsService`)
1. Lấy toàn bộ giao dịch thỏa mãn điều kiện lọc thời gian, chi nhánh, loại nguồn tiền (`sourceType`), và danh mục tag (`tagIds`).
2. Nhóm các giao dịch theo tháng phát sinh `YYYY-MM`.
3. Sắp xếp danh sách tháng theo thứ tự thời gian giảm dần, trích xuất **6 tháng gần nhất**, sau đó đảo lại theo thứ tự tăng dần (`0 -> 5`) để phục vụ biểu đồ Area/Bar chart.
4. Tính song song xu hướng tổng thể (`cashTrend`) và xu hướng riêng biệt cho từng Nguồn tiền (`sourceBreakdown.trend`).

### 5.2. Thuật toán Tổng hợp Thống kê Đối tác (`getPartnerStats`)
1. Gom nhóm (`GROUP BY`) theo trường đối tác:
   $$\text{groupField} = \text{COALESCE}(\text{NULLIF}(\text{correspondentName}, ''), \text{NULLIF}(\text{correspondentAccount}, ''), \text{'Khác'})$$
2. Tính tổng thu (`totalCredit`), tổng chi (`totalDebit`), và số lượng giao dịch (`transactionCount`).
3. Truy vấn phụ sang `erp_invoice_voucher_netoff` kết hợp `erp_invoices` để lấy danh sách tên & MST người bán / người mua (`invoiceSubject`), sau đó map vào từng nhóm đối tác.

### 5.3. Thuật toán Dự báo Dòng tiền (`getCashflowForecast`)
1. **Lịch sử**: Truy vấn thực chi từ `bankTransactionsService.getDashboardStats` trong 3 tháng gần nhất.
2. **Công nợ phải trả hiện tại (`presentLiabilities`)**:
   - `purchaseOrdersCoreService.findUnpaid()`: Đơn mua hàng chưa thanh toán.
   - `operatingExpensesCoreService.findUnpaid()`: Chi phí vận hành chưa thanh toán.
3. **Dự toán tương lai (`futureProjections`)**:
   - `purchaseOrdersCoreService.findRecurring()`: Các đơn PO lặp lại định kỳ.
   - `operatingExpensesCoreService.findRecurring()`: Các khoản chi phí cố định định kỳ (tiền thuê nhà, điện nước, phần mềm).

### 5.4. Thuật toán Gợi ý Ngân sách Tự động (`getBudgetSuggestions`)
1. Quét dữ liệu giao dịch chi tiền (`transaction_type = 'OUT'`) trong 6 tháng gần nhất.
2. Sử dụng truy vấn SQL có mệnh đề `HAVING`:
   ```sql
   SELECT 
     correspondent_name as title,
     AVG(amount) as "avgAmount",
     COUNT(id) as occurrences,
     MAX(trans_date) as "lastDate",
     COUNT(DISTINCT TO_CHAR(trans_date, 'YYYY-MM')) as months_count
   FROM erp_bank_transactions
   WHERE trans_date >= :startDate 
     AND transaction_type = 'OUT' 
     AND is_deleted = false
     AND correspondent_name IS NOT NULL
   GROUP BY correspondent_name
   HAVING COUNT(DISTINCT TO_CHAR(trans_date, 'YYYY-MM')) >= 2
   ORDER BY occurrences DESC
   ```
3. Trả về danh sách đối tác có chi phí lặp lại kèm số tiền bình quân (`avgAmount`) để kế toán duyệt nhanh vào bảng ngân sách định kỳ.

---

## 6. Tích hợp Liên Module

- **`bank-statement`**: Cung cấp dữ liệu gốc các giao dịch ngân hàng & sổ quỹ.
- **`purchase-orders-core`**: Cung cấp công nợ PO chưa trả và các đơn mua hàng định kỳ cho mô hình dự báo.
- **`operating-expenses-core`**: Cung cấp các khoản chi phí vận hành cần thanh toán và chi phí định kỳ.
- **`erp-invoices-core`**: Cung cấp thông tin đối tác xuất hóa đơn phục vụ đối soát công nợ đối tác trên sao kê.
- **`reports-core` & `inventory-core`**: Tích hợp chung trong màn hình điều hành tổng thể `GET /overview`.

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

1. **TypeCheck**: Chạy `bun run check:ci` trong thư mục `erp-api/`.
2. **Unit Tests**:
   - `bunx jest src/bank-transactions-core/services/transaction-analytics.service.spec.ts`
3. **Hiệu năng Truy vấn SQL**:
   - Đối với `getPartnerStats`: Đảm bảo subquery tính count và group không bị timeout khi dữ liệu giao dịch $> 100,000$ dòng.
   - Bắt buộc có index trên `erp_bank_transactions(trans_date, is_deleted, branch_id)`.
