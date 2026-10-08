---
name: garage-cashflow
description: Module tri thức Quản lý Sổ Thu Chi Xưởng Garage (Garage Cashflow) trong erp-api (kgara-api-core) và erp-web. Chứa toàn bộ database schema (kgara_case_settlements), entities, DTOs, API endpoints, logic lọc đa chiều, cấn trừ trực tiếp số phiếu dịch vụ, đối chiếu sao kê ngân hàng và chuẩn hóa giao diện SpreadsheetPageTemplate / StandardFormDrawer 2 cột.
---

# 📦 Module Tri Thức: Quản Lý Sổ Thu Chi Xưởng Garage (Garage Cashflow)

## 1. Tổng quan Nghiệp vụ

Phân hệ **Sổ Thu Chi Xưởng Garage (`Garage Cashflow`)** giải quyết triệt để bài toán độ trễ số liệu dòng tiền và sự chồng chéo logic khi cấn trừ thanh toán tại xưởng dịch vụ:
- **Tách bạch mối quan tâm (Separation of Concerns)**: Tách riêng sổ theo dõi thu/chi phát sinh thực tế tại xưởng (`/garage-cashflow`) khỏi quy trình hạch toán hóa đơn thuế VAT và sổ sao kê ngân hàng.
- **Cấn trừ trực tiếp Phiếu dịch vụ (Direct Case Settlement)**: Mỗi dòng thu/chi cho phép cấn trừ trực tiếp vào 1 Phiếu Dịch Vụ (`GR-PDV...`), tự động cập nhật số tiền đã thanh toán (`tien_da_thanh_toan`) và giảm trừ công nợ còn lại (`tien_con_phai_thanh_toan`) tức thì mà không cần chờ hóa đơn hay sao kê.
- **Sao kê đóng vai trò Tham chiếu (Audit Reference)**: Cho phép liên kết một dòng sao kê ngân hàng (`bank_transaction_id`) làm bằng chứng chuyển khoản đối chiếu, nhưng không bắt buộc phải có sao kê mới được ghi nhận thu chi.
- **Thu chi vận hành xưởng chung (General Garage Opex/Cashflow)**: Khi không gắn `case_id`, khoản chi hoặc thu được ghi nhận là chi phí/thu nhập vận hành chung của xưởng.
- **Đồng bộ hai chiều với Drawer Báo giá**: Drawer Báo giá (`QuoteFinancialsTabContent`) tích hợp nút bấm nhanh `+ Thu tiền` và `+ Chi tiền`, mở Drawer 2 cột điền sẵn thông tin phiếu và số tiền gợi ý.

---

## 2. Database Schema & Quan hệ Dữ liệu

### Bảng `kgara_case_settlements`

Bảng lưu trữ từng giao dịch dòng tiền thu chi tại xưởng:

| Tên Cột | Kiểu Dữ Liệu | Nullable | Mặc Định | Mô Tả / Ghi Chú |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `case_id` | `uuid` | YES | `NULL` | Khóa ngoại liên kết phiếu dịch vụ (`FK -> kgara_cases.id`) (Nullable cho phép thu chi chung) |
| `gross_profit_id` | `uuid` | YES | `NULL` | Khóa ngoại liên kết bản ghi lợi nhuận gộp (`FK -> kgara_gross_profit.id`) |
| `bank_transaction_id` | `uuid` | YES | `NULL` | Khóa ngoại liên kết sao kê ngân hàng ERP (`FK -> erp_bank_transactions.id`) |
| `settlement_type` | `varchar(20)` | NO | — | Phân loại thu chi: `'RECEIPT'` (Thu tiền) \| `'PAYMENT'` (Chi tiền) |
| `source_channel` | `varchar(30)` | NO | `'ON_SYSTEM'` | Nguồn dữ liệu: `'ON_SYSTEM'` (Sao kê hệ thống) \| `'OFF_SYSTEM_MANUAL'` (Thủ công tại xưởng) |
| `payment_method` | `varchar(30)` | NO | `'BANK_TRANSFER'` | Phương thức: `'BANK_TRANSFER'`, `'CASH'`, `'POS'`, `'OTHER'` |
| `amount` | `numeric(18,2)` | NO | `0` | Số tiền giao dịch (luôn lưu giá trị dương, phân biệt thu/chi qua `settlement_type`) |
| `trans_date` | `date` | YES | `NULL` | Ngày phát sinh giao dịch thực tế (`YYYY-MM-DD`) (**Index**) |
| `partner_name` | `varchar(255)` | YES | `NULL` | Người nộp tiền hoặc người nhận tiền |
| `payer_type` | `varchar(20)` | NO | `'KH'` | Đối tượng giao dịch: `'KH'` (Khách hàng), `'BH'` (Bảo hiểm), `'SUPPLIER'` (Nhà cung cấp/Gia công), `'OTHER'` (Khác) |
| `receipt_number` | `varchar(50)` | YES | `NULL` | Số phiếu thu, phiếu chi hoặc mã biên lai |
| `category` | `varchar(100)` | YES | `NULL` | Danh mục thu/chi (vd: `TIEN_MAT_NGOAI`, `AUTO_NETOFF_INVOICE`) |
| `note` | `text` | YES | `NULL` | Ghi chú diễn giải nội dung thu chi |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo bản ghi |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật cuối cùng |

