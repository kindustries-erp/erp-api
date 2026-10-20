---
name: garage-customers
description: Module tri thức Quản lý Hồ sơ & Sổ Công nợ Khách Hàng Garage (Garage Customers Debt, Aging Buckets, Pure Cashflow Settlements & Detail Drawer) trong erp-api (kgara-api-core) và erp-web. Chứa toàn bộ database schema, API endpoints, logic nhóm dữ liệu, phân tầng tuổi nợ, bộ lọc đa chiều và giao diện bảng/drawer chuẩn hóa.
---

# 📦 Module Tri Thức: Quản Lý Hồ Sơ & Sổ Công Nợ Khách Hàng Garage (Garage Customers & Debt) - Backend & Frontend

## 1. Tổng quan Nghiệp vụ

Phân hệ Quản lý Khách Hàng & Công Nợ Dịch Vụ Garage (`garage-customers` thuộc `kgara-api-core` backend và `modules/garage` frontend) chịu trách nhiệm tổng hợp, theo dõi, phân tích và quản lý toàn bộ công nợ phải thu của khách hàng phát sinh từ các phiếu dịch vụ sửa chữa xe tại xưởng dịch vụ KGara (Greenway).

### Các Nghiệp vụ Trọng tâm:
- **Tổng hợp Công nợ theo Biển Số Xe (`GET /cases/customers-debt` & `GET /payables/suppliers-debt`)**:
  - Nhóm dữ liệu phiếu dịch vụ từ bảng `kgara_cases` theo Biển số xe (`COALESCE(NULLIF(TRIM("case"."bien_so_xe"), ''), 'CHUA_CO_BKS')`).
  - Cột đầu tiên của bảng sau `#` là **Biển số xe** (`licensePlate`), các bản ghi chưa có BKS hiển thị `— (Chưa có BKS)`.
  - Cột **Khách hàng** (`customer`): Hiển thị trên tab **Phải thu** (`GarageDebtsTable`), gom Tên KH (`khach_hang_name`) và Mã KH (`khach_hang_code`) về 1 cột duy nhất hiển thị 2 dòng qua molecule `GarageCaseCustomerCell`, cho phép click tên KH mở Detail Drawer. Đối với tab **Phải trả** (`GaragePayablesTable`), cột Khách hàng được lược bỏ để tránh làm rối người dùng (vì đây là công nợ phải trả theo biển số xe/nhà cung cấp), nhãn `Tổng cộng:` hiển thị ở cột Biển số xe.
  - **Mốc thời gian theo dõi**: Áp dụng mốc lọc theo ngày hoàn thành (`ngay_hoan_thanh_cong_viec >= '2026-07-01'`).
  - **Chỉ tính Phiếu Hoàn tất**: Chỉ tổng hợp các phiếu dịch vụ đã hoàn thành (`ngay_hoan_thanh_cong_viec IS NOT NULL` và `tinh_trang_dich_vu = 3` hoặc `ten_tinh_trang_dich_vu ILIKE '%kết thúc%' / '%hoàn tất%'`), tự động loại trừ các xe chưa hoàn thành.
  - **Xe chưa hoàn thành (In-Progress Pipeline)**: Không tính vào công nợ phải thu và không tính tuổi nợ (aging = 0).
- **Phân Tầng Tuổi Nợ (Aging Buckets Matrix)**:
  - Tự động tính toán số ngày tuổi nợ dựa trên khoảng cách giữa **ngày hoàn thành công việc** và ngày hiện tại: $\text{agingDays} = \text{CURRENT\_DATE} - \text{DATE(ngay\_hoan\_thanh\_cong\_viec)}$.
  - Phân loại 4 nhóm tuổi nợ chuẩn tài chính:
    1. `0-30` ngày: Trong hạn.
    2. `31-60` ngày: Cần theo dõi.
    3. `61-90` ngày: Quá hạn.
    4. `>90` ngày: Quá hạn sâu.
  - Phản ánh chi tiết số tiền nợ còn lại trong từng bracket và xác định `maxAgingDays` cho từng phương tiện/khách hàng dựa trên ngày hoàn thành.
- **Phân Loại Tiến Độ Thanh Toán (Payment Progress)**:
  - `PAID` (Đã thu đủ): `con_phai_thu <= 0 AND da_thanh_toan > 0`.
  - `PARTIAL` (Thu một phần): `da_thanh_toan > 0 AND con_phai_thu > 0`.
  - `UNPAID` (Chưa thu): `da_thanh_toan <= 0 AND con_phai_thu > 0`.
- **Chuẩn Quản Lý Dòng Tiền Thuần ERP (Pure Cashflow Standard)**:
  - Công nợ và số tiền thực thu **chỉ được ghi nhận và đối soát từ các giao dịch dòng tiền thực tế** trong bảng `kgara_case_settlements` (`ON_SYSTEM`: Sao kê ngân hàng, `OFF_SYSTEM_MANUAL`: Tiền mặt sổ quỹ).
  - Không cộng dồn số tiền trên hóa đơn VAT (`erp_invoices`) vào dòng tiền thực thu nếu không có giao dịch sao kê/tiền mặt đối soát kèm theo.
