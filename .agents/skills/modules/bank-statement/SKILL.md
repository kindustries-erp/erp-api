---
name: bank-statement
description: Module tri thức Quản lý Sao kê Ngân hàng & Sổ quỹ Tiền mặt (Bank Statements & Cash Books) trong erp-api (bank-transactions-core). Chứa toàn bộ database schema, entities, DTOs, API endpoints, logic import/parser sao kê BIDV/TCB/Sổ quỹ, đối soát, định khoản và hạch toán kế toán.
---

# 📦 Module Tri Thức: Sao Kê Ngân Hàng & Sổ Quỹ Tiền Mặt (`bank-statement`) - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Module `bank-statement` (đặt tại `src/bank-transactions-core/`) là trung tâm quản trị toàn bộ dòng tiền vật lý (tiền gửi ngân hàng và tiền mặt tại quỹ) của doanh nghiệp trong Liouni ERP.

### 1.1. Các tính năng cốt lõi:
- **Quản lý Master Data Tài khoản & Sổ quỹ**:
  - Quản lý danh mục Tài khoản Ngân hàng (`erp_bank_accounts`) và Sổ Quỹ Tiền mặt (`erp_cash_books`) theo từng Chi nhánh (`branch_id`).
  - Quản lý số dư đầu kỳ (`erp_bank_account_balances`, `erp_cash_book_balances`) theo mốc thời gian (`period_date`).
  - Lưu vết chứng từ file sao kê gốc (`erp_bank_statement_files`).
- **Import & Parser Sao kê Tự động**:
  - Hỗ trợ đa dạng ngân hàng: BIDV (Excel `.xlsx`), Techcombank (CSV / Excel `.xlsx`), Sổ quỹ tiền mặt nội bộ (Excel `.xlsx`).
  - Thuật toán nhận diện trùng lặp thông minh (Deduplication) theo Số tham chiếu (`referenceNumber`) hoặc bộ 4 thông số (`transDate` + `debit` + `credit` + `description`).
  - Hỗ trợ cơ chế Rollback theo lô (`importBatchId`).
- **Quản lý Sổ giao dịch Dòng tiền (`erp_bank_transactions`)**:
  - Phân loại rõ `sourceType`: `'BANK'` hoặc `'CASH'`.
  - Phân loại luồng tiền: `IN` (Tiền vào / `creditAmount`) vs `OUT` (Tiền ra / `debitAmount`).
  - Gắn nhãn phân loại chi phí/thu nhập (`sys_entity_tags`).
- **Đối soát & Định khoản Kế toán Kép (Double-entry Posting & Zero-Accounting UX)**:
  - Hạch toán trực tiếp sang Sổ Nhật ký Chung (`erp_journal_entries` & `erp_journal_entry_lines`).
  - **Tài khoản Treo Mặc định `T0001`**: Mọi giao dịch sao kê ngân hàng / tiền mặt khi chưa có tài khoản đối ứng cụ thể sẽ tự động dùng tài khoản treo `T0001` (hoặc alias `0001`).
  - **Tự động Chuyển Đổi Đối ứng khi Cấn trừ (Smart Net-Off Accounting)**:
    - Khi cấn trừ với Hóa đơn Mua vào (`IN`): Chiều đối ứng `T0001` tự động biến đổi thành `331` (Phải trả NCC).
    - Khi cấn trừ với Hóa đơn Bán ra (`OUT`): Chiều đối ứng `T0001` tự động biến đổi thành `131` (Phải thu KH).
    - Khi tháo gỡ cấn trừ: Chiều đối ứng tự động hoàn nguyên về `T0001`.
    - Phần tiền còn lại (nếu có): Tiếp tục treo ở `T0001`.
  - **Guard An Toàn `ENABLE_LIVE_AUTO_POSTING`**: Hệ thống kiểm tra biến môi trường; nếu chưa bật và giao dịch chưa từng có bút toán trước đó, hệ thống sẽ không tự tiện ghi live vào Nhật ký chung nhằm phục vụ an toàn trong giai đoạn backfill số liệu lịch sử.

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Sơ đồ Quan hệ Bảng (Data Relations)

