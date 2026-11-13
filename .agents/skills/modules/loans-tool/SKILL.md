---
name: loans-tool
description: Module tri thức Quản lý Khoản Vay & Dự báo Dòng Tiền Tương Lai (Loans & Cashflow Simulator V2) trong erp-api (v2/core/loans-core và v2/modules/loans). Chứa toàn bộ database schema, entities, TypeORM migration, pure math engine, DTOs, API endpoints (public & RBAC), và quy trình ghi nhận trả nợ an toàn bằng Pessimistic Lock transaction.
---

# 📦 Module Tri Thức: Quản Lý Khoản Vay & Dòng Tiền (`loans`) - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Module `loans-tool` (nằm tại `src/v2/modules/loans-tool/` và kế thừa engine từ `src/v2/core/loans-core/`) cung cấp giải pháp quản trị nợ vay ngân hàng, tính toán lãi suất, lịch khấu hao dòng tiền và dự báo áp lực thanh toán tương lai cho toàn doanh nghiệp.

### 1.1. Các tính năng cốt lõi:
- **Chế độ Kép (Dual Mode)**:
  - **Public Calculator (`/api/v2/public/loans-tool/simulate`)**: Cho phép khách vãng lai hoặc nhân viên tính toán nhanh lịch trả nợ tức thì, không cần đăng nhập.
  - **Authenticated RBAC (`/api/v2/loans-tool-tool`)**: Quản lý lưu trữ hợp đồng vay, lịch sử thanh toán và dự báo dòng tiền doanh nghiệp với quyền kiểm soát `loans:read`, `loans:create`, `loans:update`, `loans:delete`.
- **4 Phương thức Trả Nợ Chuẩn Ngân Hàng**:
  - `AMORTIZED` (Niên kim cố định / gốc + lãi đều): Dùng công thức tài chính quốc tế $A = P \times \frac{r(1+r)^n}{(1+r)^n - 1}$.
  - `EQUAL_PRINCIPAL` (Dư nợ giảm dần / gốc đều): Gốc cố định $P/n$, lãi giảm dần theo dư nợ thực tế.
  - `BULLET` (Cuối kỳ): Hàng kỳ chỉ trả lãi, toàn bộ nợ gốc thanh toán tại kỳ cuối.
  - `FLAT` (Lãi phẳng): Lãi tính cố định theo dư nợ gốc ban đầu.
- **Ghi Nhận Thanh Toán An Toàn (ACID Transaction)**:
  - Sử dụng TypeORM `QueryRunner` với Pessimistic Write Lock (`setLock('pessimistic_write')`) để đảm bảo không bị race condition khi cập nhật `total_paid_principal`, `total_paid_interest` và `remaining_principal`.
  - Tự động chuyển trạng thái khoản vay sang `COMPLETED` khi dư nợ gốc về 0.
- **Dự Báo Dòng Tiền Tương Lai Hợp Nhất (Consolidated Cashflow Projection)**:
  - Endpoint `/api/v2/loans-tool-tool/cashflow-projection` tổng hợp lịch trả nợ tương lai của tất cả hợp đồng `ACTIVE`, nhóm theo từng tháng để lập kế hoạch dòng tiền cho ban giám đốc, kèm mảng `breakdown?: CashflowLoanBreakdownDto[]` chi tiết từng khoản vay cấu thành theo tháng.

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Sơ đồ Quan hệ Bảng (Data Relations)

```text
loans_finance (Hợp đồng vay)
  ├── 1:N ── loan_payments_finance (Lịch sử thanh toán từng kỳ)
  └── N:1 ── erp_business_partners (Đối tác / Ngân hàng liên kết - Optional)
```

### 2.2. Chi tiết Bảng `loans_finance`