- **Bộ Lọc Đa Chiều Nâng Cao & Chuẩn Hóa Bảng (`/standardize-table`)**:
  - Hỗ trợ đầy đủ bộ lọc cột qua `TableColumnHeaderFilter`: tìm kiếm từ khóa con (`ILIKE`), tìm kiếm chính xác, tìm kiếm nhiều từ khóa cách nhau bởi khoảng trắng hoặc dấu chấm phẩy (`;`).
  - Hỗ trợ `__ALL_MATCHING__` (chọn tất cả kết quả tìm kiếm khớp từ khóa không sót trang) và `__BLANK__` (lọc các xe chưa có BKS hoặc chưa có mã khách hàng).
  - Tích hợp endpoint column-options (`GET /cases/customers-debt/column-options` & `GET /payables/suppliers-debt/column-options`):
    - Cột `maxAgingDays` (Tuổi nợ & Rủi ro): Trả về 5 options chuẩn `['0 ngày', '1-30 ngày', '31-60 ngày', '61-90 ngày', '>90 ngày']`, tách riêng `0 ngày` (`maxAgingExpr = 0`) cho các xe đã tất toán/hoàn thành trong ngày, hỗ trợ tìm kiếm trong popover filter.
    - Cột `balanceAmount` (Còn phải thu / Còn phải chi) & `paidAmount` (Đã chi): Trả về các khoảng tiền tệ chuẩn `['0 đ', '< 10.000.000 đ', '10.000.000 - 20.000.000 đ', '20.000.000 - 50.000.000 đ', '> 50.000.000 đ']` và hỗ trợ tìm kiếm số tiền tối thiểu qua `HAVING` clause thay vì query tên mã KH.
    - Cột `licensePlate` (Biển số xe): Chuẩn hóa độ rộng `size: 130px` đồng bộ trên toàn bộ các bảng (`garage-debts` Phải thu, Phải trả và `garage-cashflow` Thu chi garage).
    - Cột `latestDate` (Ngày hoàn thành gần nhất) & `branchName` (Chi nhánh): Lược bỏ khỏi bảng chính `GarageDebtsTable` để tối ưu không gian hiển thị, bộ lọc chi nhánh quản lý tập trung qua thanh công cụ / store.
    - Dropdown `GarageCaseCombobox`: Đưa Biển số xe lên đầu và bỏ ngày (`${plate} - ${ref}`), tích hợp Rich Tooltip khi hover hiển thị đầy đủ Ngày phát sinh, Tiền thu BH (`phaiThuBaoHiem`), Tiền thu KH (`phaiThuKhachHang`), Phải chi (`chiPhi`).
    - Cột `caseCount` (SL Phiếu DV): Trả về mảng distinct số lượng phiếu dịch vụ.
    - Cột `customer` (Khách hàng): Trả về danh sách distinct tên khách hàng, hỗ trợ lọc và tìm kiếm đồng thời cả tên và mã KH.
  - Bảng dạng `SpreadsheetPageTemplate` với variant spreadsheet không lồng viền, STT `{idx}` (không `{idx + 1}`), No Blue Mandate, SubtotalSummaryCell truyền đủ `cumulativeCount` và `cumulativeAmount` cho đa trang.
  - Phân rã kiến trúc Atomic Design 5 tầng, toàn bộ file component/organism khống chế nghiêm ngặt < 180 LoC.
  - **Tab Tổng quan (`garage-debts?tab=overview`)**: Tái cấu trúc thành Organism chuẩn `garage-debts-dashboard-tab/` (< 150 LoC/file), gỡ bỏ hoàn toàn Filter Panel (phễu lọc & trượt phải) để tối ưu không gian hiển thị và tránh rối người dùng, dữ liệu phân tích tự động lấy theo chi nhánh kích hoạt. Trang bị cụm nút thao tác chuẩn gồm nút chính dạng Split Button **Xuất Excel** (kèm dropdown Xuất nâng cao / Đồng bộ) và nút **Tải lại (Reload)** đồng bộ 100% với các tab danh sách `SpreadsheetPageTemplate`.
- **Hồ Sơ Chi Tiết & Drawer Bán Hàng 2 Cột (`GarageCustomerDetailDrawer`)**:
  - Chuẩn `StandardFormDrawer` layout `2-columns` (`size="full"`, tuân thủ `/ui-atomic-refactor` < 200 LoC/file, 100% i18n VI/EN).
  - **Cột phải (Right Panel)**: `CustomerSidebarSummary` (Tên, Mã KH, SL xe, SL phiếu DV hoàn thành, Phân bổ 4 tầng tuổi nợ theo ngày HT, Thông tin xe đang làm dự thu).
  - **Cột trái (Left Panel / Main Content)**: `CustomerKpiSummaryCards` + Thanh điều hướng `PillTabs` 4 sub-tabs:
    - **Tab 1. Phiếu DV hoàn thành (`CustomerCasesTableTab`)**: `<DataTable>` hiển thị các phiếu hoàn thành có công nợ, tính tuổi nợ theo ngày hoàn tất, tích hợp Quick Actions (Xem chi tiết, Cấn trừ sao kê, Liên kết HĐ VAT).
    - **Tab 2. Xe đang làm (Dự thu - `CustomerPipelineTab`)**: Danh sách các xe đang thực hiện tại xưởng chưa nghiệm thu, không tính nợ/tuổi nợ, hiển thị số tiền dự thu tạm tính.
    - **Tab 3. Phân bổ theo xe (`CustomerVehicleDebtTab`)**: Bảng thống kê công nợ & tuổi nợ max theo từng biển số xe.
    - **Tab 4. Phân tích tuổi nợ (`CustomerDebtAgingChartTab`)**: Biểu đồ phân bổ tuổi nợ (`DonutChart`) và biến động doanh thu/thanh toán theo tháng (`BarChart`).
  - Tự động làm mới cache query (`garage-cases-by-customer`, `garage-customers-debt`) ngay sau khi hoàn tất cấn trừ hoặc liên kết hóa đơn.

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
├── controllers/
│   ├── kgara-customers.controller.ts      # Controller chứa endpoints /cases/customers-debt, column-options, by-customer
│   └── kgara-suppliers.controller.ts      # Controller chứa endpoints /payables/suppliers-debt, column-options, by-supplier
└── kgara-api-core.module.ts               # Module NestJS đăng ký Sub-Controllers, Providers và Repositories

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
  - `sorts`: Danh sách sắp xếp đa cột (vd: `["-balanceAmount", "customerName"]`). Các key aging `aging0_30`, `aging31_60`, `aging61_90`, `agingOver90` được map lần lượt sang các alias SQL `aging_0_30`, `aging_31_60`, `aging_61_90`, `aging_over_90`, hỗ trợ cả ASC và DESC.
  - `filtersStr` / `column_filters`: JSON string chứa bộ lọc các cột (`customerCode`, `customerName`, `branchName`, `paymentProgress`, `maxAgingDays`, `caseCount`, `totalAmount`).
  - `agingBucket` (dropdown "Trạng thái nợ" của tab Phải thu): giá trị `0-30` | `31-60` | `61-90` | `>90`. Lọc theo **xe có số dư trong mốc** (`HAVING SUM(số dư phiếu trong mốc) > 0`), nên tổng cột mốc đó khớp với dữ liệu lọc. Khác với `maxAgingDays`, vốn lọc theo tuổi nợ **cũ nhất** của xe.
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

