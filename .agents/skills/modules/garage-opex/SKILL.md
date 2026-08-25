---
name: garage-opex
description: Module tri thức Quản lý Chi phí Vận hành (OPEX), Giá vốn nhập tay & Hoa hồng Garage trong erp-api (kgara-api-core). Chứa toàn bộ database schema (kgara_operating_expenses), categories chuẩn (NHAN_SU, THUE_MAT_BANG, VAT_TU_TIEU_HAO, BAO_TRI, KHAU_HAO, HOA_HONG_*), DTOs, API endpoints, logic phát sinh định kỳ (Recurrence Engine), tích hợp báo cáo P&L và kết nối frontend drawer/table.
---

# 📦 Module Tri Thức: Quản Lý Chi Phí Vận Hành Garage (Garage OPEX & Direct Costs) - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Phân hệ **Quản lý Chi phí Vận hành Garage (`garage-opex`)** thuộc lõi `kgara-api-core` trong hệ thống Liouni ERP. Module này chịu trách nhiệm số hóa, phân loại, lưu trữ và tổng hợp toàn bộ các khoản chi phí phát sinh ngoài các chi phí trực tiếp trên phiếu dịch vụ (như phụ tùng, công thợ), phục vụ việc lập Báo cáo Lợi nhuận P&L (`getPnlReport`) và phân tích điểm hòa vốn cho xưởng dịch vụ Greenway.

### Các nghiệp vụ trọng tâm:
- **3 Nhóm Chi Phí Cốt Lõi (`CostGroupType`)**:
  1. **Chi phí Vận hành (`OPEX`)**: Các chi phí định phí và biến phí vận hành xưởng (Nhân sự, Thuê mặt bằng, Điện nước, Vật tư tiêu hao, Bảo trì thiết bị, Khấu hao tài sản, Khác).
  2. **Chi phí Giá vốn Nhập tay (`COGS`)**: Các chi phí giá vốn phát sinh ngoài phiếu dịch vụ hoặc chi phí đối tác trực tiếp (`HOA_HONG_TRUC_TIEP`, `CHI_PHI_TRUC_TIEP_KHAC`).
  3. **Hoa hồng Xưởng (`COMMISSION`)**: Các khoản trích thưởng hoa hồng kinh doanh và dịch vụ (`HOA_HONG_SALE`, `HOA_HONG_DV`, `HOA_HONG_KHAC`).
- **Lưu trữ & Phân kỳ theo Tháng (`period_year`, `period_month`)**: Quản lý chi phí chi tiết theo từng tháng báo cáo tài chính.
- **Tách bạch Chi phí Phân bổ Cho Dòng Xe Ngoài (`oj_amount`)**: Cho phép ghi nhận số tiền chi phí phân bổ riêng cho nhánh dịch vụ Omoda/Jaecoo (`OJ`) để đối soát biên lợi nhuận riêng.
- **Động cơ Phát sinh Định kỳ (Recurrence Engine)**: Tự động nhân bản chi phí cố định (như tiền thuê nhà, bảo trì, khấu hao) sang các tháng tương lai theo chu kỳ hàng tháng (`monthly`), với cơ chế chỉnh sửa linh hoạt kiểu Google Calendar:
  - `this`: Chỉ sửa/xóa bản ghi của tháng hiện tại.
  - `this_and_future`: Áp dụng chỉnh sửa/xóa cho bản ghi hiện tại và toàn bộ các tháng tương lai trong chuỗi liên kết (`recurrence_anchor_id`).
- **Tích hợp Trực tiếp vào Báo cáo P&L Garage**: Tự động cấp dữ liệu tổng hợp cho `GarageDashboardService.getPnlReport()` để tính:
  - $\text{Gross Profit} = \text{Revenue} - (\text{COGS Direct} + \text{COGS Opex Adjustment})$
  - $\text{Net Profit (trước hoa hồng)} = \text{Gross Profit} - \text{Total OPEX}$
  - $\text{Net Profit (sau hoa hồng)} = \text{Net Profit (trước HH)} - \text{Total Commission}$

---

## 2. Database Schema & Cấu trúc Dữ liệu

### Bảng `kgara_operating_expenses`