| Cột | Kiểu | Mô tả |
| :--- | :--- | :--- |
| `id` | `uuid` | Khóa chính (kế thừa từ `CoreSoftDeletableEntity`) |
| `loan_code` | `varchar(64)` | Mã hợp đồng vay (Unique, Index) |
| `title` | `varchar(255)` | Tên gói vay / Mục đích vay |
| `lender_name` | `varchar(255)` | Tên ngân hàng / Đơn vị cho vay |
| `partner_id` | `uuid` | Khóa ngoại trỏ sang `erp_business_partners` (nullable) |
| `principal_amount` | `numeric(15,2)` | Số tiền vay ban đầu |
| `annual_interest_rate` | `numeric(6,3)` | Lãi suất theo năm (%) |
| `tenor_months` | `int` | Thời hạn vay (tháng) |
| `amortization_method` | `varchar(32)` | `AMORTIZED`, `EQUAL_PRINCIPAL`, `BULLET`, `FLAT` |
| `start_date` | `date` | Ngày bắt đầu tính lãi |
| `first_payment_date` | `date` | Ngày thanh toán kỳ đầu tiên |
| `total_paid_principal` | `numeric(15,2)` | Tổng tiền gốc đã trả |
| `total_paid_interest` | `numeric(15,2)` | Tổng tiền lãi đã trả |
| `remaining_principal` | `numeric(15,2)` | Dư nợ gốc còn lại |
| `status` | `varchar(32)` | `DRAFT`, `ACTIVE`, `COMPLETED`, `OVERDUE` |
| `notes` | `text` | Ghi chú hợp đồng |
| `extra_data` | `jsonb` | Dữ liệu mở rộng chuẩn `CoreBaseEntity` (mặc định `{}`) |
| `created_at` / `updated_at` | `timestamptz` | Audit timestamp |
| `is_deleted` | `boolean` | Cờ xóa mềm (kế thừa từ `CoreSoftDeletableEntity`) |

### 2.3. Chi tiết Bảng `loan_payments_finance`

| Cột | Kiểu | Mô tả |
| :--- | :--- | :--- |
| `id` | `uuid` | Khóa chính |
| `loan_id` | `uuid` | Khóa ngoại trỏ sang `loans_finance` (Cascade delete on soft) |
| `period_number` | `int` | Kỳ thanh toán (1..N) |
| `payment_date` | `date` | Ngày thực hiện thanh toán |
| `principal_paid` | `numeric(15,2)` | Tiền gốc thanh toán |
| `interest_paid` | `numeric(15,2)` | Tiền lãi thanh toán |
| `total_paid` | `numeric(15,2)` | Tổng tiền thanh toán kỳ |
| `payment_ref` | `varchar(100)` | Mã giao dịch / UNC ngân hàng |
| `notes` | `text` | Ghi chú thanh toán |
| `extra_data` | `jsonb` | Dữ liệu mở rộng chuẩn `CoreBaseEntity` (mặc định `{}`) |

---

## 3. Kiến Trúc V2 Module (`erp-api`)

Tuân thủ 100% quy chuẩn `/erp-api-structure`:
- **`src/v2/core/loans-core/`**:
  - `engines/loan-amortization.engine.ts`: Pure TypeScript class không phụ thuộc TypeORM hay NestJS context. 100% co-located unit test.
  - `entities/base-loan.entity.ts`: Kế thừa `CoreSoftDeletableEntity`.
  - `enums/loan-amortization.enum.ts`: `AmortizationMethod`, `LoanStatus`.
  - `interfaces/loan-contract.interface.ts`: Contract type.
- **`src/v2/modules/loans-tool/`**:
  - `constants/loan-table.constants.ts`: Whitelist `TABLE_COLUMNS` (camelCase + snake_case), `SEARCH_COLUMNS`, `SUMMARY_COLUMNS` (`principalAmount`, `totalPaidPrincipal`, `remainingPrincipal`, `totalPaidInterest`) và `toFilterPayload`.
  - `loans.service.ts`: Facade mỏng điều phối, Clean DI constructor; `findAll` bọc qua `toPaginatedResult` trả `{ items, pagination: { page, pageSize, total, totalPages, next, previous }, summaries }`; `findColumnOptions` và `hardDelete` delegate sang sub-services.
  - `services/loan-query.service.ts`: Xử lý phân trang (clamp `1..200`), tìm kiếm đa từ khóa (`applyMultiKeywordMultiFieldFilter`), lọc/sắp xếp chuẩn bảng V2 (`applyTableFilters`, `applyDateBounds`, `applyTableSort` với tie-breaker `loan.id`), tính tổng cột số (`applyListSummaries` trước phân trang), lọc `deleted=only`, gợi ý cột (`findColumnOptions`), lấy chi tiết kèm schedule và dự báo dòng tiền hợp nhất.
  - `services/loan-command.service.ts`: Xử lý tạo, cập nhật (đồng bộ tất cả thông số khoản vay và tự động tính lại `remaining_principal`), xóa mềm (`isDeleted = true`), xóa cứng (`hardDelete`: khóa `pessimistic_write` trong transaction, chặn `409 ConflictException` nếu chưa xóa mềm hoặc còn `loan_payments_finance`) và ghi nhận thanh toán với `QueryRunner` transaction.
  - `helpers/loan.mapper.ts`: Mapper chuyển đổi giữa Entity sang Response DTO (Zero Entity Leaking).
  - `controllers/loans-public.controller.ts`: Endpoint công khai tính toán nhanh.
  - `controllers/loans.controller.ts`: Controller có RBAC guard (`JwtAuthGuard`, `CoreRbacGuard`).