```text
erp_branches (Chi nhánh)
  ├── 1:N ── erp_bank_accounts (Tài khoản ngân hàng)
  │            ├── 1:N ── erp_bank_account_balances (Số dư đầu kỳ)
  │            └── 1:N ── erp_bank_transactions (Giao dịch ngân hàng)
  └── 1:N ── erp_cash_books (Sổ quỹ tiền mặt)
               ├── 1:N ── erp_cash_book_balances (Số dư đầu kỳ quỹ)
               └── 1:N ── erp_bank_transactions (Giao dịch tiền mặt)

erp_bank_transactions (Sổ giao dịch dòng tiền)
  ├── N:1 ── erp_chart_of_accounts (Tài khoản kế toán đối ứng)
  ├── 1:N ── erp_invoice_voucher_netoff (Cấn trừ hóa đơn VAT)
  └── 1:N ── sys_entity_tags (Tag phân loại dòng tiền)
```

### 2.2. Chi tiết các Bảng Database:

#### A. Bảng `erp_bank_accounts` (Tài khoản ngân hàng doanh nghiệp)
| Tên Cột | Kiểu Dữ Liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PK`, `default: gen_random_uuid()` | Khóa chính |
| `branch_id` | `uuid` | `FK -> erp_branches(id)`, `NOT NULL` | Chi nhánh sở hữu |
| `accounting_account_id` | `uuid` | `FK -> erp_chart_of_accounts(id)`, `NULL` | Tài khoản hạch toán mặc định (vd: 1121) |
| `bank_code` | `varchar(50)` | `NOT NULL` | Mã ngân hàng (vd: `BIDV`, `TCB`, `VCB`) |
| `bank_name` | `varchar(255)` | `NOT NULL` | Tên ngân hàng đầy đủ |
| `account_number`| `varchar(50)` | `NOT NULL` | Số tài khoản ngân hàng |
| `account_name` | `varchar(255)` | `NOT NULL` | Tên chủ tài khoản |
| `currency` | `varchar(10)` | `default: 'VND'` | Loại tiền tệ |
| `is_active` | `boolean` | `default: true` | Trạng thái hoạt động |
| `is_deleted` | `boolean` | `default: false` | Cờ xóa mềm |
| `created_at` / `updated_at` | `timestamp` | `NOT NULL` | Thời gian tạo/cập nhật |

#### B. Bảng `erp_cash_books` (Sổ quỹ tiền mặt)
| Tên Cột | Kiểu Dữ Liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PK`, `default: gen_random_uuid()` | Khóa chính |
| `branch_id` | `uuid` | `FK -> erp_branches(id)`, `NOT NULL` | Chi nhánh sở hữu |
| `accounting_account_id` | `uuid` | `FK -> erp_chart_of_accounts(id)`, `NULL` | Tài khoản hạch toán mặc định (vd: 1111) |
| `name` | `varchar(255)` | `NOT NULL` | Tên sổ quỹ tiền mặt (vd: Quỹ tiền mặt VP Chính) |
| `currency` | `varchar(10)` | `default: 'VND'` | Tiền tệ |
| `is_active` | `boolean` | `default: true` | Trạng thái hoạt động |
| `is_deleted` | `boolean` | `default: false` | Cờ xóa mềm |