- **Mô tả**: Lấy danh sách phiếu dịch vụ hoàn tất của một khách hàng cụ thể để hiển thị trong Drawer Hồ sơ công nợ.
- **Path Parameter**: `customerCode` (mã khách hàng, hoặc `'UNKNOWN'` / `'NO_CODE'` nếu không có mã).
- **Query Parameter (Mới)**: `licensePlate?: string` (tùy chọn: lọc các phiếu gắn với đúng biển số xe, bỏ qua hoặc truyền `'ALL'` để lấy toàn bộ).
- **Header**: `x-kgara-branch-id` (tùy chọn theo chi nhánh).
- **Xử lý Làm giàu Dữ liệu**:
  - Tự động map với bảng `kgara_case_settlements` để tính chính xác số tiền thực thu (`receipts`), thực chi (`payments`), dư nợ còn lại và số ngày tuổi nợ của từng phiếu.
  - Lọc theo `case.bienSoXe = :licensePlate` nếu có truyền tham số biển số xe.

### 4.4. Cơ Chế Lọc Theo Biển Số Xe Trên Drawer (`GarageCustomerDetailDrawer`)

- **Truyền ngữ cảnh Biển số xe từ Bảng Chính**: Khi người dùng click vào dòng dữ liệu (biển số xe, tên khách hàng, số lượng phiếu hoặc action "Xem chi tiết công nợ") tại `GarageDebtsTable` hoặc `GaragePayablesTable`, BKS (`licensePlate`) được truyền nguyên vẹn vào Drawer qua `props.licensePlate`.
- **Bộ Lọc Xe Nhanh (`CustomerVehicleSelector`)**:
  - Tích hợp trực tiếp tại thanh công cụ phía trên Drawer (cạnh switch Công nợ).
  - Hiển thị chip trạng thái `Lọc theo xe: <BKS> (số phiếu) [✕]` khi đang áp dụng lọc, cho phép 1-click hủy lọc để xem toàn bộ xe.
  - Dropdown cho phép chuyển nhanh giữa các phương tiện của khách hàng (hiển thị kèm số phiếu và dư nợ từng xe).
- **Tab 3 Phân Bổ Theo Xe (`CustomerVehicleDebtTab`)**:
  - Highlight xe đang chọn bằng badge/button active.
  - Click vào bất kỳ dòng xe nào tại Tab 3 sẽ tự động kích hoạt bộ lọc xe đó và chuyển ngay sang Tab 1 để xem các phiếu dịch vụ.
- **Sidebar Tổng Quan (`CustomerSidebarSummary`)**:
  - Khi đang lọc theo xe: Hiển thị dòng BKS xe đang xem, số phiếu của xe này / tổng số phiếu, và khối so sánh riêng giữa Dư nợ của xe này và Tổng dư nợ toàn bộ khách hàng.

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
   cd erp/erp-api && bun run check:ci
   ```
2. **Chạy Unit Test Backend**:
   ```bash
   cd erp/erp-api && bunx jest src/kgara-api-core/ --forceExit
   ```
3. **Kiểm tra Type-check Frontend**:
   ```bash
   cd erp/erp-web && bun run type:check
   ```

---

## 8. Quản Lý Công Nợ Phải Trả Dịch Vụ Garage (Garage Payables & Customer Grouping Standard)

Màn hình `garage-debts` (`src/modules/garage/pages/GarageDebts.tsx`) áp dụng cấu trúc 3 Tabs chuẩn hóa:
1. **Tab 1. Tổng quan (`overview`)**: Dashboard KPIs, Horizon Grid, Aging Matrix và Analytics Charts. Đồng bộ 100% số liệu Phải thu & Phải trả.
2. **Tab 2. Phải thu (`receivables`)**: Quản lý công nợ khách hàng và tuổi nợ thu hồi theo ngày hoàn tất phiếu (`GarageDebtsTable`).
3. **Tab 3. Phải trả (`payables`)**: Quản lý công nợ chi phí được **gom nhóm theo từng Khách Hàng** (`GaragePayablesTable`), tương tự cấu trúc tab Phải thu.

### 8.1. Nguồn Dữ Liệu & Quy Tắc Gom Nhóm Theo Khách Hàng
- **Nguồn Chi Phí**: Truy vấn từ `kgara_cases` kết hợp `kgara_gross_profit` (liên kết qua `c.so_chung_tu = gp.vu_viec_code`), lọc các phiếu có `chi_phi > 0` và hoàn thành (`c.tinh_trang_dich_vu = 3` hoặc `c.ngay_hoan_thanh_cong_viec IS NOT NULL`).
- **Gom Nhóm (Group By)**: Nhóm theo mã khách hàng `COALESCE(c.khach_hang_code, gp.raw_data->>'MaKhachHang', gp.ten_khach_hang, 'UNKNOWN')`.
- **Các Chỉ Số Cốt Lõi**:
  - **Tên khách hàng (`customerName`)**: Tên đầy đủ của khách hàng, nhấp vào để mở ngay `GarageCustomerDetailDrawer`.
  - **Mã KH (`customerCode`)**: Mã khách hàng KGara / ERP (copyable).
### 8.1. Khái Niệm Công Nợ Phải Trả & Trục Gom Nhóm Theo Biển Số Xe
- **Nguồn Dữ Liệu**: `kgara_cases` FULL OUTER JOIN `kgara_gross_profit` trên điều kiện `gp.vu_viec_code = c.so_chung_tu`.
- **Trục Gom Nhóm (GROUP BY Biển số xe)**:
  - Để hỗ trợ theo dõi chi phí chi tiết đến từng phương tiện (tương tự như tab Phải thu), tab Phải trả gom nhóm dữ liệu theo:
    `COALESCE(NULLIF(TRIM(COALESCE("c"."bien_so_xe", substring("gp"."vu_viec_name" from 'Biển số: ([^ ]+)'))), ''), 'CHUA_CO_BKS')`.
  - Cột đầu tiên sau `#` là **Biển số xe** (`licensePlate`), hiển thị qua Atom `LicensePlateCell` có icon `Car`, nút Copy nhanh BKS.
  - Các cột tiếp theo: **Tên khách hàng** (`customerName`), **Mã KH** (`customerCode`), **SL Phiếu DV** (`caseCount`), **Chi phí báo giá** (`costAmount`), **Đã chi** (`paidAmount`), **Còn phải chi** (`balanceAmount`, có thể âm), và 4 phân tầng tuổi nợ.
