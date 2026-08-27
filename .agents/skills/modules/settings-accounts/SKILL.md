---
name: settings-accounts
description: Module tri thức Quản lý Hệ thống Tài khoản Kế toán (Settings Accounts / Chart of Accounts) trong erp-api (accounting-core). Chứa toàn bộ database schema (erp_chart_of_accounts), entity, quan hệ cây phân cấp parent-child, DTOs/parameters, API endpoints, logic kiểm tra tính duy nhất, chặn self-parenting, infinite scroll column options và tích hợp hạch toán liên module.
---

# 📚 Module Tri Thức: Hệ Thống Tài Khoản Kế Toán (Settings Accounts / Chart of Accounts) - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Module `settings-accounts` (thuộc phân hệ `accounting-core`) quản lý toàn bộ Hệ thống Tài khoản Kế toán (Chart of Accounts - COA) của doanh nghiệp trên hệ sinh thái Liouni ERP.

Các chức năng nghiệp vụ trọng tâm:
- **Cấu trúc Cây Phân cấp Tài khoản (Parent-Child Account Hierarchy)**: Quản lý các tài khoản kế toán cấp 1, cấp 2, cấp 3... thông qua quan hệ tự tham chiếu (`parent_id`). Hỗ trợ hiển thị phân cấp thụt lề trực quan (`↳`) trên giao diện người dùng.
- **6 Nhóm Tài khoản Kế toán Chuẩn**:
  - `ASSET`: Tài sản (Đầu 1, 2)
  - `LIABILITY`: Nợ phải trả (Đầu 3)
  - `EQUITY`: Vốn chủ sở hữu (Đầu 4)
  - `REVENUE`: Doanh thu (Đầu 5, 7)
  - `EXPENSE`: Chi phí (Đầu 6, 8, 9)
  - `OTHER`: Tài khoản ngoài bảng / Khác
- **Ràng buộc Toàn vẹn Dữ liệu Nghiêm ngặt**:
  - Mã tài khoản (`account_code`) là duy nhất trên toàn hệ thống (không trùng lặp giữa các bản ghi active).
  - Chặn tài khoản tự làm mẹ của chính mình (`parentId !== id`).
- **Tra cứu, Tìm kiếm Đa Chiều & Infinite Scroll Options**:
  - Tìm kiếm tổng hợp qua `search` (mã & tên).
  - Tìm kiếm riêng biệt từng cột (`accountCodeSearch`, `accountNameSearch`, `parentAccountSearch`).
  - Lọc theo danh sách checkbox từng cột, hỗ trợ giá trị `__BLANK__` cho các tài khoản cấp 1 không có tài khoản mẹ.
  - Phân trang infinite scroll options nạp ngầm từ server (`/chart-of-accounts/column-options`).
  - Sắp xếp mặc định tự nhiên ở Backend theo mã tài khoản tăng dần (`coa.accountCode ASC`).
- **Xóa Mềm (Soft Delete)**: Đánh dấu `isDeleted: true` để bảo toàn lịch sử định khoản của các chứng từ, hóa đơn và sổ nhật ký chung đã hạch toán trước đó.

---

## 2. Database Schema & Quan hệ Dữ liệu

### Bảng `erp_chart_of_accounts` (Hệ Thống Tài Khoản Kế Toán)

