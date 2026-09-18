---
name: journal-entry
description: Module tri thức Sổ Nhật Ký Chung & Bút toán Tổng hợp (General Journal & Journal Entries) trong erp-api (accounting-core) và erp-web. Chứa toàn bộ database schema (erp_journal_entries, erp_journal_entry_lines), logic sinh số chứng từ tự động (UNT-, UNC-, PT-, PC-, HĐM-), thuật toán ghép cặp dòng định khoản Nợ/Có (Pro-rata line pairing), tính tổng phát sinh & số lũy kế theo trang/toàn bộ, bộ lọc đa chiều (PillTabs, column filters, cascading options), tích hợp liên module (Dòng tiền, Hóa đơn VAT) và giao diện SpreadsheetPageTemplate / SubtotalSummaryCell popover.
---

# 📚 Module Tri Thức: Sổ Nhật Ký Chung & Bút Toán Kế Toán (General Journal / Journal Entries)

## 1. Tổng quan Nghiệp vụ

Module `journal-entry` (thuộc phân hệ `accounting-core`) đóng vai trò là **Sổ Nhật Ký Chung** trung tâm trong hệ thống kế toán kép (Double-entry Bookkeeping) của Liouni ERP.

Tất cả các nghiệp vụ kinh tế phát sinh từ các phân hệ Dòng tiền ngân hàng, Sổ quỹ tiền mặt, Hóa đơn thuế, Mua hàng, Bán hàng và các bút toán điều chỉnh kế toán đều được hạch toán, ghi nhận và tra cứu tập trung tại đây.

### Các Chức Năng Nghiệp Vụ Cốt Lõi:
1. **Nguyên tắc Kế toán Kép (Double-Entry Balancing)**:
   - Mọi bút toán (`ErpJournalEntry`) phải đảm bảo cân bằng tuyệt đối giữa Tổng phát sinh Nợ và Tổng phát sinh Có:
     $$\sum \text{Debit} = \sum \text{Credit}$$
   - Hiển thị trực quan trạng thái cân đối kế toán ($\Delta = |\text{Nợ} - \text{Có}|$) trên thanh tổng cộng footer của bảng dữ liệu.
2. **Phân loại Nguồn Chứng từ (Source Types & Tabs)**:
   - `ALL`: Tất cả các chứng từ kế toán trong hệ thống.
   - `CASHFLOW`: Nghiệp vụ phát sinh dòng tiền (Ngân hàng `BANK` và Tiền mặt `CASH`).
   - `INVOICE`: Nghiệp vụ phát sinh từ Hóa đơn thuế GTGT (`INVOICE`).
   - `OTHER`: Các bút toán tổng hợp, kết chuyển chi phí/doanh thu hoặc điều chỉnh nội bộ.
3. **Sinh Mã Số Chứng Từ Chuẩn Hóa**:
   - Tự động sinh mã chứng từ theo quy ước tiền tố và thời gian:
     - Ủy nhiệm thu ngân hàng: `UNT-YYYYMMDD-xx`
     - Ủy nhiệm chi ngân hàng: `UNC-YYYYMMDD-xx`
     - Phiếu thu tiền mặt: `PT-YYYYMMDD-xx`
     - Phiếu chi tiền mặt: `PC-YYYYMMDD-xx`
     - Hóa đơn mua hàng: `HĐM-YYYYMMDD-xx`
     - Chứng từ kế toán khác: `CT-YYYYMMDD-xx`
4. **Thuật toán Ghép Cặp Dòng Định Khoản Đối Ứng (Pro-Rata Line Pairing)**:
   - Tự động phân rã các bút toán phức tạp (1 Nợ nhiều Có hoặc nhiều Nợ 1 Có) thành các dòng định khoản đối ứng phẳng để kế toán viên dễ dàng theo dõi tài khoản đối ứng (`opposingAccount`).
5. **Tổng Quan Số Liệu & Lũy Kế Đa Tầng (Subtotal, Cumulative & Grand Total)**:
   - Hỗ trợ xem tức thời tổng phát sinh trang hiện tại, số lũy kế từ trang 1 đến trang hiện tại, tổng toàn bộ hệ thống và tỷ trọng phần trăm tiến độ tương ứng.
6. **Mạng Lưới Truy Xuất Nguồn Gốc Chứng Từ Gốc**:
   - Cho phép click trực tiếp vào số tham chiếu hoặc dùng Action Dropdown để mở Drawer xem chi tiết giao dịch ngân hàng (`BankTransactionDetailDrawer`) hoặc Drawer chi tiết hóa đơn thuế (`InvoiceDetailWrapper`).

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Bảng `erp_journal_entries` (Header Sổ Nhật Ký Chung)