- **Đã chi / Còn phải chi (cấn trừ PAYMENT)**: Đã chi = tổng `kgara_case_settlements` có `settlement_type = 'PAYMENT'` gộp theo `case_id` (join `LEFT JOIN ... "pay"` qua helper `src/kgara-api-core/helpers/garage-payable-settlement.helper.ts`: `PAYMENT_BY_CASE_JOIN`, `buildPayableExprs`). Còn phải chi = chi phí − đã chi, **không chặn trần** (trả vượt hoặc chi phí = 0 mà đã chi thì ra số âm). Dòng được giữ nếu `chi phí > 0 OR đã chi <> 0`. Aging, Top NCC, `totalBalance` đều tính trên số còn phải chi. Dòng chỉ có `kgara_gross_profit` (không có vụ việc) không có PAYMENT nên còn phải chi = chi phí. Sort `balanceAmount`→`balance_amount`, `paidAmount`→`paid_amount`.
- **Mốc Tính Tuổi Nợ**: Tương tự như tab Phải thu, tuổi nợ phải chi được tính dựa trên khoảng cách giữa **ngày kết thúc/hoàn thành** của các phiếu và ngày hiện tại:
  $$\text{agingDays} = \text{CURRENT\_DATE} - \text{DATE(COALESCE(c.ngay\_hoan\_thanh\_cong\_viec, (gp.raw\_data\text{->>}'NgayKetThuc')::timestamp, c.ngay\_phat\_sinh))}$$
- **Phân Tầng 4 Nhóm Tuổi Nợ Chuẩn**:
  1. `0-30` ngày: Trong hạn.
  2. `31-60` ngày: Cần theo dõi.
  3. `61-90` ngày: Quá hạn.
  4. `>90` ngày: Quá hạn sâu.
  - `maxAgingDays`: Tuổi nợ tối đa tính theo phiếu hoàn tất xa nhất của xe/khách hàng.

### 8.2. Đồng Bộ Số Liệu Garage Debts Dashboard (Tab Tổng Quan)
- `GarageDebtsAnalyticsService` (`src/kgara-api-core/services/garage-debts-analytics.service.ts`):
  - Khối Payables trên Dashboard đồng bộ cùng nguồn dữ liệu `kgara_cases` + `kgara_gross_profit` với Tab Phải trả.
  - **Chỉ tính phiếu Kết thúc (`tinh_trang_dich_vu = 3`)** cho cả Phải thu và Phải trả; dòng lãi gộp không ghép được phiếu ERP bị loại. Chi tiết xem `garage-cases` mục 5.16.
  - **KPI Cards**: `totalPayable` (Tổng chi phí báo giá), `paidPayable` (Đã chi = tổng PAYMENT, hết hard-code 0), `remainingPayable` (Còn phải chi = chi phí − đã chi, có thể âm), `paymentRate`, `netBalance` = Còn phải thu - Còn phải chi.
  - **Top Payables**: Khối `topPayableSuppliers` xếp hạng Top Khách Hàng có chi phí sổ báo giá cao nhất kèm số lượng phiếu.
  - **Aging Comparison & Cash Trend**: Aging payable tính trên số còn phải chi. `cashTrend` theo tháng hoàn tất vụ việc: `cashIn` = Đã thu (`tien_da_thanh_toan`), `cashOut` = Đã chi (tổng PAYMENT), `netCash = cashIn − cashOut`. Doanh thu/chi phí tổng hợp xem ở trang khác (dashboard garage). Biểu đồ web nhãn "Đã thu"/"Đã chi".

### 8.3. Kiến Trúc Backend (`/api-service-refactor`)
- **`KgaraSuppliersDebtQueryEngine`** (`src/kgara-api-core/services/engines/kgara-suppliers-debt-query.engine.ts` - 587 LoC < 800 LoC, Pattern C):
  - Chuyên trách toàn bộ logic xây dựng truy vấn SQL, gom nhóm theo Biển số xe, lọc đa chiều (`exact`, `multi`, `blank`), sắp xếp (`licensePlate`, `costAmount`, ...) và phân trang column options.
  - Co-located unit test `kgara-suppliers-debt-query.engine.spec.ts` pass 100%.
- **`KgaraSuppliersService`** (`src/kgara-api-core/services/kgara-suppliers.service.ts` - 62 LoC < 500 LoC, Pattern B Facade):
  - Facade mỏng với Clean DI Constructor (tiêm `KgaraSuppliersDebtQueryEngine`), delegate trực tiếp các methods `getSuppliersDebt` và `getSuppliersDebtColumnOptions`.
- **`KgaraSuppliersController`** (`src/kgara-api-core/controllers/kgara-suppliers.controller.ts` - 70 LoC < 300 LoC):
  - Clean DI Constructor, endpoints:
    - `GET /greenway/payables/suppliers-debt`
    - `GET /greenway/payables/suppliers-debt/column-options`
    - `GET /greenway/payables/by-supplier/:supplierId/cases`