#### C. Bảng `erp_bank_transactions` (Sổ nhật ký giao dịch Ngân hàng & Tiền mặt)
| Tên Cột | Kiểu Dữ Liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PK`, `default: gen_random_uuid()` | Khóa chính |
| `source_type` | `varchar(10)` | `NOT NULL` (`'BANK'` \| `'CASH'`) | Nguồn giao dịch |
| `bank_account_id` | `uuid` | `FK -> erp_bank_accounts(id)`, `NULL` | Khóa ngoại tài khoản ngân hàng |
| `cash_book_id` | `uuid` | `FK -> erp_cash_books(id)`, `NULL` | Khóa ngoại sổ quỹ tiền mặt |
| `branch_id` | `uuid` | `FK -> erp_branches(id)`, `NOT NULL` | Chi nhánh |
| `stt` | `int` | `NULL` | Số thứ tự dòng trên sao kê gốc |
| `trans_date` | `timestamp` | `NOT NULL` | Ngày giờ phát sinh giao dịch |
| `efd_date` | `timestamp` | `NULL` | Ngày hiệu lực (Effective Date) |
| `reference_number` | `varchar(255)` | `NULL` | Số tham chiếu / Mã giao dịch ngân hàng (FT, Ref) |
| `debit_amount` | `numeric(18,4)`| `default: 0` | Số tiền Ghi Nợ (Tiền chi ra khỏi tài khoản) |
| `credit_amount`| `numeric(18,4)`| `default: 0` | Số tiền Ghi Có (Tiền thu vào tài khoản) |
| `balance` | `numeric(18,4)`| `NULL` | Số dư lũy kế tại thời điểm giao dịch |
| `seq_no` | `varchar(255)` | `NULL` | Mã định danh trình tự (Sequence Number) |
| `description` | `text` | `NULL` | Nội dung chuyển khoản trên sao kê gốc |
| `accounting_description`| `text` | `NULL` | Diễn giải nghiệp vụ kế toán |
| `correspondent_account`| `varchar(255)` | `NULL` | Số tài khoản đối ứng (bên gửi/nhận) |
| `correspondent_name` | `varchar(255)` | `NULL` | Tên đối tác / Người thụ hưởng đối ứng |
| `correspondent_bank` | `varchar(255)` | `NULL` | Ngân hàng của đối tác |
| `correspondent_accounting_account_id` | `uuid` | `FK -> erp_chart_of_accounts(id)`, `NULL` | Tài khoản kế toán đối ứng (vd: 331, 131) |
| `category_id` | `uuid` | `FK -> erp_module_categories(id)`, `NULL` | Danh mục phân loại giao dịch (`module_key = 'BANK_TXN'`) |
| `import_batch_id` | `varchar(50)` | `NULL` | Mã UUID của đợt upload file sao kê |
| `is_deleted` | `boolean` | `default: false` | Cờ xóa mềm (hoặc khi rollback batch) |

#### D. Bảng `erp_bank_statement_files` & `erp_bank_account_balances` / `erp_cash_book_balances`
- `erp_bank_statement_files`: Lưu vết file tải lên (`branch_id`, `bank_account_id`, `cash_book_id`, `period_date`, `file_id`, `note`).
- `erp_bank_account_balances` / `erp_cash_book_balances`: Lưu số dư đầu kỳ (`period_date`, `opening_balance`, `currency`, `note`).

---

## 3. Cấu trúc Source Code Backend (`erp-api`)

```text
src/bank-transactions-core/
├── dto/
│   ├── bank-transaction-filter.dto.ts      # DTO lọc đa chiều, tìm kiếm cột, phân trang, sort
│   ├── create-bank-account.dto.ts          # DTO tạo/sửa tài khoản ngân hàng
│   ├── create-cash-book.dto.ts             # DTO tạo/sửa sổ quỹ tiền mặt
│   ├── create-bank-transaction.dto.ts      # DTO tạo giao dịch thủ công
│   ├── update-bank-transaction.dto.ts      # DTO cập nhật thông tin giao dịch
│   ├── post-bank-transaction.dto.ts        # DTO hạch toán kế toán (các dòng Nợ/Có)
│   ├── create-bank-account-balance.dto.ts  # DTO số dư tài khoản ngân hàng
│   ├── create-cash-book-balance.dto.ts     # DTO số dư sổ quỹ tiền mặt
│   └── create-bank-statement-file.dto.ts   # DTO lưu vết file sao kê
├── entities/
│   ├── erp_bank_account.entity.ts
│   ├── erp_bank_account_balance.entity.ts
│   ├── erp_cash_book.entity.ts
│   ├── erp_cash_book_balance.entity.ts
│   ├── erp_bank_statement_file.entity.ts
│   └── erp_bank_transaction.entity.ts
├── parsers/
│   ├── bidv.parser.ts                      # Parser file Excel sao kê BIDV
│   ├── tcb.parser.ts                       # Parser file CSV/Excel sao kê Techcombank
│   ├── cash.parser.ts                      # Parser file Excel sổ quỹ tiền mặt
│   └── date-parser.ts                      # Tiện ích chuẩn hoá định dạng ngày
├── services/
│   ├── bank-account-lifecycle.service.ts   # Quản trị vòng đời tài khoản ngân hàng
│   ├── cash-book-lifecycle.service.ts      # Quản trị vòng đời sổ quỹ tiền mặt
│   ├── balance-statement-lifecycle.service.ts # Quản lý số dư đầu kỳ & file sao kê
│   ├── transaction-import.service.ts       # Xử lý upload file, parser, deduplicate & rollback
│   ├── transaction-query.service.ts        # Truy vấn danh sách, chi tiết, filter dropdown options
│   ├── transaction-accounting.service.ts   # Hạch toán kế toán kép, kiểm tra cân đối Nợ/Có
│   └── transaction-analytics.service.ts    # Thống kê báo cáo đối tác & KPI Dashboard
├── bank-transactions-core.controller.ts    # REST API Controller
├── bank-transactions-core.service.ts       # Facade Service điều phối các service chuyên biệt
└── bank-transactions-core.module.ts        # NestJS Module đăng ký providers & entities
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Base Path: `/api/v1/bank-transactions-core`  
Guards: `JwtAuthGuard`, `CoreRbacGuard`

