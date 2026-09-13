---
name: operating-expenses
description: Module tri thức Quản lý Chi phí Vận hành (Operating Expenses / Recurring Budget) trong erp-api (operating-expenses-core) và erp-web. Chứa toàn bộ database schema (erp_operating_expenses), DTOs, API endpoints, logic phân kỳ Tháng/Năm, Động cơ Phát sinh Định kỳ (Recurrence Engine: this vs this_and_future), danh mục chuẩn doanh nghiệp, bộ lọc Header Filter, SpreadsheetPageTemplate và Drawer đọc tiền bằng chữ.
---

# Module Tri Thức: Chi Phí Vận Hành Toàn Doanh Nghiệp (Operating Expenses Core)

Module `operating-expenses-core` chịu trách nhiệm quản lý, phân bổ và dự báo toàn bộ các khoản chi phí vận hành, chi phí định kỳ và giá vốn toàn công ty (tiền thuê văn phòng, điện nước & viễn thông, nhân sự & tiền lương, phần mềm IT, bảo trì, khấu hao, tiếp khách, v.v.), chu kỳ lặp lại theo tháng và theo dõi trạng thái thanh toán.

---

## 1. Database Schema & Entities

- **Table**: `erp_operating_expenses`
- **Entity**: `ErpOperatingExpense` (`src/operating-expenses-core/entities/erp_operating_expense.entity.ts`)

| Column | Type | Nullable | Description |
| :--- | :--- | :---: | :--- |
| `id` | `uuid` | PK | Khóa chính |
| `expense_no` | `varchar(255)` | No | Mã định danh khoản chi (VD: `EXP-202608-001`) |
| `branch_id` | `uuid` | Yes | Mã chi nhánh |
| `supplier_id` | `uuid` | Yes | Mã nhà cung cấp/đối tác |
| `supplier_name_snapshot` | `varchar(255)` | Yes | Tên đối tác snapshot |
| `category_key` | `varchar(100)` | Yes | Mã phân loại chuẩn (VD: `NHAN_SU_LUONG`, `THUE_MAT_BANG`,...) (**Index**) |
| `expense_category` | `varchar(255)` | Yes | Danh mục chi phí |
| `cost_group` | `varchar(50)` | Yes | Nhóm chi phí (`OPEX`, `COGS`, `COMMISSION`) (**Index**) |
| `title` | `text` | Yes | Tiêu đề / Nội dung / Diễn giải chi phí |
| `period_year` | `smallint` | Yes | Năm phát sinh chi phí (VD: `2026`) (**Index**) |
| `period_month` | `smallint` | Yes | Tháng phát sinh chi phí (`1` - `12`) (**Index**) |
| `document_date` | `date` | Yes | Ngày phát sinh chi phí |
| `due_date` | `date` | Yes | Hạn thanh toán |
| `total_amount` | `numeric(18,2)` | No | Số tiền chi phí (VNĐ) |
| `invoice_status` | `varchar(50)` | Yes | Trạng thái hóa đơn (`REQUIRED`, `NOT_REQUIRED`, `ATTACHED`) |
| `status` | `varchar(50)` | No | Trạng thái khoản chi (`DRAFT`, `CONFIRMED`, `CANCELLED`) |
| `payment_status` | `varchar(50)` | No | Trạng thái thanh toán (`UNPAID`, `PARTIAL`, `PAID`) |
| `recurrence_type` | `varchar(50)` | Yes | Chu kỳ (`ONE_TIME`, `MONTHLY`, `QUARTERLY`, `YEARLY`) |
| `recurrence_interval` | `int` | Yes | Bước nhảy chu kỳ (VD: `1` tháng) |
| `recurrence_until_year` | `smallint` | Yes | Năm kết thúc chuỗi định kỳ |
| `recurrence_until_month`| `smallint` | Yes | Tháng kết thúc chuỗi định kỳ |
| `recurrence_anchor_id` | `uuid` | Yes | Khóa ngoại trỏ đến bản ghi gốc khởi tạo chuỗi định kỳ (**Index**) |
| `next_due_date` | `date` | Yes | Ngày đến hạn tiếp theo |
| `auto_generate_next` | `boolean` | Yes | Tự động tạo khoản chi kỳ tiếp theo |
| `notes` | `text` | Yes | Ghi chú |
| `is_deleted` | `boolean` | No | Cờ xóa mềm (default `false`) |

