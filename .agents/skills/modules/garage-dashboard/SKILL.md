---
name: garage-dashboard
description: Module tri thức Dashboard, Báo cáo Hiệu quả Garage, Quản lý Chi phí vận hành (OPEX) & Báo cáo Lợi nhuận (P&L) trong erp-api (kgara-api-core). Chứa toàn bộ database schema, entities, DTOs, API endpoints, logic tính toán P&L theo ngày hoàn thành và xuất báo cáo Excel chuyên nghiệp.
---

# 📦 Module Tri Thức: Dashboard, Chi Phí Vận Hành & Báo Cáo P&L Garage (`garage-dashboard`) - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Module `garage-dashboard` (được hiện thực tại `src/kgara-api-core/`) là trung tâm tình báo điều hành, phân tích tài chính xưởng dịch vụ và quản lý chi phí vận hành (OPEX) trong hệ thống Liouni ERP.

### 1.1. Các tính năng cốt lõi:
- **Quy tắc Tính toán Doanh thu & Chi phí theo Ngày hoàn thành (Strict Completion Date Rule)**:
  - **CHỈ tính** doanh thu, chi phí, lãi gộp và số vụ việc cho các phiếu dịch vụ **ĐÃ CÓ ngày hoàn thành công việc** (`c.ngay_hoan_thanh_cong_viec IS NOT NULL`).
  - Bỏ qua các phiếu bị xóa trên KGara (`c.kgara_deleted_at IS NULL`) hoặc phiếu hủy (`c.tinh_trang_dich_vu != 9`).
- **Quản lý Chi phí vận hành (OPEX) & Hoa hồng**:
  - Nhập tay chi phí vận hành hàng tháng (nhân sự, thuê mặt bằng, điện nước, vật tư tiêu hao, bảo trì, khấu hao, khác) và hoa hồng (sale, dịch vụ).
  - Phân loại qua `category_key`, lưu trữ theo `(period_year, period_month)` và áp dụng toàn hệ thống Garage.
  - Hỗ trợ xem danh sách bảng chuẩn với bộ lọc/sắp xếp server-side (`/greenway/dashboard/opex`), lọc theo cột (`column-options`), thêm/sửa/xóa qua 1-column Drawer.
- **Báo cáo Lợi nhuận P&L theo Tháng Đơn Lẻ (`getPnlReport`)**:
  - Tổng hợp tự động 7 chỉ mục tài chính phân cấp:
    1. `I. Doanh Thu` (Doanh thu dịch vụ đã hoàn thành)
    2. `II. Chi phí (Giá vốn)` (Phụ tùng & gia công ngoài)
    3. `III. Lợi nhuận gộp` (`Gross Profit = Revenue - COGS`, kèm % Biên LN gộp)
    4. `IV. Chi phí vận hành` (Tổng hợp các khoản OPEX trong tháng)
    5. `V. Lợi nhuận ròng (trước hoa hồng)` (`Net Profit Before Commission = Gross Profit - OPEX`)
    6. `VI. Hoa hồng` (Tổng hợp các khoản hoa hồng `HOA_HONG_*` trong tháng)
    7. `VII. Lợi nhuận ròng (sau hoa hồng)` (`Net Profit After Commission = Net Profit Before Commission - Commission`, kèm % Biên LN ròng)
- **Biểu đồ Xu hướng Tháng Đa Chiều (Doanh thu, Chi phí, Thu tiền & Trả tiền NCC)**:
  - `revenue`, `cost`, `profit`, `margin`: Chỉ số tài chính lãi gộp.
  - `paid`, `receivable`, `collectionRate`: Tiền khách đã thanh toán, công nợ phải thu và tỷ lệ hoàn tất thu tiền (%).
  - `paidCost`, `payableCost`, `costPaymentRate`: Tiền đã chi trả chi phí/NCC, công nợ phải trả NCC và tỷ lệ chi trả (%).
- **Chỉ số KPI Sparklines theo Chu kỳ (`getCheckpointKpis`)**:
  - Phân tích 3 chu kỳ: **Tháng này** (Sparkline 6 tháng), **Tuần này** (Sparkline 4 tuần), **Hôm nay** (Sparkline 7 ngày) theo Ngày hoàn thành.
  - Hỗ trợ click-to-drilldown xem danh sách phiếu dịch vụ chi tiết hoàn thành trong kỳ (`getCheckpointCases`).
- **Xuất Báo Cáo Excel Chuyên Nghiệp**:
  - `exportExcel`: Báo cáo Tổng quan Garage 2 sheets (Tổng quan tháng & Chi tiết phiếu dịch vụ).
  - `exportPnlExcel`: Báo cáo P&L theo tháng chi tiết từng dòng doanh thu, chi phí, OPEX, hoa hồng và lợi nhuận ròng.

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Sơ đồ Quan hệ Bảng:

```text
kgara_cases (Hồ sơ Phiếu dịch vụ)
  ├── 1:1 ── kgara_gross_profit (Sổ Lợi nhuận gộp & Chi phí vốn)
  └── 1:N ── kgara_case_services (Chi tiết phụ tùng & công thợ)

kgara_operating_expenses (Chi phí vận hành & Hoa hồng theo kỳ tháng)
```

### 2.2. Chi tiết các Bảng tham gia:

#### Bảng `kgara_operating_expenses` (Bảng mới tạo)
| Tên Cột | Kiểu Dữ Liệu | Nullable | Mặc Định | Ràng Buộc / Index | Mô Tả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `uuid_generate_v4()` | PK | Định danh bản ghi chi phí |
| `period_year` | `smallint` | NO | — | Index `idx_kgara_opex_period` | Năm chi phí (vd: 2026) |
| `period_month` | `smallint` | NO | — | Index `idx_kgara_opex_period` | Tháng chi phí (1 - 12) |
| `category_key` | `varchar(100)` | NO | — | Index `idx_kgara_opex_category` | Mã loại CP (NHAN_SU, THUE_MAT_BANG, HOA_HONG_SALE,...) |
| `category_name` | `varchar(255)` | NO | — | — | Tên/Diễn giải chi tiết khoản chi |
| `amount` | `numeric(18,2)` | NO | `0` | — | Số tiền chi phí (VND) |
| `note` | `text` | YES | `null` | — | Ghi chú bổ sung |
| `created_by` | `uuid` | YES | `null` | — | ID người tạo |
| `created_at` | `timestamptz` | NO | `now()` | — | Thời gian tạo |
| `updated_at` | `timestamptz` | NO | `now()` | — | Thời gian cập nhật |

#### Bảng `kgara_cases` & `kgara_gross_profit`
| Tên Bảng | Vai trò trong Dashboard | Các cột truy vấn trọng tâm |
| :--- | :--- | :--- |
| `kgara_cases` | Phiếu dịch vụ gốc | `id`, `hd_phieu_dich_vu_id`, `so_chung_tu`, `bien_so_xe`, `khach_hang_code`, `khach_hang_name`, `tinh_trang_dich_vu`, `tien_co_thue`, `tien_da_thanh_toan`, `tien_con_phai_thanh_toan`, `ngay_hoan_thanh_cong_viec`, `kgara_deleted_at` |
| `kgara_gross_profit` | Dữ liệu tài chính lãi gộp & giá vốn | `hd_phieu_dich_vu_id`, `vu_viec_code`, `doanh_thu`, `chi_phi`, `loi_nhuan` |

---

## 3. Cấu trúc Source Code Backend (`erp-api`)

```text
src/kgara-api-core/
├── dto/
│   └── garage-opex.dto.ts              # Create, Update, List Query DTOs cho OPEX
├── entities/
│   └── kgara_operating_expense.entity.ts # TypeORM Entity cho kgara_operating_expenses
├── services/
│   ├── garage-opex.service.ts          # CRUD OPEX, server-side filtering & period summary
│   └── garage-opex.service.spec.ts     # Unit tests cho GarageOpexService (Pass 100%)
├── garage-dashboard.controller.ts      # REST Controller (Dashboard, Checkpoint, OPEX, P&L)
├── garage-dashboard.service.ts         # Aggregation Doanh thu/COGS, P&L Report, ExcelJS
└── kgara-api-core.module.ts            # NestJS Module đăng ký Entity, Controllers & Services
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Base Path: `/api/v1/greenway/dashboard`  
Guards: `JwtAuthGuard`, `CoreRbacGuard`  
Resource RBAC: `garage`

| Method | Endpoint | Quyền yêu cầu | Query / Body | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/stats` | `{ resource: 'garage', action: 'read' }` | `date_from`, `date_to` | Xu hướng tháng, tiến độ thu/chi & phân bổ trạng thái |
| `GET` | `/checkpoint-kpis` | `{ resource: 'garage', action: 'read' }` | — | KPIs Sparkline Tháng/Tuần/Hôm nay |
| `GET` | `/checkpoint-cases` | `{ resource: 'garage', action: 'read' }` | `date_from`, `date_to`, `page`, `pageSize` | Danh sách vụ việc chi tiết theo checkpoint |
| `GET` | `/customers` | `{ resource: 'garage', action: 'read' }` | Query pagination, filters, sort | Danh sách khách hàng kèm doanh thu, lãi gộp & nợ |
| `GET` | `/export` | `{ resource: 'garage', action: 'read' }` | `date_from`, `date_to` | Xuất file Excel báo cáo tổng quan 2 sheets |
| `GET` | `/opex` | `{ resource: 'garage', action: 'read' }` | `year`, `month`, `page`, `pageSize`, `sorts`, `columnFilters`, `columnSearch` | Danh sách chi phí vận hành có phân trang, sort, filter |
| `GET` | `/opex/column-options`| `{ resource: 'garage', action: 'read' }` | `column`, `search`, `page`, `pageSize`, `filtersStr` | Danh sách giá trị phân biệt phục vụ Header Filter |
| `GET` | `/opex/:id` | `{ resource: 'garage', action: 'read' }` | `id` (uuid) | Chi tiết một khoản chi phí vận hành |
| `POST` | `/opex` | `{ resource: 'garage', action: 'create' }`| `CreateGarageOpexDto` | Tạo mới khoản chi phí vận hành |
| `PUT` | `/opex/:id` | `{ resource: 'garage', action: 'update' }`| `UpdateGarageOpexDto` | Cập nhật khoản chi phí vận hành |
| `DELETE`| `/opex/:id` | `{ resource: 'garage', action: 'delete' }`| `id` (uuid) | Xóa khoản chi phí vận hành |
| `GET` | `/pnl-report` | `{ resource: 'garage', action: 'read' }` | `year`, `month` | Báo cáo Lợi nhuận P&L 7 dòng theo tháng |
| `GET` | `/pnl-report/export` | `{ resource: 'garage', action: 'read' }`| `year`, `month` | Xuất file Excel Báo cáo P&L theo tháng |