| Cột | Kiểu dữ liệu | Nullable | Mặc định | Mô tả / Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính nội bộ (PK) |
| `period_year` | `smallint` | NO | — | Năm phát sinh chi phí (vd: `2026`) (**Index**) |
| `period_month` | `smallint` | NO | — | Tháng phát sinh chi phí (`1` - `12`) (**Index**) |
| `category_key` | `varchar(100)`| NO | — | Mã phân loại chuẩn (vd: `NHAN_SU`, `THUE_MAT_BANG`,...) (**Index**) |
| `category_name`| `varchar(255)`| NO | — | Tên hiển thị / Diễn giải nội dung chi phí |
| `amount` | `numeric(18,2)`| NO | `0` | Số tiền chi phí tổng cộng (VNĐ) |
| `oj_amount` | `numeric(18,2)`| NO | `0` | Số tiền chi phí phân bổ tính riêng cho OJ (VNĐ) |
| `note` | `text` | YES | `NULL` | Ghi chú chi tiết khoản chi |
| `recurrence_type` | `varchar(20)` | YES | `NULL` | Chu kỳ lặp lại (`monthly` hoặc `NULL`) |
| `recurrence_until_year` | `smallint` | YES | `NULL` | Năm kết thúc chuỗi định kỳ |
| `recurrence_until_month`| `smallint` | YES | `NULL` | Tháng kết thúc chuỗi định kỳ |
| `recurrence_anchor_id` | `uuid` | YES | `NULL` | Khóa ngoại trỏ đến bản ghi gốc khởi tạo chuỗi định kỳ (**Index**) |
| `created_by` | `uuid` | YES | `NULL` | ID tài khoản người tạo |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật |

#### Composite Indexes:
- `idx_kgara_opex_period`: `(period_year, period_month)` $\rightarrow$ Tối ưu truy vấn báo cáo theo kỳ.
- `idx_kgara_opex_category`: `(category_key)` $\rightarrow$ Tối ưu phân loại nhóm chi phí.
- `idx_kgara_opex_recurrence_anchor`: `(recurrence_anchor_id)` $\rightarrow$ Tối ưu thao tác cập nhật chuỗi định kỳ `this_and_future`.

---

## 3. Danh mục Chi phí Chuẩn (Standard Categories & Presets)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DANH MỤC CHI PHÍ GARAGE                            │
├───────────────────────┬──────────────────────────┬──────────────────────────┤
│   1. Nhóm OPEX        │   2. Nhóm COGS           │   3. Nhóm COMMISSION     │
├───────────────────────┼──────────────────────────┼──────────────────────────┤
│ • NHAN_SU             │ • HOA_HONG_TRUC_TIEP     │ • HOA_HONG_SALE          │
│ • THUE_MAT_BANG       │ • CHI_PHI_TRUC_TIEP_KHAC │ • HOA_HONG_DV            │
│ • DIEN_NUOC           │                          │ • HOA_HONG_KHAC          │
│ • VAT_TU_TIEU_HAO     │                          │                          │
│ • BAO_TRI             │                          │                          │
│ • KHAU_HAO            │                          │                          │
│ • KHAC                │                          │                          │
└───────────────────────┴──────────────────────────┴──────────────────────────┘
```

### Chi tiết các mã danh mục (`category_key`):

| Nhóm (`CostGroup`) | `category_key` | Tên mặc định (`categoryName`) | Mục đích hạch toán P&L |
| :--- | :--- | :--- | :--- |
| **OPEX** | `NHAN_SU` | Nhân sự | Tiền lương, thưởng, phụ cấp thợ & kỹ thuật viên |
| **OPEX** | `THUE_MAT_BANG` | Thuê mặt bằng & điện nước | Chi phí thuê xưởng, hạ tầng |
| **OPEX** | `DIEN_NUOC` | Điện nước | Chi phí tiền điện, tiền nước vận hành |
| **OPEX** | `VAT_TU_TIEU_HAO`| Vật tư tiêu hao | Giẻ lau, dầu bóng, băng keo, hóa chất phụ |
| **OPEX** | `BAO_TRI` | Bảo trì | Bảo dưỡng cầu nâng, máy nén khí, phòng sơn |
| **OPEX** | `KHAU_HAO` | Khấu hao máy móc & thiết bị | Khấu hao thiết bị sửa chữa xưởng |
| **OPEX** | `KHAC` | Khác | Chi phí quản lý xưởng phát sinh khác |
| **COGS** | `HOA_HONG_TRUC_TIEP` | Hoa hồng trực tiếp | Chi phí hoa hồng tính thẳng vào giá vốn dịch vụ |
| **COGS** | `CHI_PHI_TRUC_TIEP_KHAC`| Chi phí trực tiếp khác | Gia công tiện phay ngoài, thuê đồ gá đặc thù |
| **COMMISSION** | `HOA_HONG_SALE` | Hoa hồng cho Sale | Trích thưởng doanh số bán hàng/dịch vụ |
| **COMMISSION** | `HOA_HONG_DV` | Hoa hồng cho KTV DV | Trích thưởng hiệu suất cố vấn dịch vụ / KTV |
| **COMMISSION** | `HOA_HONG_KHAC` | Hoa hồng khác | Thưởng đối tác giới thiệu khách hàng |

---

## 4. Cấu trúc Source Code Backend

```text
src/kgara-api-core/
├── entities/
│   └── kgara_operating_expense.entity.ts # Entity TypeORM bảng kgara_operating_expenses
├── dto/
│   └── garage-opex.dto.ts                # CreateGarageOpexDto, UpdateGarageOpexDto, ApplyRecurringOpexDto, ListGarageOpexQueryDto
├── services/
│   ├── garage-opex.service.ts            # Logic nghiệp vụ CRUD, lọc đa chiều, Recurrence engine, P&L aggregation
│   └── garage-opex.service.spec.ts       # Bộ kiểm thử Unit test cho OPEX
├── garage-dashboard.controller.ts        # Endpoints REST API (/greenway/dashboard/opex)
└── scripts/
    └── seed-garage-opex.ts               # Script nạp dữ liệu chi phí vận hành từ bảng tính