### 8.4. Kiến Trúc Frontend (`/ui-atomic-refactor` 5 Tầng & `/standardize-table`)
- **Tầng 1 (Atoms)**: `src/modules/garage/components/atoms/license-plate-cell/`:
  - `LicensePlateCell.tsx` (39 LoC < 80 LoC): Component Atom dùng chung cho cả `GarageDebtsTable` và `GaragePayablesTable`, đảm bảo Unidirectional Import Top-Down, triệt tiêu import chéo ngang hàng giữa 2 Organisms.
  - `LicensePlateCell.type.ts` (4 LoC) & `LicensePlateCell.test.tsx` (16 LoC).
- **Tầng 3 (Organisms `garage-payables-table`)**: `src/modules/garage/components/organisms/garage-payables-table/`:
  - Toàn bộ files tuân thủ nghiêm ngặt **< 180 LoC/file**:
    - `GaragePayablesTable.tsx` (92 LoC): View chính với `SpreadsheetPageTemplate`, `getRowKey` duy nhất theo biển số xe (`${row.licensePlate || "no_bks"}_${row.customerCode}_${row.branchExternalId || "all"}`).
    - `GaragePayablesTable.baseColumns.tsx` (147 LoC < 180 LoC): Cột STT (`40px`, center `{idx}`), Biển số xe (`LicensePlateCell`), Khách hàng (gom Tên KH & Mã KH về 1 cột qua `GarageCaseCustomerCell`, `size: 260`), SL Phiếu DV (pill bo tròn `rounded-full` chuẩn hóa `size: 120, minSize: 105`), Chi phí báo giá, Còn phải chi.
    - `GaragePayablesTable.agingColumns.tsx` (151 LoC): 4 cột phân tầng tuổi nợ và Tuổi nợ & Rủi ro (`maxAgingDays`, `size: 210, minSize: 180`).
    - `GaragePayablesTable.cells.tsx` (112 LoC): `SupplierCaseCountCell` (pill rounded-full + FileText icon + nhãn "phiếu" + tooltip + hover scale) và `SupplierAgingDaysCell` (tái sử dụng trực tiếp `AgingDaysCell` từ `GarageDebtsAgingCell` với thanh progress bar 4 màu, badge phân tầng và tooltip `GarageDebtsAgingTooltip`).
    - `GaragePayablesTable.summary.tsx` (157 LoC): Hàng tổng kết `<SubtotalSummaryCell>` truyền đủ `cumulativeCount`, `cumulativeAmount`.
    - `GaragePayablesTable.export.ts` (57 LoC): Quick CSV export xuất kèm cột Biển số xe.
    - `GaragePayablesTable.test.tsx` (82 LoC): Co-located Vitest test suite pass 100%.
- **Tìm kiếm Khách hàng theo cả Mã KH và Tên KH (Cả 2 tab Phải thu & Phải trả)**:
  - Cả 2 endpoints `GET /cases/customers-debt/column-options` và `GET /payables/suppliers-debt/column-options` khi truy vấn cột `customer` đều hỗ trợ tìm kiếm trên cả `khach_hang_name` và `khach_hang_code` (`(name ILIKE :search OR code ILIKE :search)`).
  - Kết quả trả về options dạng `{ label: `${name} (${code})`, value: name }` giúp người dùng vừa thấy mã và tên, vừa lọc chính xác theo tên khách hàng trong query.
- **Tích Hợp Drawer**:
  - Nhấp vào Khách hàng hoặc SL Phiếu DV trên Tab Phải trả mở trực tiếp `GarageCustomerDetailDrawer` để xem toàn bộ danh sách vụ việc của khách hàng.

### 8.5. Tích Hợp Dual-Mode [Phải Thu | Phải Trả] & Chuẩn Hóa Bố Cục Trong GarageCustomerDetailDrawer
- **Nghiệp vụ Dual-Mode & Bộ Chuyển Đổi Button-Group**:
  - Khi mở từ tab **Phải trả** (`GaragePayablesTable`), Drawer tự động nhận `debtType="payables"`.
  - Bộ chuyển chế độ `CustomerDetailDebtSwitch` được bố trí **ngang hàng với thanh Sub-Tabs (PillTabs)** trên đỉnh cột trái (`leftContent`), sử dụng style **button-group** (`<PillTabs size="sm" variant="button-group">`) với icon `ArrowDownLeft` (*Phải thu*) và `ArrowUpRight` (*Phải trả*) — đồng bộ với kiểu dáng button-group trong `erp-invoice` detail drawer.
  - Header Drawer (`CustomerDetailHeader`) được tinh giản tối đa, chỉ giữ lại Title, Badges, Subtitle và nút Làm mới.
  - Phản ánh chính xác các trường dữ liệu theo mode:
    - **Phải thu (`receivables`)**: Doanh thu hoàn thành (`tienCoThue`), Đã thu thực tế (`tienDaThanhToan`), Còn nợ (`tienConPhaiThanhToan`).
    - **Phải trả (`payables`)**: Chi phí báo giá (`chiPhi = COALESCE(gp.chi_phi, c.chi_phi, 0)`), Đã chi thực tế (`tienDaChi` từ `settlementsMap.payments`), Còn phải chi (`tienConPhaiChi = chiPhi - tienDaChi`).
  - Các thẻ chỉ số (`CustomerKpiSummaryCards`), Sidebar (`CustomerSidebarSummary`), Ma trận theo xe (`CustomerVehicleDebtTab`) và Bảng vụ việc (`CustomerCasesTableTab`) đều tự động đảo ngữ nghĩa và nhãn hiển thị tương ứng.
