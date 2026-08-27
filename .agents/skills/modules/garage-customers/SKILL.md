---
name: garage-customers
description: Module tri thức Quản lý Hồ sơ & Sổ Công nợ Khách Hàng Garage (Garage Customers Debt, Aging Buckets, Pure Cashflow Settlements & Detail Drawer) trong erp-api (kgara-api-core) và erp-web. Chứa toàn bộ database schema, API endpoints, logic nhóm dữ liệu, phân tầng tuổi nợ, bộ lọc đa chiều và giao diện bảng/drawer chuẩn hóa.
---

# 📦 Module Tri Thức: Quản Lý Hồ Sơ & Sổ Công Nợ Khách Hàng Garage (Garage Customers & Debt) - Backend & Frontend

## 1. Tổng quan Nghiệp vụ

Phân hệ Quản lý Khách Hàng & Công Nợ Dịch Vụ Garage (`garage-customers` thuộc `kgara-api-core` backend và `modules/garage` frontend) chịu trách nhiệm tổng hợp, theo dõi, phân tích và quản lý toàn bộ công nợ phải thu của khách hàng phát sinh từ các phiếu dịch vụ sửa chữa xe tại xưởng dịch vụ KGara (Greenway).

### Các Nghiệp vụ Trọng tâm:
- **Tổng hợp Công nợ theo Khách Hàng (`GET /cases/customers-debt`)**:
  - Nhóm dữ liệu phiếu dịch vụ từ bảng `kgara_cases` theo mã khách hàng (`khach_hang_code`).
  - **Mốc thời gian theo dõi**: Áp dụng mốc chặn dưới từ tháng 07/2026 (`ngay_phat_sinh >= '2026-07-01'`).
  - **Chỉ tính Phiếu Hoàn tất**: Chỉ tổng hợp các phiếu dịch vụ đã kết thúc/hoàn tất (`tinh_trang_dich_vu = 3` hoặc `ten_tinh_trang_dich_vu ILIKE '%kết thúc%' / '%hoàn tất%'`), tự động loại trừ các phiếu tiếp nhận, đang sửa, báo giá hoặc đã hủy.
- **Phân Tầng Tuổi Nợ (Aging Buckets Matrix)**:
  - Tự động tính toán số ngày tuổi nợ dựa trên khoảng cách giữa ngày phát sinh phiếu dịch vụ và ngày hiện tại: $\text{agingDays} = \text{CURRENT\_DATE} - \text{DATE(ngay\_phat\_sinh)}$.
  - Phân loại 4 nhóm tuổi nợ chuẩn tài chính:
    1. `0-30` ngày: Trong hạn.
    2. `31-60` ngày: Cần theo dõi.
    3. `61-90` ngày: Quá hạn.
    4. `>90` ngày: Quá hạn sâu.
  - Phản ánh chi tiết số tiền nợ còn lại trong từng bracket và xác định `maxAgingDays` cho từng khách hàng.
- **Phân Loại Tiến Độ Thanh Toán (Payment Progress)**:
  - `PAID` (Đã thu đủ): `con_phai_thu <= 0 AND da_thanh_toan > 0`.
  - `PARTIAL` (Thu một phần): `da_thanh_toan > 0 AND con_phai_thu > 0`.
  - `UNPAID` (Chưa thu): `da_thanh_toan <= 0 AND con_phai_thu > 0`.
- **Chuẩn Quản Lý Dòng Tiền Thuần ERP (Pure Cashflow Standard)**:
  - Công nợ và số tiền thực thu **chỉ được ghi nhận và đối soát từ các giao dịch dòng tiền thực tế** trong bảng `kgara_case_settlements` (`ON_SYSTEM`: Sao kê ngân hàng, `OFF_SYSTEM_MANUAL`: Tiền mặt sổ quỹ).
  - Không cộng dồn số tiền trên hóa đơn VAT (`erp_invoices`) vào dòng tiền thực thu nếu không có giao dịch sao kê/tiền mặt đối soát kèm theo.
- **Bộ Lọc Đa Chiều Nâng Cao & Cascading Options**:
  - Hỗ trợ đầy đủ bộ lọc cột qua `TableColumnHeaderFilter`: tìm kiếm từ khóa con (`ILIKE`), tìm kiếm chính xác, tìm kiếm nhiều từ khóa cách nhau bởi dấu chấm phẩy (`;`).
  - Hỗ trợ `__ALL_MATCHING__` (chọn tất cả kết quả tìm kiếm không sót trang) và `__BLANK__` (lọc khách hàng chưa có mã hoặc thông tin trống).
  - Tích hợp endpoint `GET /cases/customers-debt/column-options` hỗ trợ cascading filter qua tham số `filtersStr`.