| Phân nhóm | Method | Endpoint | Quyền yêu cầu | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| **Bank Accounts** | `GET` | `/bank-accounts` | `{ resource: 'bank_statements', action: 'read' }` | Danh sách tài khoản ngân hàng (kèm lọc chi nhánh) |
| | `POST` | `/bank-accounts` | `{ resource: 'bank_statements', action: 'create' }` | Tạo mới tài khoản ngân hàng |
| | `PATCH`| `/bank-accounts/:id` | `{ resource: 'bank_statements', action: 'update' }` | Cập nhật thông tin tài khoản |
| | `DELETE`| `/bank-accounts/:id` | `{ resource: 'bank_statements', action: 'delete' }` | Xóa mềm tài khoản ngân hàng |
| **Cash Books** | `GET` | `/cash-books` | `{ resource: 'cash_statements', action: 'read' }` | Danh sách sổ quỹ tiền mặt |
| | `POST` | `/cash-books` | `{ resource: 'cash_statements', action: 'create' }` | Tạo mới sổ quỹ tiền mặt |
| | `PATCH`| `/cash-books/:id` | `{ resource: 'cash_statements', action: 'update' }` | Cập nhật sổ quỹ |
| | `DELETE`| `/cash-books/:id` | `{ resource: 'cash_statements', action: 'delete' }` | Xóa mềm sổ quỹ |
| **Transactions** | `GET` | `/transactions` | `bank_statements` OR `cash_statements` (`read`) | Danh sách giao dịch (hỗ trợ phân trang, lọc đa cột) |
| | `GET` | `/transactions/:id` | `bank_statements` OR `cash_statements` (`read`) | Chi tiết giao dịch (kèm trạng thái hạch toán & cấn trừ) |
| | `GET` | `/transactions/:id/traceability-graph` | `bank_statements` OR `cash_statements` (`read`) | Lấy đồ thị mạng lưới chứng từ liên kết đa tầng kèm Zero-Trust RBAC mask |
| | `GET` | `/transactions/:id/posting` | `bank_statements` OR `cash_statements` (`read`) | Lấy thông tin bút toán kế toán hiện thời |
| | `POST` | `/transactions/:id/net-off-invoices` | `bank_statements` OR `cash_statements` (`update`) | Ghép nối cấn trừ hóa đơn vào giao dịch ngân hàng |
| | `DELETE`| `/transactions/:id/net-off-invoices/:netOffId` | `bank_statements` OR `cash_statements` (`update`) | Gỡ bỏ liên kết cấn trừ hóa đơn |
| | `GET` | `/transactions/column-options` | `bank_statements` OR `cash_statements` (`read`) | Lấy danh sách options duy nhất cho bộ lọc dropdown |
| | `POST` | `/transactions/manual` | `bank_statements` OR `cash_statements` (`create`) | Tạo giao dịch thu/chi thủ công |
| | `PATCH`| `/transactions/:id` | `bank_statements` OR `cash_statements` (`update`) | Cập nhật ghi chú/thông tin đối tác giao dịch |
| | `POST` | `/transactions/:id/post` | `bank_statements` OR `cash_statements` (`update`) | Hạch toán ghi nhận bút toán kế toán |
| | `POST` | `/transactions/:id/unpost` | `bank_statements` OR `cash_statements` (`update`) | Hủy hạch toán bút toán kế toán |
| | `POST` | `/transactions/import` | `bank_statements` OR `cash_statements` (`create`) | Upload file sao kê (Multipart: tối đa 5 file .csv/.xlsx) |
| | `DELETE`| `/transactions/batch/:batchId` | `bank_statements` OR `cash_statements` (`delete`) | Rollback (xóa) toàn bộ giao dịch theo lô import |
| **Balances** | `GET` | `/bank-account-balances` | `{ resource: 'bank_statements', action: 'read' }` | Danh sách số dư đầu kỳ tài khoản ngân hàng |
| | `POST` | `/bank-account-balances` | `{ resource: 'bank_statements', action: 'create' }` | Thiết lập số dư đầu kỳ tài khoản ngân hàng |
| | `GET` | `/cash-book-balances` | `{ resource: 'cash_statements', action: 'read' }` | Danh sách số dư đầu kỳ sổ quỹ |
| | `POST` | `/cash-book-balances` | `{ resource: 'cash_statements', action: 'create' }` | Thiết lập số dư đầu kỳ sổ quỹ |
| **Statement Files** | `GET` | `/statement-files` | `bank_statements` OR `cash_statements` (`read`) | Danh sách file sao kê đã tải lên |
| | `POST` | `/statement-files` | `bank_statements` OR `cash_statements` (`create`) | Ghi nhận metadata file sao kê |
| | `DELETE`| `/statement-files/:id` | `bank_statements` OR `cash_statements` (`delete`) | Xóa file sao kê |