```

---

## 5. Danh sách API Endpoints (`/greenway/dashboard/opex`)

| Phương thức | Endpoint | DTO / Query | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/greenway/dashboard/opex` | `ListGarageOpexQueryDto` | Lấy danh sách CP vận hành có phân trang, sort và server-side filter theo kỳ/nhóm/mã |
| `GET` | `/greenway/dashboard/opex/column-options`| `columnKey`, `search` | Lấy danh sách options duy nhất phục vụ Filter Popover trên Data Table |
| `GET` | `/greenway/dashboard/opex/:id` | — | Lấy thông tin chi tiết 1 bản ghi chi phí |
| `POST`| `/greenway/dashboard/opex` | `CreateGarageOpexDto` | Tạo mới bản ghi chi phí (hỗ trợ tạo chuỗi định kỳ nếu có `recurrenceType = 'monthly'`) |
| `PUT` | `/greenway/dashboard/opex/:id` | `UpdateGarageOpexDto` | Chỉnh sửa bản ghi chi phí đơn lẻ |
| `POST`| `/greenway/dashboard/opex/:id/apply-recurring` | `ApplyRecurringOpexDto` | Chỉnh sửa/Áp dụng biến động chuỗi định kỳ (`scope: 'this' \| 'this_and_future'`) |
| `DELETE` | `/greenway/dashboard/opex/:id` | `scope` (query) | Xóa bản ghi (`this` hoặc `this_and_future`) |

---

## 6. Logic Nghiệp Vụ Trọng Tâm

### 6.1. Thuật toán Tổng hợp Chi phí theo Kỳ (`getSummaryByPeriod`)
```typescript
// Phân loại tự động dựa trên category_key
if (item.categoryKey === 'HOA_HONG_TRUC_TIEP' || item.categoryKey === 'CHI_PHI_TRUC_TIEP_KHAC') {
  directCostItems.push(row);
  totalDirectCost += item.amount;
  ojTotalDirectCost += item.ojAmount;
} else if (item.categoryKey.startsWith('HOA_HONG_')) {
  commissionItems.push(row);
  totalCommission += item.amount;
  ojTotalCommission += item.ojAmount;
} else {
  opexItems.push(row);
  totalOpex += item.amount;
  ojTotalOpex += item.ojAmount;
}
```

### 6.2. Thuật toán Xử lý Chuỗi Định kỳ (Recurring Engine)
Khi người dùng tạo khoản chi lặp lại hàng tháng đến tháng $M_{end}/Y_{end}$:
1. Hệ thống tạo bản ghi gốc (anchor) với `recurrence_type = 'monthly'` và `recurrence_anchor_id = NULL`.
2. Hệ thống chạy vòng lặp sinh các bản ghi con cho các tháng tiếp theo với `recurrence_anchor_id = anchor.id`.
3. Khi chỉnh sửa với cờ `this_and_future`, hệ thống tìm toàn bộ các bản ghi con có `(period_year * 100 + period_month) >= (current_year * 100 + current_month)` và cùng `recurrence_anchor_id` để cập nhật đồng bộ.

---

## 7. Scripts Vận Hành & Nạp Dữ Liệu

- **Nạp dữ liệu từ bảng tính**:
  ```bash
  bun src/kgara-api-core/scripts/seed-garage-opex.ts .env.greenway-production --apply
  ```
- **Chạy kiểm thử Unit Tests**:
  ```bash
  bun test src/kgara-api-core/services/garage-opex.service.spec.ts
  ```
