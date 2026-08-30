---
name: operating-expenses
description: Module tri thức Quản lý Chi phí Vận hành (Operating Expenses / Recurring Budget) trong erp-api (operating-expenses-core). Chứa toàn bộ database schema (erp_operating_expenses), DTOs, API endpoints, logic getColumnOptions, applyMultiKeywordFilter, aggregate totalAmountSum và tích hợp liên module với kế toán dòng tiền.
---

# Module Tri Thức: Chi Phí Vận Hành (Operating Expenses Core)

Module `operating-expenses-core` chịu trách nhiệm quản lý các khoản chi phí vận hành, chi phí định kỳ (tiền thuê, điện nước, internet, lương, v.v.), chu kỳ lặp lại và theo dõi trạng thái thanh toán.

---

## 1. Database Schema & Entities

- **Table**: `erp_operating_expenses`
- **Entity**: `ErpOperatingExpense` (`src/operating-expenses-core/entities/erp_operating_expense.entity.ts`)

| Column | Type | Nullable | Description |
| :--- | :--- | :---: | :--- |
| `id` | `uuid` | PK | Khóa chính |
| `expense_no` | `varchar(50)` | No | Mã định danh khoản chi (VD: `EXP-202607-001`) |
| `branch_id` | `uuid` | Yes | Mã chi nhánh |
| `supplier_id` | `uuid` | Yes | Mã nhà cung cấp/đối tác |
| `supplier_name_snapshot` | `varchar(255)` | Yes | Tên đối tác snapshot |
| `expense_category` | `varchar(100)` | Yes | Danh mục chi phí (Chi phí vận hành, v.v.) |
| `title` | `varchar(255)` | Yes | Tiêu đề / Nội dung chi phí |
| `document_date` | `date` | Yes | Ngày phát sinh chi phí |
| `due_date` | `date` | Yes | Hạn thanh toán |
| `total_amount` | `numeric(15,2)` | No | Số tiền chi phí |
| `invoice_status` | `varchar(50)` | Yes | Trạng thái hóa đơn (`REQUIRED`, `NOT_REQUIRED`, `ATTACHED`) |
| `status` | `varchar(50)` | No | Trạng thái khoản chi (`DRAFT`, `CONFIRMED`, `CANCELLED`) |
| `payment_status` | `varchar(50)` | No | Trạng thái thanh toán (`UNPAID`, `PARTIAL`, `PAID`) |
| `recurrence_type` | `varchar(50)` | Yes | Chu kỳ (`ONE_TIME`, `MONTHLY`, `QUARTERLY`, `YEARLY`) |
| `recurrence_interval` | `int` | Yes | Bước nhảy chu kỳ (VD: `1` tháng, `2` tháng) |
| `recurrence_start_date` | `date` | Yes | Ngày bắt đầu chu kỳ |
| `recurrence_end_date` | `date` | Yes | Ngày kết thúc chu kỳ |
| `next_due_date` | `date` | Yes | Ngày đến hạn tiếp theo |
| `auto_generate_next` | `boolean` | Yes | Tự động tạo khoản chi kỳ tiếp theo |
| `notes` | `text` | Yes | Ghi chú |
| `is_deleted` | `boolean` | No | Cờ xóa mềm (default `false`) |

---

## 2. API Endpoints

Base Route: `/api/v1/operating-expenses`

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/column-options` | Lấy danh sách options phân trang distinct cho từng cột (hỗ trợ cross-filter) |
| `GET` | `/` | Lấy danh sách khoản chi có phân trang, bộ lọc đa cột, lọc ngày, sort, tổng tiền aggregate |
| `GET` | `/:id` | Xem chi tiết 1 khoản chi |
| `POST` | `/` | Tạo mới khoản chi phí vận hành |
| `PATCH` | `/:id` | Cập nhật thông tin khoản chi |
| `DELETE`| `/:id` | Xóa mềm khoản chi (`isDeleted = true`) |

---

## 3. Business Logic & Query Rules

1. **Safe Casting**: Do cột `total_amount` có kiểu `numeric`, toàn bộ các phép tìm kiếm (`ILIKE`), so sánh chuỗi rỗng (`!= ''`) và distinct phải được ép kiểu qua `CAST(col AS text)`.
2. **PostgreSQL Aggregate Group By**: Khi tính `totalAmountSum` aggregate toàn bảng, phải dọn sạch mệnh đề `ORDER BY` (`.orderBy()`) để tránh lỗi Postgres `QueryFailedError`.
3. **Multi-Keyword Search & Select All**:
   - Tìm kiếm chính xác qua `"..."` và tìm kiếm nhiều từ khóa qua `;` (OR).
   - Hỗ trợ giá trị đặc biệt `__ALL_MATCHING__` khi người dùng bấm "Chọn tất cả" trên popover cột.
4. **Server-side Sorting**: Hỗ trợ định dạng mảng `sorts[]`, chuỗi đơn `sorts`, hoặc `sortField`/`sortOrder`.