---

## 5. Logic Nghiệp vụ & Thuật toán Trọng tâm

### 5.1. Thuật toán Xử lý Deduplication khi Import Sao kê (`TransactionImportService`)
1. Quét file người dùng upload (`.csv` hoặc `.xlsx`) qua parser tương ứng (BIDV, TCB, hoặc Quỹ tiền mặt).
2. Xác định khung thời gian của các giao dịch trong file: $[\min(\text{transDate}) - 2\text{ ngày}, \max(\text{transDate}) + 2\text{ ngày}]$.
3. Truy vấn các giao dịch hiện có trong DB trong khoảng thời gian hoặc có cùng `referenceNumber`.
4. Sinh khóa định danh giao dịch (Unique Fingerprint Key):
   - Nếu có `referenceNumber`: $\text{Key} = \text{"REF\_"} + \text{referenceNumber}$.
   - Nếu không có: $\text{Key} = \text{transDate (ISO)} + \text{"\_"} + \text{debitAmount} + \text{"\_"} + \text{creditAmount} + \text{"\_"} + \text{description.trim()}$.
5. So sánh từng bản ghi:
   - Nếu chưa có: Thêm vào danh sách tạo mới (`newDtos`).
   - Nếu đã có và có trường dữ liệu thay đổi (số dư, ngày hiệu lực, đối tác): Cập nhật bản ghi (`updateEntities`).
   - Nếu trùng khớp hoàn toàn: Tăng biến đếm bỏ qua (`skippedCount`).
6. Gán `importBatchId = randomUUID()` cho toàn bộ các bản ghi tạo mới để phục vụ tính năng Rollback khi cần.

### 5.2. Nguyên tắc Hạch toán Kế toán Kép (`TransactionAccountingService`)
- Khi người dùng thực hiện `POST /transactions/:id/post`:
  1. Kiểm tra chi nhánh (`branchId`) và tính hợp lệ của từng dòng định khoản.
  2. Bắt buộc mỗi dòng chỉ được có `debit > 0` HOẶC `credit > 0` (không được đồng thời cả 2 hoặc âm).
  3. Kiểm tra tính cân đối tổng thể:
     $$|\sum \text{debit} - \sum \text{credit}| < 0.01$$
  4. Tạo hoặc cập nhật chứng từ `erp_journal_entries` với mã tham chiếu nguồn `sourceId = txn.id`, `sourceType = 'BANK'` hoặc `'CASH'`.

### 5.3. Thuật toán Bộ Lọc Nâng Cao & Xử Lý Giá Trị Trống (`TransactionQueryService`)
- **Lọc Khoảng Ngày Múi Giờ Việt Nam (Timezone-Aware Date Range Filter)**:
  - Do `trans_date` trong database PostgreSQL lưu theo mốc UTC, khi lọc theo khoảng ngày (`startDate` - `endDate`), hệ thống áp dụng chuyển đổi múi giờ chuẩn trong SQL:
    ```sql
    (txn.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= :startDate::date
    AND
    (txn.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= :endDate::date
    ```
  - Đảm bảo các giao dịch diễn ra rạng sáng đầu tháng tiếp theo theo giờ Việt Nam không bị lọt nhầm vào tháng trước do sai lệch múi giờ UTC/GMT+7.