---

## 5. Logic Nghiệp vụ & Thuật toán Trọng tâm

### 5.1. Công thức Báo cáo Lợi nhuận (P&L):
1. **Doanh thu ($R$)**:
   $$\sum \text{COALESCE}(gp.\text{doanh\_thu}, c.\text{doanh\_thu}, c.\text{tien\_co\_thue}, 0)$$
   áp dụng cho các phiếu hoàn thành trong tháng `TO_CHAR(c.ngay_hoan_thanh_cong_viec, 'YYYY-MM') = :periodStr`.
2. **Chi phí giá vốn ($C_{COGS}$)**:
   $$\sum \text{COALESCE}(gp.\text{chi\_phi}, c.\text{chi\_phi}, 0)$$
3. **Lợi nhuận gộp ($GP$)**:
   $$GP = R - C_{COGS}, \quad \text{Gross Margin} = \frac{GP}{R} \times 100\%$$
4. **Chi phí vận hành ($OPEX$)**:
   Tổng `amount` các bản ghi trong `kgara_operating_expenses` có `category_key NOT LIKE 'HOA_HONG_%'` trong kỳ.
5. **Lợi nhuận ròng trước hoa hồng ($NP_{pre}$)**:
   $$NP_{pre} = GP - OPEX$$
6. **Hoa hồng ($COMM$)**:
   Tổng `amount` các bản ghi trong `kgara_operating_expenses` có `category_key LIKE 'HOA_HONG_%'` trong kỳ.
7. **Lợi nhuận ròng sau hoa hồng ($NP_{post}$)**:
   $$NP_{post} = NP_{pre} - COMM, \quad \text{Net Margin} = \frac{NP_{post}}{R} \times 100\%$$

---

## 6. Tích hợp Liên Module & Frontend

- **Backend Module**: `src/kgara-api-core/`
- **Frontend (`erp-web`)**:
  - API Client:
    - [`garageDashboardApi.ts`](file:///home/dev/repos-dev-1/erp/erp-web/src/modules/garage/api/garageDashboardApi.ts)
    - [`garageOpexApi.ts`](file:///home/dev/repos-dev-1/erp/erp-web/src/modules/garage/api/garageOpexApi.ts)
  - Custom Hook:
    - [`useGarageOpexList.ts`](file:///home/dev/repos-dev-1/erp/erp-web/src/modules/garage/hooks/useGarageOpexList.ts)
  - Pages & Components:
    - [`GarageDashboard.tsx`](file:///home/dev/repos-dev-1/erp/erp-web/src/modules/garage/pages/GarageDashboard.tsx) (Trang Dashboard chính chứa Section P&L)
    - [`GaragePnlSection.tsx`](file:///home/dev/repos-dev-1/erp/erp-web/src/modules/garage/components/GaragePnlSection.tsx) (Section Báo cáo P&L dạng bảng phân cấp, bộ lọc Combobox Tháng/Năm, xuất Excel P&L)
    - [`GarageOpex.tsx`](file:///home/dev/repos-dev-1/erp/erp-web/src/modules/garage/pages/GarageOpex.tsx) (Trang danh sách Chi phí vận hành dạng Spreadsheet, Combobox filter, sort/filter server-side)
    - [`GarageOpexDrawer.tsx`](file:///home/dev/repos-dev-1/erp/erp-web/src/modules/garage/components/GarageOpexDrawer.tsx) (1-column StandardFormDrawer tạo/sửa chi phí với Combobox)

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

1. **TypeCheck & Linting**: Chạy `bun run check:ci` trong `erp-api/` và `erp-web/`.
2. **Backend Unit Tests**: Chạy `bunx jest src/kgara-api-core/ --forceExit` (bắt buộc pass 100%).
3. **Web Build**: Chạy `bun run build` trong `erp-web/` (bắt buộc pass 100%).