| Cột | Kiểu dữ liệu | Nullable | Default | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `account_code` | `varchar(50)` | NO | — | Mã tài khoản kế toán (vd: `111`, `1111`, `112`, `331`, `511`, `642`), `UNIQUE INDEX` |
| `account_name` | `varchar(255)` | NO | — | Tên đầy đủ của tài khoản (vd: `Tiền mặt`, `Tiền Việt Nam`, `Phải trả người bán`) |
| `account_type` | `varchar(50)` | NO | `'ASSET'` | Loại tài khoản (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`, `OTHER`) |
| `parent_id` | `uuid` | YES | `NULL` | Khóa ngoại tham chiếu chính `erp_chart_of_accounts(id)` |
| `is_active` | `boolean` | NO | `true` | Trạng thái hoạt động (`true` = Đang hoạt động, `false` = Ngừng hoạt động) |
| `is_deleted` | `boolean` | NO | `false` | Cờ xóa mềm (`true` = Đã xóa) |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo bản ghi |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật bản ghi |

### Sơ đồ Quan hệ Entity (TypeORM):
```text
ErpChartOfAccount (1) ──< (n) ErpChartOfAccount (children, via parent_id)
ErpChartOfAccount (1) ──< (n) ErpJournalEntryLine (lines, via account_id)
```

---

## 3. Cấu trúc Source Code Backend

```text
src/accounting-core/
├── entities/
│   ├── erp_chart_of_account.entity.ts     # TypeORM Entity định nghĩa bảng erp_chart_of_accounts
│   ├── erp_journal_entry.entity.ts        # Entity Sổ nhật ký chung
│   └── erp_journal_entry_line.entity.ts   # Entity Chi tiết dòng định khoản Nợ/Có
├── controllers/
│   └── accounting-core.controller.ts      # Controller định nghĩa các routes CRUD & column-options
├── services/
│   └── accounting-core.service.ts         # Service xử lý query, filter, validation, uniqueness check & soft delete
└── accounting-core.module.ts              # NestJS Module đăng ký TypeOrmModule, Controllers, Services
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/accounting-core`

| Method | Endpoint | Tham số / Body | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/accounting-core/chart-of-accounts` | Query: `page`, `pageSize`, `search`, `accountCodeSearch`, `accountNameSearch`, `parentAccountSearch`, `accountCode`, `accountName`, `parentAccount`, `accountType`, `isActive`, `sort` | Lấy danh sách tài khoản phân trang, hỗ trợ đa lọc, tìm kiếm và dynamic sorting (default `coa.accountCode ASC`) |
| `GET` | `/api/v1/accounting-core/chart-of-accounts/column-options` | Query: `column`, `search`, `page`, `pageSize`, `filters` | Lấy danh sách distinct options phân trang infinite scroll theo từng cột (`accountCode`, `accountName`, `parentAccount`, `accountType`) |
| `GET` | `/api/v1/accounting-core/chart-of-accounts/:id` | Param: `id` (UUID) | Lấy chi tiết một tài khoản kế toán kèm thông tin tài khoản mẹ (`parent`) |
| `POST` | `/api/v1/accounting-core/chart-of-accounts` | Body: `{ accountCode, accountName, accountType, parentId, isActive }` | Tạo mới tài khoản kế toán (kiểm tra bắt buộc và tính duy nhất của mã) |
| `PATCH` | `/api/v1/accounting-core/chart-of-accounts/:id` | Param: `id`, Body: `{ accountCode?, accountName?, accountType?, parentId?, isActive? }` | Cập nhật thông tin tài khoản (chặn trùng mã và chặn `parentId === id`) |
| `DELETE` | `/api/v1/accounting-core/chart-of-accounts/:id` | Param: `id` (UUID) | Xóa mềm tài khoản kế toán (`isDeleted = true`) |

---

## 5. Logic Nghiệp vụ Trọng tâm

### 5.1. Validation & Uniqueness Check
- Khi tạo mới:
  - Bắt buộc phải có `accountCode` và `accountName` (cắt bỏ khoảng trắng thừa `.trim()`).
  - Kiểm tra trong DB: `findOne({ where: { accountCode: code, isDeleted: false } })`. Nếu tồn tại $\to$ ném lỗi `BadRequestException("Mã tài khoản đã tồn tại...")`.
- Khi cập nhật:
  - Nếu đổi `accountCode` sang mã mới $\to$ kiểm tra mã mới không được trùng với bất kỳ tài khoản nào khác (`existing.id !== id`).
  - Chặn tài khoản tự chọn chính mình làm tài khoản mẹ: `newParentId === id` $\to$ ném lỗi `BadRequestException("Tài khoản không thể tự làm tài khoản mẹ của chính mình")`.

### 5.2. Query & Server-Side Filtering Đa Chiều
Service hỗ trợ kết hợp đồng thời nhiều tầng lọc:
1. **Tìm kiếm tổng thể (`search`)**:
   `coa.accountCode ILIKE :search OR coa.accountName ILIKE :search`
2. **Tìm kiếm theo từng cột**:
   - `accountCodeSearch`: `coa.accountCode ILIKE :codeSearch`
   - `accountNameSearch`: `coa.accountName ILIKE :nameSearch`
   - `parentAccountSearch`: `parent.accountCode ILIKE :parentSearch OR parent.accountName ILIKE :parentSearch`
3. **Lọc theo danh mục Checkbox Options**:
   - `accountCode`: `coa.accountCode IN (:...accountCodes)`
   - `accountName`: `coa.accountName IN (:...accountNames)`
   - `parentAccount`: Xử lý giá trị `__BLANK__` (các tài khoản cấp 1 có `parentId IS NULL`) kết hợp danh sách mã/ID tài khoản mẹ đã chọn.
   - `accountType`: `coa.accountType IN (:...accountTypes)`
   - `isActive`: `coa.isActive = :isActive`

### 5.3. Sắp xếp Mặc định ở Backend (Backend Default Sort)
- Khi Frontend không truyền tham số `sort` (hoặc truyền rỗng), Backend luôn tự động sắp xếp theo mã tài khoản tăng dần:
  ```typescript
  qb.orderBy('coa.accountCode', 'ASC');
  ```
- Giúp dữ liệu luôn hiển thị ngăn nắp theo hệ thống tài khoản kế toán mà không làm hiển thị biểu tượng sort cưỡng chế trên giao diện Frontend.

---

## 6. Tích hợp Liên Module

- **Sổ cái & Nhật ký chung (`general-journal` / `erp_journal_entries`)**: Mỗi dòng bút toán (`erp_journal_entry_lines`) liên kết khóa ngoại tới `erp_chart_of_accounts(id)`.
- **Sao kê Ngân hàng & Sổ quỹ (`bank-statement`)**: Dùng danh mục tài khoản để định khoản tự động các khoản thu/chi (TK 111, TK 112, TK 131, TK 331...).
- **Hóa đơn Điện tử & Thuế (`erp-invoice`)**: Hạch toán thuế GTGT đầu vào/ra (TK 133, TK 3331), doanh thu bán hàng (TK 511), chi phí giá vốn (TK 632).

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng

Khi sửa đổi module `settings-accounts`:
- **Backend Build & TypeCheck**:
  ```bash
  cd ./erp-api
  bun run build
  ```
- **Backend Unit Tests**:
  ```bash
  bunx jest --forceExit
  ```
- **Frontend Unit Tests**:
  ```bash
  cd ./erp-web
  bunx vitest --run src/pages/finance/__tests__/ChartOfAccountsPage.test.tsx
  ```