- **Tìm kiếm đa từ khóa & khớp chính xác (`applyMultiKeywordFilter`)**:
  - Dấu chấm phẩy `;`: Tách thành nhiều từ khóa và áp dụng điều kiện `OR` (ví dụ: `BIDV;TCB`).
  - Dấu ngoặc kép `"..."`: Tìm kiếm chính xác từng ký tự (Exact match với `op = '='` hoặc `ILIKE 'text'`), không gắn wildcard `%`.
  - Hỗ trợ tìm kiếm trên các trường số (bỏ qua dấu chấm phẩy phân cách phần nghìn `,` / `.`).
- **Lọc theo giá trị trống `(blank)` (`__BLANK__`)**:
  - Khi `vals` chứa `'__BLANK__'`: Sinh điều kiện `(field IN (:...realVals) OR field IS NULL OR CAST(field AS TEXT) = '')`.
  - Riêng trường Đối tượng HĐ (`invoiceSubject`): Áp dụng `NOT EXISTS (SELECT 1 FROM erp_invoice_voucher_netoff ...)` để tra cứu các giao dịch chưa từng cấn trừ hóa đơn.

### 5.4. Xuất Báo Cáo Excel Ngầm & SSE Realtime Stream (`BankStatementExportBackgroundService`)
- **Kiến trúc Chạy Nền (Non-blocking Background Jobs)**:
  - Xử lý xuất báo cáo Excel sao kê ngân hàng và sổ quỹ tiền mặt dưới nền mà không làm nghẽn Event Loop.
  - Tự động kiểm tra trùng lặp bộ lọc (Deduplication / Reused): Nếu cùng một người dùng yêu cầu xuất cùng bộ lọc trong vòng 24 giờ và file vẫn còn hạn trong bộ nhớ đệm, hệ thống trả về ngay file có sẵn (`reused: true`).
- **Đặt Tên File Thông Minh Theo Số Tài Khoản / Tên Sổ Quỹ**:
  - Khi xuất tài khoản ngân hàng cụ thể: `Sao_ke_[SoTaiKhoan]_[YYYYMMDD_HHmm].xlsx` (vd: `Sao_ke_0391000123456_20260826_1815.xlsx`).
  - Khi xuất tất cả tài khoản ngân hàng: `Sao_ke_tat_ca_tai_khoan_[YYYYMMDD_HHmm].xlsx`.
  - Khi xuất sổ quỹ tiền mặt cụ thể: `So_quy_[TenSoQuy]_[YYYYMMDD_HHmm].xlsx`.
  - Khi xuất tất cả sổ quỹ: `So_quy_tat_ca_[YYYYMMDD_HHmm].xlsx`.
- **API Endpoints Xuất Excel**:
  - `POST /api/v1/bank-transactions-core/export/excel/background`: Khởi tạo tiến trình xuất ngầm.
  - `GET /api/v1/bank-transactions-core/export/excel/background/history`: Lấy danh sách lịch sử các file đã xuất theo phân trang.
  - `GET /api/v1/bank-transactions-core/export/excel/background/:jobId/download`: Tải file `.xlsx` trực tiếp theo jobId.
  - `GET /api/v1/bank-transactions-core/export/excel/progress/stream`: Server-Sent Events (SSE) phát tiến độ `0% -> 100%`, trạng thái `ready` và tên file cho client tự động tải xuống.

---

## 6. Tích hợp Liên Module

- **`accounting-core`**: Đồng bộ định khoản sổ cái kế toán, kế thừa danh mục hệ thống tài khoản (`erp_chart_of_accounts`) và ghi nhận `erp_journal_entries`.
- **`erp-invoices-core`**: Đối soát và ghi nhận thanh toán cấn trừ công nợ hóa đơn (`erp_invoice_voucher_netoff`).
- **`cashflow-dashboard` & `dashboard-core`**: Cung cấp dữ liệu nền tảng cho báo cáo dòng tiền, phân bổ đối tác, dự báo dòng tiền và gợi ý ngân sách tự động.
- **`tags-core`**: Gán tag phân loại doanh thu/chi phí đa chiều (`sys_tags`, `sys_entity_tags`).
- **`module-config`**: Quản lý danh mục phân loại (`category_id`) và các trường thuộc tính tùy chỉnh động (`erp_entity_attribute_values` với `entity_type = 'BANK_TXN'`). Cấu hình qua Action Dropdown trang Sao kê / menu Thiết lập chung và hiển thị/chọn tại cột phải trong Drawer Chi tiết giao dịch.

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