| Cột | Kiểu dữ liệu | Nullable | Default | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `branch_id` | `uuid` | NO | — | Khóa ngoại tham chiếu `erp_branches(id)` |
| `entry_no` | `varchar(100)` | NO | — | Số chứng từ hạch toán (vd: `UNT-20260918-01`, `UNC-20260918-05`), Index |
| `date` | `timestamp` | NO | — | Ngày hạch toán nghiệp vụ (Posting Date) |
| `document_date` | `date` | YES | `NULL` | Ngày trên chứng từ gốc (Document Date) |
| `description` | `text` | YES | `NULL` | Diễn giải chung của chứng từ |
| `subject_name` | `varchar(255)` | YES | `NULL` | Tên đối tượng liên quan (Khách hàng, NCC, Người nộp/nhận) |
| `status` | `varchar(50)` | NO | `'POSTED'` | Trạng thái ghi sổ (`DRAFT`, `POSTED`, `CANCELLED`) |
| `reference` | `varchar(100)` | YES | `NULL` | Mã chứng từ tham chiếu gốc (vd: mã UNC, số HĐ thuế, mã phiếu kho) |
| `source_id` | `uuid` | YES | `NULL` | UUID bản ghi gốc trong bảng nghiệp vụ (bank txn, invoice, etc.) |
| `source_type` | `varchar(50)` | YES | `NULL` | Loại nguồn (`BANK`, `CASH`, `INVOICE`, `PURCHASE`, `SALE`, `OTHER`) |
| `is_deleted` | `boolean` | NO | `false` | Cờ xóa mềm (`true` = Đã xóa) |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo bản ghi |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật bản ghi gần nhất |

### 2.2. Bảng `erp_journal_entry_lines` (Dòng Định Khoản Chi Tiết Nợ / Có)

| Cột | Kiểu dữ liệu | Nullable | Default | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `journal_entry_id` | `uuid` | NO | — | Khóa ngoại tham chiếu `erp_journal_entries(id)` (ON DELETE CASCADE) |
| `account_id` | `uuid` | NO | — | Khóa ngoại tham chiếu `erp_chart_of_accounts(id)` |
| `debit` | `numeric(18,4)` | NO | `0` | Số tiền phát sinh Nợ |
| `credit` | `numeric(18,4)` | NO | `0` | Số tiền phát sinh Có |
| `description` | `text` | YES | `NULL` | Diễn giải chi tiết cho dòng định khoản |
| `sort` | `int` | YES | `NULL` | Thứ tự hiển thị dòng trong chứng từ |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo dòng |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật dòng |

### 2.3. Sơ đồ Quan hệ Entity (TypeORM):
```text
ErpBranch (1) ──────────< (n) ErpJournalEntry (branch_id)
ErpJournalEntry (1) ────< (n) ErpJournalEntryLine (lines, via journal_entry_id)
ErpChartOfAccount (1) ──< (n) ErpJournalEntryLine (account, via account_id)
```

---

## 3. Cấu trúc Source Code

### Backend (`erp-api`):
```text
src/accounting-core/
├── entities/
│   ├── erp_chart_of_account.entity.ts     # Entity Hệ thống tài khoản kế toán
│   ├── erp_journal_entry.entity.ts        # Entity Header sổ nhật ký chung
│   └── erp_journal_entry_line.entity.ts   # Entity Chi tiết dòng Nợ/Có
├── controllers/
│   └── accounting-core.controller.ts      # Controller API routes cho Journal Entries & COA
├── services/
│   ├── accounting-core.service.ts         # Service xử lý query, totals, pro-rata pairing & options
│   └── accounting-core.service.spec.ts    # Unit tests cho AccountingCoreService
└── accounting-core.module.ts              # NestJS Module khai báo dependencies
```

### Frontend (`erp-web`):
```text
src/
├── pages/finance/
│   ├── GeneralJournalPage.tsx             # Giao diện chính Sổ Nhật Ký Chung (Spreadsheet Template)
│   └── __tests__/GeneralJournalPage.test.tsx # Unit tests kiểm thử giao diện & tính toán footer
├── modules/accounting/
│   ├── api/accountingApi.ts               # API Client giao tiếp backend accounting-core
│   ├── hooks/useJournalEntriesList.ts     # Hook quản lý state, search, filter, pagination & totals
│   └── types/journalEntry.ts              # Type definitions (ErpJournalEntry, Totals, SpreadsheetRow)
└── shared/components/DataTable/
    └── SubtotalSummaryCell.tsx            # Component Footer Popover hiển thị số liệu & lũy kế
```