- **Chuẩn Hóa Bảng Phiếu Dịch Vụ (`CustomerCasesTableTab`)**:
  - **STT Chuẩn từ 1**: Cột `#` render bằng `{idx}` (không dùng `idx + 1` vì `DataTable` đã tự tính toán `(page - 1) * pageSize + row.index + 1`). Toàn bộ 3 bảng trong Drawer (`CustomerCasesTableTab`, `CustomerPipelineTab`, `CustomerVehicleDebtTab`) đều bắt đầu chuẩn xác từ 1 trên mọi trang.
  - **Không Cột Action Tĩnh**: Thiết lập `hideLegacyActionColumn={true}`, loại bỏ hoàn toàn nút `...` ở cuối bảng. Thao tác dòng (Xem chi tiết, Sửa, Cấn trừ, Ghép hóa đơn VAT, Đồng bộ) được kích hoạt linh hoạt qua **Thanh Action Nổi (Floated Action Menu)** khi hover và **Menu Ngữ Cảnh (Context Menu)** khi click chuột phải (`enableRowHoverActions={true}`, `enableRowContextMenu={true}`).
  - **Các Cột Theo Tuổi Nợ**: Bổ sung qua `CustomerCasesTable.agingColumns.tsx` gồm 4 cột phân tầng (`0-30 ngày`, `31-60 ngày`, `61-90 ngày`, `>90 ngày`) và cột `Tuổi nợ & Rủi ro` tích hợp `AgingDaysCell` (progress bar 4 màu + badge số ngày) đồng bộ nhận diện với bảng `garage-debts`.
  - **Hàng Tổng Kết (Subtotal Row)**: Hook `useCustomerCasesSummaryRow.tsx` tích hợp `<SubtotalSummaryCell>` tính toán cả Subtotal (trang hiện tại) và Grand Total (toàn bộ phiếu) cho Chi phí/Doanh thu, Đã chi/Đã thu, Còn phải chi/Còn nợ, và 4 khoảng tuổi nợ.
- **Chuẩn Hóa Cột Phải Theo Kiến Trúc 2 Tầng DrawerSection (`/standardize-drawer`)**:
  - **Section 1: THÔNG TIN KHÁCH HÀNG**: Tiêu đề kèm icon `Building2`, `collapsible={true}`, `defaultCollapsed={false}`, hiển thị các hàng `DrawerRow` (Mã KH, Tên KH, SL phiếu hoàn thành, Số lượng xe).
  - **Section 2: CHỈ SỐ CÔNG NỢ & THU HỒI** (`CustomerKpiSummaryCards`): Tiêu đề kèm icon `Scale`, `collapsible={true}`, `defaultCollapsed={false}`, hiển thị 4 mini cards dạng compact grid 2x2 (Tổng DT/Chi phí, Đã thu/Đã chi & Tỷ lệ thu hồi, Còn nợ/Còn phải chi, Tuổi nợ max).
  - Di chuyển khối KPI sang cột phải giúp giải phóng 100% không gian dọc cho bảng dữ liệu chính (`StandardTable`) ở cột trái.
- **Kiến trúc Backend (`/api-service-refactor`)**:
  - **`KgaraCustomerCasesDetailService`** (`src/kgara-api-core/services/kgara-customer-cases-detail.service.ts` < 150 LoC, Pattern B Sub-Service Facade):
    - Clean DI Constructor, query `kgara_cases` kết hợp `kgara_gross_profit` và nhóm `kgara_case_settlements` (`RECEIPT` / `PAYMENT`) qua map in-memory.
    - Đảm bảo Zero-Entity Leaking, trả về DTO đồng nhất cho cả 2 luồng Phải thu và Phải trả.
    - Co-located unit test `kgara-customer-cases-detail.service.spec.ts` pass 100%.
  - **`KgaraCustomersController`** (`src/kgara-api-core/controllers/kgara-customers.controller.ts` < 200 LoC): Delegate method `getCasesByCustomer` qua Sub-Service.
- **Kiến trúc Frontend (`/ui-atomic-refactor` & `/standardize-table`)**:
  - Khống chế cứng toàn bộ các file trong organism `< 180 LoC/file`.
  - Table trong Drawer dùng `<StandardTable variant="spreadsheet" />`.
  - Tuân thủ nghiêm ngặt 100% **No Blue Mandate** và 100% đa ngôn ngữ qua `useTranslation`.

### 8.6. Drawer Chi Tiết Từng Tháng Của Từng Đối Tượng (GaragePartnerMonthDetailDrawer) & Drill-down Đa Chiều
- **Mục Tiêu & Trải Nghiệm Người Dùng (UX Alignment)**:
  - Cho phép người dùng drill-down xem sâu số liệu doanh thu, chi phí, công nợ và danh sách phiếu dịch vụ của **một đối tượng cụ thể trong một tháng xác định**.
  - **Đồng bộ UI với Drawer Tổng Quát (`GarageMonthDetailDrawer`)**: Kế thừa chuẩn bố cục `StandardFormDrawer` layout `2-columns` (`size="full"`):
    - Cột trái: Bộ 4 KPI Cards tương phản theo tiến độ (Phát sinh, Đã thu/chi, Còn lại, VAT cảnh báo), thanh Sub-Tabs chuyển đổi giữa `Bảng phân loại nghiệp vụ` (`PartnerMonthClassificationTable`) và `Danh sách vụ việc trong tháng` (`PartnerMonthCasesTable`).
    - Cột phải: `PartnerMonthSidebarSummary` tổng hợp nhanh tỷ trọng phân loại, tiến độ hoàn tất, cảnh báo hóa đơn VAT chưa xuất và thông tin đối tượng.
  - **Nút Chuyển Đổi [ ↙ Phải Thu | ↗ Phải Trả ] Ngay Trên Header Drawer**:
    - Tái sử dụng molecule `CustomerDetailDebtSwitch` ở dạng button-group nhỏ gọn trên header / thanh điều hướng, cho phép kế toán viên đối chiếu tức thì công nợ phải thu và chi phí phải trả của đối tượng trong tháng mà không cần đóng mở drawer.
- **Điểm Kích Hoạt (Entry Points)**:
  1. **Từ Drawer Tổng Quát (`GarageMonthDetailDrawer`)**: Khi nhấp vào nút Xem chi tiết hoặc tên đối tượng trong bảng `MonthInvoicePartnerTable`.
  2. **Từ Drawer Hồ Sơ Khách Hàng (`GarageCustomerDetailDrawer`)**: Bảng thống kê biến động theo tháng trong tab Phân tích tuổi nợ (`CustomerDebtAgingChartTab`), cho phép click xem chi tiết bất kỳ tháng phát sinh nào.