1. **TypeCheck**: Chạy `bun run check:ci` trong thư mục `erp-api/`.
2. **Unit Tests**:
   - `bunx jest src/bank-transactions-core/bank-transactions-core.facade.spec.ts`
   - `bunx jest src/bank-transactions-core/services/transaction-accounting.service.spec.ts`
   - `bunx jest src/bank-transactions-core/services/transaction-query.service.spec.ts`
3. **Database Integrity**: Đảm bảo trường `debit_amount` và `credit_amount` luôn được lưu với kiểu `numeric(18,4)` để tránh sai số làm tròn tiền tệ.

---

## 8. Frontend UI (`erp-web`) — Chuẩn Thiết Kế Mới

> Phân hệ này đã được refactor theo chuẩn **Atomic Module** và tích hợp hai tính năng mới:

### 8.1. Switch nhanh Thu / Chi (`PillTabs` trong `customActionsNode`)
- Component: `BankStatementsTab.tsx` → `customActionsNode` truyền vào `SpreadsheetPageTemplate`.
- Ba trạng thái: **Tất cả** (`activeTransactionType = "ALL"`) / **Thu** (`"IN"`) / **Chi** (`"OUT"`).
- Khi chọn, hook `useBankStatementsTabLogic.tsx` gọi `bankStatementApi.getTransactions({ transactionType: "IN" | "OUT" })` tương ứng với field **`transactionType?: 'IN' | 'OUT'`** trong `BankTransactionFilterDto` (backend).
- Đồng bộ URL param `?txnType=IN|OUT` qua `usePageUrlState`.

### 8.2. Chế độ xem Cột linh hoạt (ViewMode Presets)
- Hai preset chuẩn (không xóa được, có thể Khôi phục mặc định):
  - **`overview` — "Tổng quan"**: Cột hiển thị: `index`, `account`, `transDate`, `referenceNumber`, `description`, `thu`, `chi`, `balance`, `branch`.
  - **`audit` — "Kiểm toán / Đối soát"**: Cột hiển thị: `index`, `account`, `transDate`, `referenceNumber`, `correspondentName`, `invoiceSubject`, `thu`, `chi`, `netOffAmount`, `remainingAmount`, `branch`.
- Người dùng có thể **tạo Custom View** mới (đặt tên, chọn bật/tắt từng cột theo 4 nhóm), lưu vào `core_user_preferences`.

### 8.3. Cấu trúc Module Atomic (`src/modules/bank-statements/`)
```text
src/modules/bank-statements/components/BankStatementsTab/
├── utils.ts                                     # Preset configs, column groups, default visibility
├── useBankStatementsTabLogic.tsx                # Orchestrator Hook (state, query, URL sync)
├── BankStatementsTab.tsx                        # Main view (SpreadsheetPageTemplate + PillTabs)
├── index.tsx                                    # Re-export entry
├── components/
│   ├── BankStatementColumns.tsx                 # 15+ column definitions với createColumnHeaderFilter
│   ├── BankStatementViewModeCombobox.tsx         # Dropdown chọn / quản lý View Preset
│   ├── BankStatementViewConfigDrawer.tsx         # Drawer cấu hình cột theo nhóm
│   └── BankStatementDrawers.tsx                 # Gom cụm 6 drawers chức năng
└── __tests__/
    └── BankStatementViewModeCombobox.test.tsx    # Unit tests ViewModeCombobox (3 tests)
```

### 8.4. Chuẩn Hóa Cột Bảng & Infinite Scroll (`BankStatementColumns.tsx`)
- Toàn bộ cột bảng được xây dựng thông qua **`createColumnHeaderFilter`**:
  - Cột Ngày: `headerFilter.date("transDate", ...)`
  - Cột Số tiền / Số dư: `headerFilter.amount("thu" | "chi" | "balance", ...)`
  - Cột Phân loại Cấn trừ: `headerFilter.client("netOffAmount" | "remainingAmount", ...)`
  - Cột Tra cứu danh mục: `headerFilter("account" | "referenceNumber" | "description" | "branch" ..., { showBlankOption: true })`
