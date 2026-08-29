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
- **Quản lý Chi phí vận hành (OPEX), Giá vốn nhập tay & Hoa hồng**:
  - Nhập tay chi phí vận hành hàng tháng (nhân sự, thuê mặt bằng, điện nước, vật tư tiêu hao, bảo trì, khấu hao, khác), giá vốn trực tiếp (hoa hồng trực tiếp DV, chi phí trực tiếp khác) và hoa hồng (sale, dịch vụ).
  - Phân loại qua `category_key` theo 3 nhóm chi phí: `OPEX` (CP Vận hành), `COGS` (Giá vốn), `COMMISSION` (Hoa hồng), lưu trữ theo `(period_year, period_month)`.
  - Hỗ trợ phát sinh định kỳ lặp lại theo chu kỳ tháng (`monthly`) với cơ chế áp dụng linh hoạt chuẩn Google Calendar (`this` vs `this_and_future`).
  - Hỗ trợ xem danh sách bảng chuẩn `/greenway/dashboard/opex` theo đúng quy chuẩn `standardize-table-page` & `standardize-table`:
    - Cột STT (`#`) bắt đầu chính xác từ số 1.
    - Cột Kỳ báo cáo (`period`) tích hợp `<DateRangeColumnSlot>` lọc khoảng ngày/tháng và các quick presets.
    - Context Menu (Row Actions) 4 thao tác chuẩn hóa: **Xem chi tiết** (`Eye`), **Chỉnh sửa** (`Pencil`), **Nhân đôi** (`Copy` - prefill toàn bộ dữ liệu vào form tạo mới), **Xóa** (`Trash2`).
    - Xem/sửa/nhân đôi qua 1-column StandardFormDrawer (`GarageOpexDrawer.tsx`) tích hợp xem trước số tiền bằng chữ (Vietnamese Currency Words) và định dạng số.
- **Tiến độ Dòng tiền & Công nợ Dịch vụ (`GaragePaymentProgressCard.tsx` & `GarageMonthDetailDrawer.tsx`)**:
  - Tích hợp bảng chuẩn ERP `<DataTable>` (Spreadsheet variant) hiển thị chi tiết theo từng tháng từ mốc đối soát dòng tiền (`2026-07` trở đi).
  - Switch chuyển Tab pill bo tròn gọn gàng chuẩn Dashboard Tổng quan với 2 lựa chọn: **Phải Thu** & **Phải Trả**.
  - Tiêu đề cột tinh gọn & đồng bộ, bố cục chuẩn hóa:
    - Tab **Phải Thu**: `#` | `Tháng` | `Số vụ việc` (120px) | `Doanh Thu` | `Còn Phải Thu` (nền neutral) | `Tổng Phải Thu` (progress bar xanh ngọc `#059669`, compact format, tooltip đầy đủ) | `Có HĐ` | `Không HĐ`.
    - Tab **Phải Trả**: `#` | `Tháng` | `Số vụ việc` (120px) | `Còn Phải Trả` (nền neutral) | `Tổng Phải Trả` (progress bar cam `#ea580c`, compact format, tooltip đầy đủ) | `Có HĐ` | `Không HĐ`.
  - Hỗ trợ Context Menu chuột phải trên từng dòng tháng mở **`GarageMonthDetailDrawer.tsx`** (2-column StandardFormDrawer layout):
    - **Cột Trái (Main Content)**: Bảng chuẩn `standardize-table` phân rã theo Nghiệp vụ (`Sửa chữa chung`, `Ký gửi / Nội bộ`, `OJ Ngoài`, `Khác`) và Bảng phân loại theo Hóa đơn Thuế (Có HĐ vs Không HĐ) với các cột `#`, `Loại nghiệp vụ`, `Tổng phát sinh`, `Đã thu/chi`, `Còn lại`, `Tỷ trọng (%)` và dòng tổng cộng `Σ`. Cả 2 bảng tích hợp 100% Header Filters & Sorting (`createColumnHeaderFilter`), loại bỏ outer wrapper div chống double-border và đồng nhất nút `Xóa bộ lọc (N)` nằm bên trái cạnh tiêu đề section.
    - **Cột Phải**: Các `DrawerSection` độc lập (Tổng quan Thu/Chi, Thống kê Vụ việc theo Phân loại, Tỷ lệ Hoàn tất) có hỗ trợ **Expand / Collapse** toàn cột phải và từng section con.
  - Phân tách chi tiết 2 nhóm hóa đơn: **Có HĐ** (`hd_phieu_dich_vu_id IS NOT NULL`) và **Không HĐ** (`hd_phieu_dich_vu_id IS NULL`).
  - Tích hợp đầy đủ từ điển đa ngôn ngữ i18n (`garage:progress`) cho cả tiếng Việt và tiếng Anh.