- **Kiến Trúc Atomic Design (`/ui-atomic-refactor`)**:
  - Toàn bộ component đặt tại `src/modules/garage/components/organisms/garage-partner-month-detail-drawer/`.
  - Mọi file đều khống chế nghiêm ngặt **< 180 LoC/file** (tách riêng helper phân loại `PartnerMonthClassification.helper.ts` và columns `PartnerMonthCasesTable.columns.tsx`).
  - 100% **No Blue Mandate** (sử dụng token Tailwind emerald, amber, rose, slate/neutral/muted).
  - Co-located unit test `GaragePartnerMonthDetailDrawer.test.tsx` pass 100%.

### 8.7. Chuẩn Hóa Xuất Excel Công Nợ Garage (GarageDebtsExportDrawer) & Runner Xuất Multi-Sheet (Group Sheets & Dashboard Charts)
- **Nghiệp Vụ & Động Cơ Xuất Nền (Background Export Engine)**:
  - Hỗ trợ 3 đối tượng xuất:
    1. `all`: **Tất cả (Phải thu & Phải trả)** — Khởi chạy runner `garage-all-debts-xlsx-export`, sinh **file Excel đa sheet độc lập**:
       - Sheet 1: `Dashboard` (Trung tâm điều hành: 8 thẻ KPI, 4 biểu đồ chuyên biệt cho từng group, và 2 bảng tổng hợp chỉ số).
       - Sheet 2: `Thu Khách hàng Doanh nghiệp` (Tách riêng thành 1 sheet độc lập cho nhóm KH Doanh nghiệp).
       - Sheet 3: `Thu Khách hàng Cá nhân` (Tách riêng thành 1 sheet độc lập cho nhóm KH Cá nhân).
       - Sheet 4: `Thu Bảo hiểm` (Tách riêng thành 1 sheet độc lập cho nhóm Bảo hiểm nếu có phát sinh).
       - Sheet cuối: `Công nợ phải trả` (Chi tiết công nợ nhà cung cấp, phân nhóm chi phí, 4 tầng tuổi nợ).
    2. `customers`: **Phải thu (Khách hàng)** — Runner `garage-customers-debt-xlsx-export` (gồm `Dashboard` và các sheet tách riêng theo từng nhóm).
    3. `suppliers`: **Phải trả (Nhà cung cấp)** — Runner `garage-suppliers-debt-xlsx-export`.
  - **Endpoints API**:
    - `POST /api/v1/greenway/debts/all/export/background`
    - `GET /api/v1/greenway/debts/all/export/background/history`
    - `GET /api/v1/greenway/debts/all/export/background/:jobId/download`
    - `GET /api/v1/greenway/debts/all/export/progress/stream` (SSE)
  - **Mốc kỳ & phân nhóm (cập nhật 2026-10-16)**:
    - `from` luôn được kẹp tối thiểu bằng `GARAGE_DEBT_BASELINE_DATE` (`2026-07-01`), áp dụng đồng thời cho bảng chi tiết và phần phân nhóm (breakdown). Không còn rơi về tháng hiện tại khi thiếu `from`.
    - `to` thiếu thì lấy ngày hôm nay (máy chủ) cho phần phân nhóm.
    - Lỗi phân nhóm không làm hỏng file: service ghi `Logger.warn` (`garage-debts-export.service.ts`) và vẫn xuất các sheet chi tiết.
    - Dòng `Kỳ:` trên Dashboard có thêm "Số dư, tuổi nợ tính đến dd/MM/yyyy" (`formatPeriod` trong `garage-debts-export.helper.ts`, nhận `meta.asOfDate`). Số dư và tuổi nợ luôn tính đến ngày xuất, không tính đến cuối kỳ.
- **Triệt Tiêu Double Sum & Cấu Trúc Sheet Con Độc Lập**:
  - Tách mỗi group thành một sheet riêng thông qua hàm `buildSingleGroupDebtSheet(workbook, sec.title, sec)`.
  - **Tuyệt đối không chèn hàng tổng phụ xen kẽ (subtotal row)** giữa các case trong danh sách.
  - Toàn bộ danh sách case được liệt kê tuần tự từ Row 5 đến Row n.
  - Áp dụng `applyStandardExcelReportLayout`: Row 1 đặt công thức `=SUM(F5:Fn)`, Row 2 đặt công thức `=SUBTOTAL(9, F5:Fn)`. Vì không có dòng tổng phụ chen ngang, công thức chỉ quét qua dữ liệu gốc thuần túy ➔ **Triệt tiêu 100% lỗi double sum**.
- **Đồng Bộ Màu Sắc 4 Khoảng Tuổi Nợ (Web ➔ Excel)**:
  - Bản đồ màu `AGING_EXCEL_COLOR_MAP` áp dụng cho Header (Row 4), Data cells (Row 5+) và Summary rows (Row 1-2):
    - `0-30 ngày`: Emerald (Header nền `#D1FAE5` chữ `#065F46`, Data cell nền `#F0FDF4` chữ `#047857`).
    - `31-60 ngày`: Amber (Header nền `#FEF3C7` chữ `#92400E`, Data cell nền `#FFFBEB` chữ `#92400E`).
    - `61-90 ngày`: Orange (Header nền `#FFEDD5` chữ `#9A3412`, Data cell nền `#FFF7ED` chữ `#C2410C`).
    - `>90 ngày`: Rose (Header nền `#FFE4E6` chữ `#9F1239`, Data cell nền `#FFF1F2` chữ `#BE123C` bold).