- **Hợp đồng Phân trang Vô tận (Infinite Scrolling Contract)**:
  - `fetchOptions` mapping `next: res.page < res.totalPages ? res.page + 1 : null` để `useInfiniteQuery` cuộn tải liên tục mượt mà.
  - Hỗ trợ cú pháp lọc `__ALL_MATCHING__` (Chọn tất cả kết quả tìm kiếm) và `__BLANK__` (Lọc giá trị trống).

### 8.5. Detail Drawer & Kiến Trúc 3 Tầng (`BankTransactionDetailDrawer`)
- **Quản lý Cập nhật Giao dịch**:
  - Cho phép chỉnh sửa Chi nhánh (`branchId` qua `Combobox`) và Ghi chú / Diễn giải (`description` qua `BufferedTextarea` debounce 500ms).
  - Tự động lưu qua `bankStatementApi.updateTransaction(transactionId, { branchId, description, accountingDescription })`.
- **Cấu trúc Cột Phải (Right Panel) 3 Tầng Chuẩn Hóa**:
  1. **Tầng 1 — `THÔNG TIN CHUNG` (`BankTransactionGeneralInfoSection`)**:
     - View mode: Icon `<Building2>` (Đối tác), `<MapPin>` (Chi nhánh kèm tên tường minh), `<CreditCard>` (Tài khoản nguồn), `<Calendar>` (Ngày GD), `<FileText>` (Ghi chú / Diễn giải), `<EntityTagSelector>` (Thẻ nhãn) kèm nút Copy.
     - Edit mode: Combobox chọn chi nhánh, BufferedTextarea nhập ghi chú, Thẻ nhãn.
  2. **Tầng 2 & 3 — `THUỘC TÍNH MẶC ĐỊNH` & `THUỘC TÍNH TÙY CHỈNH` (`ModuleEntityCustomFieldsSection`)**:
     - Tích hợp `moduleKey="BANK_TXN"` quản lý danh mục và dynamic custom fields.

### 8.6. Chuẩn Hóa SubtotalSummaryCell tại Chân Bảng (`BankStatementsTab.tsx`)
- Hàng tổng cộng (`summaryRow`) tích hợp **`SubtotalSummaryCell`** đa năng:
  - `description`: Nhãn `Tổng cộng:` (variant `label`).
  - `thu`: Hiển thị tổng Tiền vào / Thu (`variantType="amount"`, `text-emerald-600 font-bold`).
  - `chi`: Hiển thị tổng Tiền ra / Chi (`variantType="amount"`, `text-[#ea580c] font-bold`).
  - `netOffAmount`: Hiển thị tổng Đã cấn trừ (`variantType="amount"`, `text-indigo-600 font-bold`, hỗ trợ `cumulativeAmount` và `grandTotalAmount` tính toán từ backend API).
  - `remainingAmount`: Hiển thị tổng Còn lại (`variantType="amount"`, tính toán an toàn `amount - netOff`, hỗ trợ `cumulativeAmount` và `grandTotalAmount` từ API).
- **Quy chuẩn Popover Chi tiết**:
  - **Header**: Tích hợp trực tiếp tên chỉ số (`Tiền vào (Thu)`, `Tiền ra (Chi)`, `Đã cấn trừ`, `Còn lại`) kèm icon tương ứng và badge `Trang X/Y`, loại bỏ các hàng sub-header thừa.
  - **Phân cấp thị giác chuẩn (Visual Hierarchy)**: Toàn bộ 3 cấp số liệu đồng nhất font `text-xs font-mono tabular-nums`. Phát sinh trang hiện tại (`text-foreground/80 font-medium`) $\to$ Lũy kế (`text-primary font-bold` với ký hiệu `↳`) $\to$ Divider ngăn cách $\to$ Tổng toàn bộ (`text-foreground font-bold`).
  - **Căn chỉnh phẳng (Flush Left-Right)**: Mọi thành phần từ Header, số liệu, divider, progress bar đến nhãn tỷ trọng lũy kế đều thẳng mép trái/phải 100%, không bị thụt lề lồng khung.