- **Báo cáo Lợi nhuận P&L theo Tháng Đơn Lẻ (`getPnlReport` & `GaragePnlSection.tsx`)**:
  - Đặt vị trí ưu tiên nằm ngay trên Section Tiến độ Dòng tiền với badge header phong cách đồng bộ (`Báo cáo Lợi nhuận (P&L)`).
  - Nút **Quản lý CP vận hành** đặt tại góc trên bên phải Section Header.
  - Combobox **Kỳ báo cáo (Tháng/Năm)** đặt bên trong Card Header (bên trái), đối xứng với nút **Xuất Excel** (bên phải), loại bỏ divider thừa.
  - Bảng tài chính thiết kế tinh giản, trung tính (chỉ highlight nhẹ dòng Lợi nhuận ròng sau hoa hồng).
  - Bố cục **4 cột chuẩn hóa**: `Danh Mục` | `Phát sinh OJ` (Cột riêng cho Omoda/Jaecoo kèm % tỷ trọng & biên LN nằm bên trái Tháng này) | `Tháng này` (Tổng) | `Tháng trước` (Tổng).
  - Bổ sung các badge % tỷ trọng theo doanh thu cho cột tháng trước, tháng này và cột OJ (COGS, OPEX, Gross Margin, Net Margin).
  - Khung Card giao diện sử dụng `bg-surface border border-border rounded-xl p-5 card-shadow overflow-hidden min-w-0` đồng bộ hoàn toàn hiệu ứng đổ bóng `card-shadow` trên Dashboard.
  - Tổng hợp tự động 7 chỉ mục tài chính phân cấp:
    1. `I. Doanh Thu` (Doanh thu dịch vụ đã hoàn thành)
    2. `II. Chi phí (Giá vốn)` (Phụ tùng & gia công ngoài + Direct Costs nhập tay)
    3. `III. Lợi nhuận gộp` (`Gross Profit = Revenue - COGS`, kèm % Biên LN gộp)
    4. `IV. Chi phí vận hành` (Tổng hợp các khoản OPEX trong tháng)
    5. `V. Lợi nhuận ròng (trước hoa hồng)` (`Net Profit Before Commission = Gross Profit - OPEX`)
    6. `VI. Hoa hồng` (Tổng hợp các khoản hoa hồng `HOA_HONG_*` trong tháng)
    7. `VII. Lợi nhuận ròng (sau hoa hồng)` (`Net Profit After Commission = Net Profit Before Commission - Commission`, kèm % Biên LN ròng)
  - Tự động ghép nối và đối soát dòng con chi tiết giữa 2 tháng (`mergePnlItems`), hiển thị đầy đủ số tiền tháng trước và số tiền chi riêng cho OJ cho từng danh mục phát sinh.
- **Chỉ số KPI Sparklines theo Chu kỳ (`getCheckpointKpis` & `GarageStatsCards.tsx`)**:
  - Phân tích 3 chu kỳ: **Tháng này** (Sparkline 6 tháng), **Tuần này** (Sparkline 4 tuần), **Hôm nay** (Sparkline 7 ngày) theo Ngày hoàn thành.
  - Tooltip Sparkline hiển thị 2 dòng tinh gọn và chuẩn xác:
    - Card Doanh thu: **Doanh thu thuần** & **Doanh thu có VAT** (khớp số liệu với bảng chi tiết).
    - Card Chi phí: **Chi phí thuần** & **Chi phí có VAT**.
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