**Indexes**:
- `IDX_case_settlements_case_id`: Btree trên cột `case_id`
- `IDX_case_settlements_trans_date`: Btree trên cột `trans_date`
- `IDX_case_settlements_payment_method`: Btree trên cột `payment_method`

---

## 3. Cấu trúc Source Code

### 3.1. Backend (`erp-api` - `src/kgara-api-core/`)
```text
src/kgara-api-core/
├── entities/
│   └── kgara_case_settlement.entity.ts         # Entity định nghĩa bảng kgara_case_settlements
├── controllers/
│   ├── garage-cashflow.controller.ts           # Pattern A Sub-Controller (< 100 LoC): route /greenway/cashflow
│   └── garage-cashflow.controller.spec.ts      # Unit tests cho Controller
├── services/
│   ├── garage-cashflow.service.ts              # Pattern B Sub-Service: Facade điều phối list, create, update, delete
│   ├── garage-cashflow.service.spec.ts         # Unit tests cho Service
│   └── kgara-case-settlement-calc.service.ts   # Sub-Service tính lại công nợ phiếu recalculateCaseSettlementSummary
├── engines/
│   ├── garage-cashflow-calc.engine.ts          # Pattern C Pure Engine: sanitizePaymentMethod, calculateCashflowStats
│   └── garage-cashflow-calc.engine.spec.ts     # Unit tests cho Pure Engine
├── helpers/
│   ├── garage-cashflow-filter.helper.ts        # Helper xử lý filtersStr đa chiều, statusTab, sorts, distinct column options
│   └── garage-cashflow-filter.helper.spec.ts   # Unit tests cho Helper
└── dto/
    ├── create-garage-cashflow.dto.ts           # DTO tạo mới và cập nhật giao dịch
    └── garage-cashflow-query.dto.ts            # DTO truy vấn phân trang, lọc nâng cao và distinct options
```

### 3.2. Frontend (`erp-web` - `src/modules/garage/`)
```text
src/modules/garage/
├── api/
│   └── garageCashflowApi.ts                    # API client gọi /api/v1/greenway/cashflow
├── hooks/
│   └── useGarageCashflowQuery.ts               # React Query hooks: list, options, mutations
├── pages/
│   └── GarageCashflow.tsx                      # Page Container (< 80 LoC): kết nối Table và Drawer
└── components/organisms/
    ├── garage-cashflow-table/                  # Cấu trúc Atomic 6 file (< 180 LoC / file)
    │   ├── GarageCashflowTable.tsx             # Render SpreadsheetPageTemplate + PillTabs
    │   ├── GarageCashflowTable.columns.tsx     # TableColumnHeaderFilter + DateRangeColumnSlot
    │   ├── GarageCashflowTable.summary.tsx     # SubtotalSummaryCell (Subtotal trang & Grand Total)
    │   ├── GarageCashflowTable.actions.tsx     # Row actions (Xem phiếu, Sửa, Xóa)
    │   ├── GarageCashflowTable.hook.ts         # Quản lý useTableColumnState("garage-cashflow-table")
    │   ├── GarageCashflowTable.type.ts         # Type contracts & context
    │   └── GarageCashflowTable.test.tsx        # Co-located Vitest unit test
    └── garage-cashflow-form-drawer/            # Drawer 2 cột chuẩn hóa StandardFormDrawer
        ├── GarageCashflowFormDrawer.tsx        # Container Drawer layout="2-columns"
        ├── GarageCashflowFormDrawer.hook.ts    # Form state, load case & bank options, submit
        ├── GarageCashflowFormDrawer.type.ts    # Props & Payload contracts
        ├── components/GarageCashflowLeftForm.tsx    # Cột trái: Form nhập liệu
        └── components/GarageCashflowRightSummary.tsx # Cột phải: Thẻ thông tin phiếu & sao kê
```

---

## 4. Danh sách API Endpoints & RBAC Contract

**Base URL**: `/api/v1/greenway/cashflow` (Tất cả API bắt buộc có tiền tố `/api/v1`)