---

## 4. Danh sách API Endpoints & Contract

Controller Base Route: `/api/v1/accounting-core`

| Method | Endpoint | Tham số Query / Param | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/accounting-core/journal-entries` | `page`, `pageSize`, `search`, `branchId`, `startDate`, `endDate`, `doc_date_from`, `doc_date_to`, `source_type`, `column_search`, `column_filters`, `sort` | Lấy danh sách sổ nhật ký chung kèm dòng định khoản Nợ/Có, đối tượng liên quan, phân trang và object `totals` tính toán đầy đủ |
| `GET` | `/api/v1/accounting-core/journal-entries/column-options` | `column`, `search`, `page`, `pageSize`, `filters`, `branch_id` | Lấy danh sách distinct options phân trang infinite scroll theo từng cột (`entryNo`, `branch`, `subjectName`, `account`, `opposingAccount`, `status`, `sourceType`, `reference`, `description`, `debit`, `credit`) |
| `GET` | `/api/v1/accounting-core/journal-entries/:id` | `id` (UUID) | Lấy chi tiết toàn bộ một bút toán nhật ký chung kèm các dòng định khoản và tài khoản kế toán |

### Cấu trúc Response của `/journal-entries`:
```json
{
  "items": [
    {
      "id": "uuid-...",
      "entryNo": "UNT-20260918-01",
      "date": "2026-09-18T00:00:00.000Z",
      "documentDate": "2026-09-18",
      "subjectName": "Công ty TNHH Vận Tải ABC",
      "description": "Thu tiền cước vận chuyển chuyến xe số 12",
      "status": "POSTED",
      "reference": "TXN-BIDV-883921",
      "sourceId": "uuid-txn-...",
      "sourceType": "BANK",
      "branch": { "id": "...", "name": "Chi nhánh Hà Nội" },
      "lines": [
        {
          "id": "uuid-line-1",
          "accountId": "uuid-acc-1121",
          "account": { "accountCode": "1121", "accountName": "Tiền gửi BIDV" },
          "debit": 50000000,
          "credit": 0,
          "description": "Thu tiền cước"
        },
        {
          "id": "uuid-line-2",
          "accountId": "uuid-acc-131",
          "account": { "accountCode": "131", "accountName": "Phải thu khách hàng" },
          "debit": 0,
          "credit": 50000000,
          "description": "Thu tiền cước"
        }
      ]
    }
  ],
  "total": 120,
  "page": 1,
  "pageSize": 20,
  "totalPages": 6,
  "totals": {
    "grandTotalDebit": 1560000000,
    "grandTotalCredit": 1560000000,
    "cumulativeDebit": 250000000,
    "cumulativeCredit": 250000000,
    "totalLines": 240,
    "cumulativeLines": 40
  }
}
```

---

## 5. Logic Nghiệp vụ & Thuật toán Trọng tâm

### 5.1. Thuật toán Sinh Mã Bút Toán Tự Động (`generateEntryNo`)
- Quy tắc định dạng: `${PREFIX}-${YYYYMMDD}-${COUNT}`.
- Tiền tố tự động dựa trên `sourceType` và cờ thu/chi:
  - `sourceType === 'BANK'`: `UNT-` (Thu) hoặc `UNC-` (Chi).
  - `sourceType === 'CASH'`: `PT-` (Thu) hoặc `PC-` (Chi).
  - `customPrefix` được truyền vào (vd: `HĐM`, `HĐB`): `${customPrefix}-${YYYYMMDD}`.
- Kiểm tra bản ghi có mã lớn nhất trong ngày của chi nhánh (`branchId`) để tự động tăng số thứ tự (`count + 1`, định dạng tối thiểu 2 chữ số: `01`, `02`, ...).

### 5.2. Thuật toán Ghép Cặp Dòng Định Khoản (Pro-Rata Line Pairing)
Khi một giao dịch có nhiều dòng Nợ và nhiều dòng Có (vd: Chi phí 100tr + VAT 10tr trả bằng Tiền mặt 50tr + Tiền gửi 60tr), thuật toán 2 con trỏ (Two Pointers Greedy) sẽ phân rã thành các cặp dòng tương ứng để gán đúng tài khoản đối ứng:
```typescript
let i = 0, j = 0;
while (i < debits.length && j < credits.length) {
  const d = debits[i];
  const c = credits[j];
  const amount = Math.min(d.debit, c.credit);
  if (amount > 0) {
    pairedLines.push({ accountId: d.accountId, debit: amount, credit: 0, description: d.description });
    pairedLines.push({ accountId: c.accountId, debit: 0, credit: amount, description: c.description });
  }
  d.debit -= amount;
  c.credit -= amount;
  if (d.debit < 0.01) i++;
  if (c.credit < 0.01) j++;
}
```

### 5.3. Thuật toán Tính Tổng Toàn Bộ & Tổng Lũy Kế (Grand Total & Cumulative Totals)
Để tối ưu hóa hiệu năng và bảo đảm số liệu lũy kế luôn chính xác theo đúng thứ tự sắp xếp và bộ lọc:
1. **Grand Totals**: Sử dụng QueryBuilder clone độc lập loại bỏ `offset/limit` để tính `SUM(lines.debit)`, `SUM(lines.credit)` và `COUNT(lines.id)` trên toàn bộ tập dữ liệu khớp bộ lọc.
2. **Cumulative Totals**:
   - **Trang 1**: Số lũy kế bằng chính số tổng của trang 1 (`cumulative = pageTotal`).
   - **Trang cuối**: Số lũy kế bằng chính số tổng toàn bộ (`cumulative = grandTotal`).
   - **Các trang trung gian (2 đến totalPages - 1)**: Thực hiện truy vấn phụ với `.offset(0).limit(page * pageSize)` để cộng dồn chính xác toàn bộ các trang từ đầu đến trang hiện tại.

---

## 6. Giao diện Người Dùng & Subtotal Popover

### 6.1. Kiến Trúc Trang `GeneralJournalPage.tsx`
- Xây dựng trên nền tảng `SpreadsheetPageTemplate` chuẩn mực với Virtualized DataTable.
- Tích hợp thanh chuyển Tab `PillTabs` (`ALL`, `CASHFLOW`, `INVOICE`, `OTHER`).
- Bộ lọc động từng cột (Header Dropdown Filter) với phân trang nạp ngầm danh sách lựa chọn qua API `column-options`.
- Hỗ trợ copy số chứng từ và mở nhanh chứng từ gốc qua Action Dropdown menu.

### 6.2. Cấu Trúc Footer Popover `SubtotalSummaryCell`
Khi người dùng nhấp vào ô tổng cộng ở cột **Phát sinh Nợ** hoặc **Phát sinh Có** (được xử lý như các cột số tiền tiêu chuẩn trên hệ thống):
- **Header Popover**: Tích hợp tiêu đề chỉ số và icon (vd: `🪙 Phát sinh Nợ` hoặc `🪙 Phát sinh Có`) kèm badge số trang `Trang: X/Y`.
- **Khối Số Liệu**:
  - Trang hiện tại: Hiển thị giá trị phát sinh của trang (`subtotalAmount`).
  - Lũy kế (Trang 1 $\to$ Hiện tại): Hiển thị tổng phát sinh lũy kế (`cumulativeAmount`).
  - Đường kẻ phân cách viền mảnh (`border-slate-100 dark:border-slate-800`).
  - Tổng toàn bộ: Hiển thị tổng phát sinh toàn hệ thống (`grandTotalAmount`).
- **Tiến Độ & Tỷ Trọng**:
  - Thanh tiến độ Progress Bar thể hiện tỷ lệ % số tiền lũy kế so với tổng toàn bộ (`cumulativeAmount / grandTotalAmount * 100`).
  - Tỷ trọng giá trị rõ ràng (vd: `Tỷ trọng giá trị: 40%`).

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng

Mỗi khi chỉnh sửa module `journal-entry` hoặc `accounting-core`, bắt buộc phải thực thi bộ kiểm thử sau:

```bash
# 1. Chạy Unit Tests Backend (erp-api)
cd /home/dev/repos/erp/erp-api
bun test src/accounting-core

# 2. Kiểm tra Type Backend
bun run type:check

# 3. Chạy Unit Tests Frontend (erp-web)
cd /home/dev/repos/erp/erp-web
bun run test src/pages/finance/__tests__/GeneralJournalPage.test.tsx

# 4. Kiểm tra Type Frontend
bun run type:check
```