#### Bảng `kgara_operating_expenses`
| Tên Cột | Kiểu Dữ Liệu | Nullable | Mặc Định | Ràng Buộc / Index | Mô Tả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `uuid_generate_v4()` | PK | Định danh bản ghi chi phí |
| `period_year` | `smallint` | NO | — | Index `idx_kgara_opex_period` | Năm chi phí (vd: 2026) |
| `period_month` | `smallint` | NO | — | Index `idx_kgara_opex_period` | Tháng chi phí (1 - 12) |
| `category_key` | `varchar(100)` | NO | — | Index `idx_kgara_opex_category` | Mã loại CP (NHAN_SU, THUE_MAT_BANG, HOA_HONG_TRUC_TIEP, CHI_PHI_TRUC_TIEP_KHAC, HOA_HONG_SALE,...) |
| `category_name` | `varchar(255)` | NO | — | — | Tên/Diễn giải chi tiết khoản chi |
| `amount` | `numeric(18,2)` | NO | `0` | — | Số tiền chi phí (VND) |
| `oj_amount` | `numeric(18,2)` | NO | `0` | — | Số tiền chi phí phân bổ tính riêng cho OJ (Omoda/Jaecoo) |
| `note` | `text` | YES | `null` | — | Ghi chú bổ sung |
| `recurrence_type` | `varchar(20)` | YES | `null` | — | Chu kỳ lặp lại (`monthly` hoặc null) |
| `recurrence_until_year` | `smallint` | YES | `null` | — | Năm kết thúc chuỗi định kỳ |
| `recurrence_until_month`| `smallint` | YES | `null` | — | Tháng kết thúc chuỗi định kỳ |
| `recurrence_anchor_id`  | `uuid` | YES | `null` | Index `idx_kgara_opex_recurrence_anchor` | ID bản ghi gốc trong chuỗi định kỳ |
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
│   └── garage-opex.dto.ts              # Create, Update, ApplyRecurring, List Query DTOs cho OPEX
├── entities/
│   └── kgara_operating_expense.entity.ts # TypeORM Entity cho kgara_operating_expenses
├── services/
│   ├── garage-opex.service.ts          # CRUD OPEX, recurring upsert & period summary (COGS/OPEX/Commission)
│   └── garage-opex.service.spec.ts     # Unit tests cho GarageOpexService (Pass 100%)
├── garage-dashboard.controller.ts      # REST Controller (Dashboard, Checkpoint, OPEX, P&L, ApplyRecurring)
├── garage-dashboard.service.ts         # Aggregation Doanh thu/COGS/DirectCost, P&L Report, ExcelJS
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
| `POST`| `/opex/:id/apply-recurring` | `{ resource: 'garage', action: 'update' }`| `ApplyRecurringOpexDto` | Áp dụng thay đổi định kỳ (This vs This and Future) |
| `DELETE`| `/opex/:id` | `{ resource: 'garage', action: 'delete' }`| `id` (uuid) | Xóa khoản chi phí vận hành |
| `GET` | `/pnl-report` | `{ resource: 'garage', action: 'read' }` | `year`, `month` | Báo cáo Lợi nhuận P&L theo tháng kèm `cogsAdjustment` |
| `GET` | `/pnl-report/export` | `{ resource: 'garage', action: 'read' }`| `year`, `month` | Xuất file Excel Báo cáo P&L theo tháng |

---

## 5. Logic Nghiệp vụ & Thuật toán Trọng tâm

### 5.1. Công thức Báo cáo Lợi nhuận (P&L):
1. **Doanh thu ($R$)**:
   $$\sum \text{COALESCE}(gp.\text{doanh\_thu}, c.\text{doanh\_thu}, c.\text{tien\_co\_thue}, 0)$$
   áp dụng cho các phiếu hoàn thành trong tháng `TO_CHAR(c.ngay_hoan_thanh_cong_viec, 'YYYY-MM') = :periodStr`.
2. **Chi phí giá vốn ($C_{COGS}$)**:
   $$C_{COGS} = \sum \text{COALESCE}(gp.\text{chi\_phi}, c.\text{chi\_phi}, 0) + \sum \text{DirectCosts}_{\text{nhập tay}}$$
   với $\text{DirectCosts}$ là các khoản OPEX có `category_key IN ('HOA_HONG_TRUC_TIEP', 'CHI_PHI_TRUC_TIEP_KHAC')`.
3. **Lợi nhuận gộp ($GP$)**:
   $$GP = R - C_{COGS}, \quad \text{Gross Margin} = \frac{GP}{R} \times 100\%$$
4. **Chi phí vận hành ($OPEX$)**:
   Tổng `amount` các bản ghi trong `kgara_operating_expenses` có `category_key NOT LIKE 'HOA_HONG_%'` và `category_key NOT IN ('CHI_PHI_TRUC_TIEP_KHAC')` trong kỳ.
5. **Lợi nhuận ròng trước hoa hồng ($NP_{pre}$)**:
   $$NP_{pre} = GP - OPEX$$
6. **Hoa hồng ($COMM$)**:
   Tổng `amount` các bản ghi trong `kgara_operating_expenses` có `category_key LIKE 'HOA_HONG_%'` và `category_key != 'HOA_HONG_TRUC_TIEP'` trong kỳ.
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