- **Hồ Sơ Chi Tiết & Drawer Bán Hàng 2 Cột (`GarageCustomerDetailDrawer`)**:
  - Hiển thị danh sách toàn bộ phiếu dịch vụ của khách hàng (`GET /cases/by-customer/:customerCode`).
  - Tích hợp bộ đo KPI tài chính (Tổng phát sinh, Đã thu, Dư nợ, Tỷ lệ thu hồi, Tuổi nợ lớn nhất).
  - Bảng danh sách phiếu dịch vụ tích hợp đầy đủ 5 Quick Actions chuẩn hóa đồng bộ 100% với `/garage-cases`:
    1. 👁️ **Xem chi tiết** (`Eye`): Mở Drawer chi tiết vụ việc ở chế độ xem (`view`).
    2. ✏️ **Chỉnh sửa** (`Pencil`): Mở Drawer chi tiết vụ việc trực tiếp ở chế độ chỉnh sửa (`edit`).
    3. 🔄 **Đồng bộ từ KGara** (`RefreshCw`): Kích hoạt `useSyncGarageCaseDetail` đồng bộ chi tiết phiếu trực tiếp từ KGara về ERP.
    4. ⚖️ **Cấn trừ sao kê** (`Scale`): Mở modal [`GarageCaseSettlementDrawerModal`](file:///home/dev/repos/erp/erp-web/src/modules/garage/components/GarageCaseSettlementDrawerModal.tsx) cấn trừ giao dịch sao kê/tiền mặt vào phiếu dịch vụ ngay trong Drawer.
    5. 🔗 **Liên kết hóa đơn** (`Link2`): Mở drawer [`InvoiceSelectionDrawer`](file:///home/dev/repos/erp/erp-web/src/modules/garage/components/InvoiceSelectionDrawer.tsx) liên kết hóa đơn VAT đầu ra/đầu vào cho phiếu dịch vụ.
  - Tự động làm mới cache query (`garage-cases-by-customer`, `garage-customers-debt`, `garage-case-financial-summary`) ngay sau khi hoàn tất cấn trừ hoặc liên kết hóa đơn.

---

## 2. Database Schema & Quan hệ Dữ liệu

Dữ liệu của module `garage-customers` được truy vấn và tổng hợp chủ yếu từ bảng `kgara_cases` kết hợp làm giàu dữ liệu từ `kgara_case_settlements` và `kgara_branches`.

### 2.1. Cấu trúc Bảng `kgara_cases` (Trích xuất các trường phục vụ Công nợ KH)

| Tên Cột | Kiểu Dữ Liệu | Nullable | Mô tả / Ý nghĩa Nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` (PK) | NO | Khóa chính nội bộ ERP (`gen_random_uuid()`) |
| `hd_phieu_dich_vu_id` | `varchar(100)` | NO | Mã định danh vụ việc từ KGara (**Unique Index**) |
| `so_chung_tu` | `varchar(100)` | YES | Số chứng từ phiếu dịch vụ (vd: `PDV-202607-001`) |
| `bien_so_xe` | `varchar(50)` | YES | Biển số phương tiện sửa chữa |
| `khach_hang_code` | `varchar(100)` | YES | Mã định danh khách hàng (**Nhóm Group By**) |
| `khach_hang_name` | `varchar(255)` | YES | Tên đầy đủ của khách hàng / chủ phương tiện |
| `tinh_trang_dich_vu` | `int` | YES | Trạng thái dịch vụ (`3`: Kết thúc / Hoàn tất) |
| `ten_tinh_trang_dich_vu`| `varchar(100)`| YES | Tên trạng thái hiển thị (`'Kết thúc'`, `'Hoàn tất'`) |
| `tien_co_thue` | `numeric(18,2)`| YES | Tổng giá trị phiếu có thuế (Mục tiêu thu doanh thu) |
| `tien_da_thanh_toan` | `numeric(18,2)`| YES | Số tiền khách hàng đã thanh toán |
| `tien_con_phai_thanh_toan` | `numeric(18,2)`| YES | Dư nợ còn phải thu của phiếu |
| `ngay_phat_sinh` | `timestamp` | YES | Ngày phát sinh phiếu (Mốc tính tuổi nợ Aging) |
| `branch_external_id` | `varchar(100)`| YES | Mã chi nhánh KGara quản lý (**Index**) |
| `kgara_deleted_at` | `timestamptz` | YES | Thời điểm bị xóa mềm trên KGara (`NULL` là hợp lệ) |

### 2.2. Cấu trúc Bảng `kgara_case_settlements` (Giao Dịch Cấn Trừ Dòng Tiền Thực Tế)

| Tên Cột | Kiểu Dữ Liệu | Nullable | Mô tả / Ý nghĩa Nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` (PK) | NO | Khóa chính bản ghi cấn trừ |
| `case_id` | `uuid` (FK) | NO | Khóa ngoại tham chiếu `kgara_cases.id` (ON DELETE CASCADE) |
| `settlement_type` | `varchar(20)` | NO | Phân loại: `'RECEIPT'` (Thu tiền khách), `'PAYMENT'` (Chi trả NCC) |
| `source_channel` | `varchar(50)` | NO | Kênh: `'ON_SYSTEM'` (Sao kê ERP), `'OFF_SYSTEM_MANUAL'` (Sổ quỹ tiền mặt) |
| `amount` | `numeric(18,2)`| NO | Số tiền cấn trừ thực tế |
| `bank_transaction_id` | `uuid` (FK) | YES | FK tham chiếu bảng `bank_transactions` (nếu là ON_SYSTEM) |
| `trans_date` | `timestamp` | YES | Ngày giao dịch thực tế |
| `note` | `text` | YES | Ghi chú lý do cấn trừ |

---

## 3. Cấu trúc Source Code Backend & Frontend

```text
# BACKEND (erp-api)
src/kgara-api-core/
├── entities/
│   ├── kgara_case.entity.ts               # Entity vụ việc / phiếu dịch vụ (chứa khachHangCode, khachHangName, ...)
│   ├── kgara_case_settlement.entity.ts    # Entity cấn trừ giao dịch dòng tiền (RECEIPT / PAYMENT)
│   └── kgara_branch.entity.ts             # Entity chi nhánh xưởng dịch vụ
├── kgara-api-core.controller.ts           # Controller chứa endpoints /cases/customers-debt, column-options, by-customer
└── kgara-api-core.module.ts               # Module NestJS đăng ký Providers và Repositories

# FRONTEND (erp-web)
src/modules/garage/
├── api/
│   └── garageApi.ts                       # Axios Client gọi API getCustomersDebt, columnOptions, byCustomer
├── components/
│   ├── GarageCustomerDetailDrawer.tsx     # Drawer 2 cột chuẩn hóa hiển thị hồ sơ công nợ và danh sách phiếu DV
│   ├── GarageCaseSettlementDrawerModal.tsx # Modal cấn trừ giao dịch dòng tiền (sao kê/tiền mặt) cho phiếu dịch vụ
│   ├── InvoiceSelectionDrawer.tsx         # Drawer liên kết hóa đơn VAT đầu ra/đầu vào cho phiếu dịch vụ
│   ├── GarageCaseStandaloneDrawer.tsx     # Drawer chi tiết / chỉnh sửa vụ việc
│   └── KgaraCaseStatusBadge.tsx           # Badge trạng thái dịch vụ
├── hooks/
│   ├── useGarageCustomersList.ts          # Custom React Query hook quản lý filter, sort, paging, summary
│   └── useGarage.ts                       # Hook lấy danh sách chi nhánh
├── pages/
│   └── GarageCustomers.tsx                # Trang bảng tính công nợ khách hàng (Spreadsheet Table chuẩn hóa)
└── store/
    └── garageStore.ts                     # Zustand store lưu trữ chi nhánh đang chọn (selectedBranchId)
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/greenway`  
Quyền hạn truy cập: `@RequirePermissions({ resource: 'garage', action: 'read' })`

### 4.1. `GET /cases/customers-debt` (Bảng Tổng Hợp Công Nợ Khách Hàng)

- **Mô tả**: Truy vấn danh sách khách hàng kèm tổng hợp số phiếu, doanh thu phát sinh, đã thu, dư nợ còn lại và 4 phân khoảng tuổi nợ (Aging).
- **Header**: `x-kgara-branch-id` (tùy chọn theo chi nhánh).
- **Query Parameters**:
  - `page`: Số trang (mặc định `1`).
  - `pageSize`: Kích thước trang (mặc định `20`).
  - `q`: Từ khóa tìm kiếm đa trường (mã KH, tên KH, biển số xe, số chứng từ).
  - `from`: Ngày bắt đầu (mặc định không được nhỏ hơn baseline `2026-07-01`).
  - `to`: Ngày kết thúc.
  - `sorts`: Danh sách sắp xếp đa cột (vd: `["-balanceAmount", "customerName"]`).
  - `filtersStr` / `column_filters`: JSON string chứa bộ lọc các cột (`customerCode`, `customerName`, `branchName`, `paymentProgress`, `maxAgingDays`, `caseCount`, `totalAmount`).
  - `column_search`: JSON string tìm kiếm nhanh theo từng cột.

- **Cấu trúc Dữ liệu Phản hồi (JSON Response Contract)**:
```json
{
  "data": [
    {
      "customerCode": "KH-00124",
      "customerName": "Công ty TNHH Vận Tải An Khánh",
      "branchExternalId": "BR-01",
      "caseCount": 5,
      "totalAmount": 45000000,
      "paidAmount": 30000000,
      "balanceAmount": 15000000,
      "latestDate": "2026-08-15T10:30:00.000Z",
      "oldestDate": "2026-07-05T08:00:00.000Z",
      "maxAgingDays": 46,
      "aging0_30": 5000000,
      "aging31_60": 10000000,
      "aging61_90": 0,
      "agingOver90": 0
    }
  ],
  "total": 128,
  "page": 1,
  "pageSize": 20,
  "totalPages": 7,
  "summary": {
    "totalRevenue": 1520000000,
    "totalPaid": 980000000,
    "totalBalance": 540000000,
    "totalAging0_30": 250000000,
    "totalAging31_60": 180000000,
    "totalAging61_90": 70000000,
    "totalAgingOver90": 40000000
  }
}
```

---

### 4.2. `GET /cases/customers-debt/column-options` (Options Bộ Lọc Popover Cột)

- **Mô tả**: Trả về danh sách options distinct phục vụ popover header của từng cột trên bảng công nợ khách hàng, hỗ trợ phân trang và tìm kiếm.
- **Query Parameters**:
  - `column`: Tên cột cần lấy options (`customerCode`, `customerName`, `branchName`, `paymentProgress`, `maxAgingDays`, `caseCount`, `totalAmount`).
  - `search`: Từ khóa tìm kiếm options.
  - `page`: Trang options (mặc định `1`).
  - `pageSize`: Số options trên một trang (mặc định `20`).
  - `filtersStr`: Bộ lọc cascading từ các cột khác đang áp dụng.

- **Dữ liệu Phản hồi**:
```json
{
  "items": ["KH-00124", "KH-00125", "KH-00128"],
  "total": 35,
  "page": 1,
  "pageSize": 20,
  "totalPages": 2
}
```

---

### 4.3. `GET /cases/by-customer/:customerCode` (Danh Sách Phiếu DV của Khách Hàng)

- **Mô tả**: Lấy toàn bộ danh sách phiếu dịch vụ hoàn tất của một khách hàng cụ thể để hiển thị trong Drawer Hồ sơ công nợ.
- **Path Parameter**: `customerCode` (mã khách hàng, hoặc `'UNKNOWN'` / `'NO_CODE'` nếu không có mã).
- **Header**: `x-kgara-branch-id` (tùy chọn theo chi nhánh).
- **Xử lý Làm giàu Dữ liệu**:
  - Tự động map với bảng `kgara_case_settlements` để tính chính xác số tiền thực thu (`receipts`), thực chi (`payments`), dư nợ còn lại và số ngày tuổi nợ của từng phiếu.

---

## 5. Logic Nghiệp vụ & Thuật toán Trọng tâm

### 5.1. Thuật toán Tổng Hợp & Phân Nhóm Dữ liệu (SQL Aggregation Logic)

1. **Điều kiện Lọc Cố định (Where Clause)**:
   - `kgara_deleted_at IS NULL`: Loại trừ các phiếu bị xóa mềm.
   - `(tinh_trang_dich_vu = 3 OR ten_tinh_trang_dich_vu = 'Kết thúc' OR ten_tinh_trang_dich_vu ILIKE '%kết thúc%' OR ten_tinh_trang_dich_vu ILIKE '%hoàn tất%')`: Chỉ nhận phiếu dịch vụ đã hoàn tất.
   - `ngay_phat_sinh >= '2026-07-01'`: Mốc baseline chặn dưới.
2. **Công thức Nhóm Group By**:
   - `GROUP BY COALESCE("case"."khach_hang_code", 'UNKNOWN')`
3. **Công thức Tính Tuổi Nợ (Aging Expressions)**:
   - Khoảng cách ngày: `CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now()))`
   - Tuổi nợ lớn nhất (`max_aging_days`):
     ```sql
     COALESCE(MAX(CASE WHEN COALESCE("case"."tien_con_phai_thanh_toan", 0) > 0 
       THEN CURRENT_DATE - DATE(COALESCE("case"."ngay_phat_sinh", now())) 
       ELSE 0 END), 0)::int
     ```
   - Phân rã 4 khoảng nợ:
     - `aging_0_30`: Điều kiện `tien_con_phai_thanh_toan > 0 AND aging_days <= 30`.
     - `aging_31_60`: Điều kiện `tien_con_phai_thanh_toan > 0 AND aging_days BETWEEN 31 AND 60`.
     - `aging_61_90`: Điều kiện `tien_con_phai_thanh_toan > 0 AND aging_days BETWEEN 61 AND 90`.
     - `aging_over_90`: Điều kiện `tien_con_phai_thanh_toan > 0 AND aging_days > 90`.

### 5.2. Xử lý Bộ Lọc HAVING trên Dữ liệu Tổng Hợp

- Khi người dùng lọc theo `paymentProgress`, `maxAgingDays`, `caseCount`, hoặc `totalAmount`, backend sẽ tự động áp dụng các điều kiện `HAVING` tương ứng:
  - **`paymentProgress`**:
    - `PAID`: `HAVING (SUM(tien_con_phai_thanh_toan) <= 0 AND SUM(tien_da_thanh_toan) > 0)`
    - `PARTIAL`: `HAVING (SUM(tien_da_thanh_toan) > 0 AND SUM(tien_con_phai_thanh_toan) > 0)`
    - `UNPAID`: `HAVING (SUM(tien_da_thanh_toan) <= 0 AND SUM(tien_con_phai_thanh_toan) > 0)`
  - **`maxAgingDays`**: Áp dụng điều kiện `HAVING (maxAgingExpr <= 30 | BETWEEN 31 AND 60 | ...)`
  - **`totalAmount`**: Áp dụng `HAVING (SUM(tien_co_thue) < 10m | BETWEEN 10m AND 20m | ...)`

### 5.3. Xử lý An Toàn ID Tạm Thời (Temporary ID Guard)

- Khi người dùng tạo hoặc xóa liên kết giao dịch cấn trừ trên Drawer (`settlements`), các ID chưa lưu trên server có tiền tố `tmp-...` hoặc `manual-tmp-...`.
- Controller kiểm tra định dạng UUID regex (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`). Nếu không phải UUID hợp lệ, backend trả về thành công an toàn, không thực hiện truy vấn DB để tránh lỗi Postgres 500.

---

## 6. Tích hợp Liên Module

- **`bank-transactions-core`**:
  - Kết nối với các giao dịch sao kê ngân hàng thật để cấn trừ trực tiếp vào công nợ khách hàng của từng phiếu dịch vụ.
- **`erp-invoices-core`**:
  - Hỗ trợ liên kết hóa đơn VAT đầu ra (`OUT`) với từng phiếu dịch vụ trong hồ sơ khách hàng.
- **`garage-cases`**:
  - Tương tác hai chiều: Nhấp vào số chứng từ trên Drawer hồ sơ khách hàng sẽ mở trực tiếp Drawer chi tiết vụ việc (`GarageCaseStandaloneDrawer`) ở chế độ View hoặc Edit.

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

Khi chỉnh sửa phân hệ `garage-customers`:
1. **Kiểm tra Type-check Backend**:
   ```bash
   cd /home/dev/repos/erp/erp-api && bun run check:ci
   ```
2. **Chạy Unit Test Backend**:
   ```bash
   cd /home/dev/repos/erp/erp-api && bunx jest src/kgara-api-core/ --forceExit
   ```
3. **Kiểm tra Type-check Frontend**:
   ```bash
   cd /home/dev/repos/erp/erp-web && bun run build
   ```