---

## 2. Danh Mục Chuẩn Toàn Doanh Nghiệp (Category Presets)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DANH MỤC CHI PHÍ TOÀN DOANH NGHIỆP                       │
├───────────────────────┬──────────────────────────┬──────────────────────────┤
│   1. Nhóm OPEX        │   2. Nhóm COGS           │   3. Nhóm COMMISSION     │
├───────────────────────┼──────────────────────────┼──────────────────────────┤
│ • NHAN_SU_LUONG       │ • THAU_PHU_GIA_CONG      │ • HOA_HONG_KINH_DOANH    │
│ • THUE_MAT_BANG       │ • VAN_CHUYEN_LOGISTICS   │ • MARKETING_QC           │
│ • DIEN_NUOC_NET       │ • CHI_PHI_TRUC_TIEP_KHAC │ • CHIET_KHAU_TM          │
│ • DUNG_CU_VP          │                          │ • HOA_HONG_KHAC          │
│ • PHAN_MEM_IT         │                          │                          │
│ • BAO_TRI             │                          │                          │
│ • KHAU_HAO            │                          │                          │
│ • CONG_TAC_PHI        │                          │                          │
│ • KHAC                │                          │                          │
└───────────────────────┴──────────────────────────┴──────────────────────────┘
```

---

## 3. API Endpoints

Base Route: `/api/v1/operating-expenses`

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/column-options` | Lấy danh sách options phân trang distinct cho từng cột (hỗ trợ cross-filter) |
| `GET` | `/` | Lấy danh sách khoản chi có phân trang, bộ lọc đa cột, lọc `cost_group`, lọc `period` (MM/YYYY), sort, tổng tiền aggregate |
| `GET` | `/:id` | Xem chi tiết 1 khoản chi (kèm format `period`) |
| `POST` | `/` | Tạo mới khoản chi phí vận hành (tự động generate chuỗi định kỳ nếu có `recurrenceType = 'MONTHLY'`) |
| `PATCH` | `/:id` | Cập nhật thông tin khoản chi đơn lẻ |
| `POST` | `/:id/apply-recurring` | Áp dụng thay đổi định kỳ (`applyScope: 'this' \| 'this_and_future'`) |
| `DELETE`| `/:id` | Xóa mềm khoản chi (`scope: 'this' \| 'this_and_future'`) |

---

## 4. Frontend UI/UX Standard

1. **SpreadsheetPageTemplate**: Toolbar `<PillTabs>` lọc 4 nhóm chi phí (`ALL`, `OPEX`, `COGS`, `COMMISSION`).
2. **100% Header Căn Giữa**: `headerClassName: "text-center"`, `align: "center"`.
3. **Thao Tác Context Menu & Nút Thao Tác**: Hỗ trợ Xem chi tiết (`Eye`), Chỉnh sửa (`Pencil`), **Nhân đôi (`Copy`)**, Xóa (`Trash2`).
4. **Drawer Đọc Số Bằng Chữ**: Hiển thị realtime định dạng tiền tệ và đọc số tiền bằng chữ (`readVietnameseCurrency`).
5. **Modal Xác Nhận Định Kỳ**: `BudgetRecurringConfirmModal` với 2 scope kiểu Google Calendar:
   - `this`: Chỉ sửa bản ghi kỳ tháng hiện tại.
   - `this_and_future`: Áp dụng cho kỳ hiện tại và toàn bộ các tháng tương lai trong chuỗi liên kết.