| Method | Endpoint | Tham số / Body | Quyền RBAC | Mô tả Nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | Query: `page`, `pageSize`, `search`, `statusTab`, `filtersStr`, `sorts`, `dateFrom`, `dateTo` | `GARAGE:READ` \| `CASH_STATEMENTS:READ` \| `BANK_STATEMENTS:READ` | Lấy danh sách giao dịch phân trang, hỗ trợ lọc đa chiều từng cột, tính `stats` (Tổng thu, Tổng chi, Dòng tiền thuần). |
| `GET` | `/column-options` | Query: `column`, `search`, `page`, `pageSize`, `filtersStr`, `statusTab` | `GARAGE:READ` \| `CASH_STATEMENTS:READ` | Lấy danh sách Distinct Options phân trang cho popover lọc từng cột của DataTable hoặc static master options. |
| `POST` | `/` | Body: `CreateGarageCashflowDto` | `GARAGE:CREATE` \| `GARAGE:UPDATE` \| `CASH_STATEMENTS:CREATE` | Tạo mới giao dịch thu/chi, tự động chuẩn hóa kênh nguồn, tự động tính lại số dư phiếu dịch vụ. |
| `PATCH` | `/:id` | Param: `id`, Body: `UpdateGarageCashflowDto` | `GARAGE:UPDATE` \| `CASH_STATEMENTS:UPDATE` | Cập nhật thông tin giao dịch thu/chi và tái tính toán số dư cho cả phiếu cũ và phiếu mới. |
| `DELETE`| `/:id` | Param: `id` | `GARAGE:DELETE` \| `GARAGE:UPDATE` \| `CASH_STATEMENTS:DELETE` | Xóa giao dịch thu/chi và hoàn lại số dư công nợ cho phiếu dịch vụ liên kết. |

---

## 5. Logic Nghiệp Vụ Trọng Tâm

### 5.1. Chuẩn hóa kênh nguồn (`source_channel`)
- Nếu có `bankTransactionId` hoặc `paymentMethod === 'BANK_TRANSFER'`: Kênh nguồn được gán `'ON_SYSTEM'`.
- Nếu thanh toán tiền mặt (`CASH`), quẹt thẻ (`POS`) hoặc không gắn sao kê: Kênh nguồn được gán `'OFF_SYSTEM_MANUAL'`.

### 5.2. Tự động tính toán số dư Phiếu Dịch Vụ
Khi tạo, sửa hoặc xóa bản ghi có `case_id`:
```ts
await this.settlementCalcService.recalculateCaseSettlementSummary(caseId);
```
Hàm này tính tổng toàn bộ các khoản `RECEIPT` của phiếu, cập nhật:
- `tien_da_thanh_toan = SUM(amount)`
- `tien_con_phai_thanh_toan = GREATEST(0, tien_co_thue - tien_da_thanh_toan)`

### 5.3. Xử lý Filters Đa Chiều và Status Tabs
- **PillTabs**:
  - `receipt`: `s.settlementType = 'RECEIPT'`
  - `payment`: `s.settlementType = 'PAYMENT'`
  - `with_bank`: `s.bankTransactionId IS NOT NULL`
  - `no_bank`: `s.bankTransactionId IS NULL`
- **filtersStr JSON**: Hỗ trợ đồng thời Date Range (`from..to`), Amount Range (`min..max`), Multi-options (`IN (:...vals)`), Blank (`__BLANK__`), và Text Search (`ILIKE`).

---

## 6. Tích hợp Liên Module

- **`kgara-cases` (Phiếu Dịch Vụ)**: Liên kết `case_id` để trừ nợ trực tiếp và hiển thị thẻ tóm tắt phiếu trên Drawer.
- **`bank-transactions-core` (Sao Kê Ngân Hàng)**: Liên kết `bank_transaction_id` để hiển thị mô tả giao dịch sao kê, ngày giao dịch và số tiền đối soát.
- **`accounting-core`**: Cung cấp nguồn chứng từ tiền mặt / chuyển khoản đối soát sổ quỹ.

---

## 7. Quy Tắc Kiểm Thử & Quality Gates

Mọi thay đổi trên module phải vượt qua bộ kiểm thử:
```bash
# Backend Unit Tests (erp-api)
bunx jest src/kgara-api-core/controllers/garage-cashflow.controller.spec.ts
bunx jest src/kgara-api-core/services/garage-cashflow.service.spec.ts
bunx jest src/kgara-api-core/helpers/garage-cashflow-filter.helper.spec.ts
bunx jest src/kgara-api-core/engines/garage-cashflow-calc.engine.spec.ts

# Backend Typecheck (erp-api)
bunx tsc --noEmit

# Frontend Unit Tests (erp-web)
bunx vitest run src/modules/garage/components/organisms/garage-cashflow-table/
bunx vitest run src/modules/garage/components/organisms/garage-cashflow-form-drawer/

# Frontend Typecheck (erp-web)
bunx tsc --noEmit
```