- **Sheet Dashboard Đa Biểu Đồ & 8 KPI Cards Từng Group**:
  - **8 Thẻ KPI (2 hàng x 4 thẻ)**:
    - Hàng 1 (Toàn hệ thống): Tổng phát sinh KH, Đã thu KH, Còn phải thu KH, Tỷ lệ thu hồi KH.
    - Hàng 2 (Theo từng nhóm & Phải trả): Thu KH Doanh nghiệp, Thu KH Cá nhân, Thu Bảo hiểm, Còn phải trả NCC (hoặc Tổng số phiếu).
  - **4 Biểu Đồ (Grid 2x2 trong vùng in A–P)**:
    1. `Chart 1 (Doughnut)`: Cơ cấu doanh thu theo Nhóm đối tượng (Doanh nghiệp, Cá nhân, Bảo hiểm).
    2. `Chart 2 (Clustered Column)`: So sánh Thu hồi nợ từng nhóm (Phát sinh, Đã thu, Còn nợ).
    3. `Chart 3 (Doughnut)`: Cơ cấu tuổi nợ toàn hệ thống (0-30, 31-60, 61-90, >90 ngày theo 4 màu nhận diện).
    4. `Chart 4 (Bar)`: Top 10 khách hàng còn nợ lớn nhất.
  - **Bảng Tóm Tắt Chỉ Số Dưới Biểu Đồ**:
    - Bảng `CƠ CẤU THU THEO ĐỐI TƯỢNG (PHẢI THU)`: Số đối tượng, số vụ việc, phát sinh, đã thu, còn nợ, % thu hồi, có HĐ, chưa HĐ cho 3 nhóm.
    - Bảng `CHI PHÍ PHÁT SINH & CÒN NỢ (PHẢI TRẢ)`: Chi phí dịch vụ & phụ tùng NCC.
- **Chuẩn Hóa UI Gộp Chung 1 DrawerSection (`/standardize-drawer`)**:
  - Cột phải chỉ có duy nhất **1 `DrawerSection` mang tên "ĐIỀU KIỆN XUẤT DỮ LIỆU"** (`GarageDebtsExportConditionSection`).
  - Trường **Đối tượng báo cáo** (`Combobox`) nằm ở vị trí đầu tiên bên trong section, ngay trước bộ chọn chế độ xuất (`ExportModeSelector`), loại bỏ hoàn toàn section thừa bên ngoài.
  - Bảo toàn 100% test suite trong `GarageDebtsExportDrawer.test.tsx` (8/8 tests pass) và `garage-debts-export.service.spec.ts` (9/9 tests pass).

### 8.8. Chuẩn Hóa Thanh Công Cụ Combobox Dropdown 2 Tầng (`GarageViewModeCombobox`) & Lọc Tuổi Nợ Chi Tiết
- **Mục tiêu**: Chuẩn hoá thanh công cụ trên `GarageDebtsTable` (Tab Phải thu) và `GaragePayablesTable` (Tab Phải trả) theo kiến trúc Dropdown 2 tầng tương tự như `garage-cases?tab=cases`:
  - **Tầng 1 (Filter Group - Trạng thái & Tuổi nợ)**:
    - `Tất cả`: Xóa bộ lọc trạng thái và tuổi nợ.
    - `Còn nợ`: Lọc theo `paymentProgress: 'UNPAID,PARTIAL'`.
    - `0-30 ngày`: Lọc `maxAgingDays: '0-30'`.
    - `31-60 ngày`: Lọc `maxAgingDays: '31-60'`.
    - `61-90 ngày`: Lọc `maxAgingDays: '61-90'`.
    - `> 90 ngày`: Lọc `maxAgingDays: '>90'`.
  - **Tầng 2 (View Presets - Chế độ xem cột)**:
    - `Tổng quan` (`overview`): Chỉ hiển thị các cột cốt lõi (`licensePlate`, `customer`, `receivableAmount`, `paidAmount`, `balanceAmount`).
    - `Chi tiết tuổi nợ` (`aging`): Bật thêm 4 cột tuổi nợ chi tiết `aging_0_30`, `aging_31_60`, `aging_61_90`, `aging_over_90`.
    - `Đầy đủ` (`all_columns`): Bật toàn bộ tất cả các cột của bảng.
- **Tương thích & Lưu trữ**:
  - Preset visibility được lưu trữ và đồng bộ tự động với `useUserPreferencesStore` thông qua table ID `garage-debts-table-column-views` / `garage-payables-table-column-views`.
  - Giữ vững 100% khả năng tương thích ngược với API query params hiện tại (`column_filters['paymentProgress']`, `column_filters['maxAgingDays']`).

### 8.9. Chuẩn Hóa Main Action Button "Xuất Excel" & Dropdown Action Menu Đồng Bộ Phiếu Dịch Vụ (Cập nhật 2026-10-17)
- **Mục tiêu**: Đồng bộ chuẩn Action Button trên `GarageDebtsTable` (Phải thu) và `GaragePayablesTable` (Phải trả) theo kiến trúc của `garage-cases?tab=cases`:
  - Khắc phục tình trạng thiếu `onCreate` và `createLabel` khiến `SpreadsheetPageTemplate` bị fallback thành nhãn "Tạo mới".
- **Cấu hình Nút Chính (Main Action Button)**:
  - `createLabel`: `t("debts.exportExcel", "Xuất Excel")`
  - `createIcon`: `<FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" />`
  - `onCreate`: Gọi mở `GarageDebtsExportDrawer` với ngữ cảnh bảng hiện tại (`customers` cho Phải thu, `suppliers` cho Phải trả).
- **Cấu hình Menu Thả Xuống (`createActions`)**:
  - **Nhóm 1 (`Báo cáo & Xuất file`)**: Mục "Xuất Excel theo kỳ / Nâng cao" mở `GarageDebtsExportDrawer`.
  - **Nhóm 2 (`Tùy chọn đồng bộ`)**: Hiển thị khi người dùng có quyền `GARAGE CREATE/UPDATE` (`canSyncGarage`) và có callback `onSyncCases`. Khi bấm kích hoạt drawer đồng bộ `GarageCaseSyncDrawer` (chế độ `"cases"`), cho phép quét lại các phiếu dịch vụ mới từ hệ thống và tự động làm mới danh sách công nợ sau khi đồng bộ thành công.