---

## 4. API Endpoints

| Method | Endpoint | Auth | Quyền (RBAC) | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v2/public/loans-tool/simulate` | No | None | Tính toán nhanh lịch khấu hao và KPIs |
| `GET` | `/api/v2/loans-tool` | Yes | `loans:read` | Danh sách khoản vay chuẩn V2 (`{ items, pagination, summaries }`, hỗ trợ `TableQueryDto` + `lenderName` + `deleted=only`) |
| `GET` | `/api/v2/loans-tool/column-options` | Yes | `loans:read` | Gợi ý giá trị lọc theo cột (`{ items, pagination }`, đặt trước `:id`) |
| `GET` | `/api/v2/loans-tool/cashflow/projection` | Yes | `loans:read` | Dòng tiền trả nợ hợp nhất theo tháng (hỗ trợ query `includeAllPeriods=true` để lấy cả kỳ đã trả) |
| `GET` | `/api/v2/loans-tool/:id` | Yes | `loans:read` | Chi tiết hợp đồng vay kèm schedule & payments |
| `POST` | `/api/v2/loans-tool` | Yes | `loans:create` | Tạo mới hợp đồng vay |
| `PATCH` | `/api/v2/loans-tool/:id` | Yes | `loans:update` | Cập nhật hợp đồng vay |
| `DELETE` | `/api/v2/loans-tool/:id` | Yes | `loans:delete` | Xóa mềm hợp đồng vay |
| `DELETE` | `/api/v2/loans-tool/:id/permanent` | Yes | `loans:purge` | Xóa cứng khoản vay đã xóa mềm (chặn 409 nếu còn payment) |
| `POST` | `/api/v2/loans-tool/:id/payments` | Yes | `loans:update` | Ghi nhận thanh toán trả nợ theo kỳ |
| `PATCH` | `/api/v2/loans-tool/:id/payments/:paymentId` | Yes | `loans:update` | Cập nhật bản ghi thanh toán, tự động tính lại dư nợ gốc |
| `DELETE` | `/api/v2/loans-tool/:id/payments/:paymentId` | Yes | `loans:update` | Xóa bản ghi thanh toán, tự động tính lại dư nợ gốc |

---

## 5. Quy Trình Kiểm Thử

```bash
# Typecheck
cd erp/erp-api && bunx tsc --noEmit

# Chạy trọn bộ unit test Jest cho loans
cd erp/erp-api && bunx jest src/v2/core/loans-core src/v2/modules/loans-tool --forceExit

# Quét kiểm tra Clean DI và LoC (< 300 dòng Controller, < 500 dòng Service)
bun .agents/skills/erp-api-structure/scripts/scan-oversized-files.ts --path=src/v2/modules/loans-tool --strict
```

## Hợp đồng phân trang chuẩn v2 (pagination)

- List trả `{ items, pagination, summaries? }`; `pagination` = `{ page, pageSize, total, totalPages, next, previous }` (`next`/`previous` là số trang hoặc `null`). Không còn key phẳng `total`/`page`/`totalPages` ở cấp gốc.
- Column-options trả `{ items: { label, value }[], pagination }`. Dựng bằng `findTableColumnOptions` hoặc `emptyOptionsPage` (`src/common/utils/table-query`).
- Builder: `buildPagination` / `toPagedList` / `toPaginatedResult` (`src/common/utils/paginated-result.ts`). DTO Swagger: `PaginationMetaDto`, `ColumnOptionsResponseDto`.
- Web phải đọc `res.pagination.*`. Xem web `src/v2/shared/utils/v2FetchOptionsAdapter.ts`.
