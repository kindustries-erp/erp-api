---
name: vinfast-parts-stock
description: Module tri thức Quản lý Tồn kho Phụ tùng VinFast (Stock, FIFO Ledger, Sync, Background Export) trong erp-api. Chứa toàn bộ database schema, entities, API endpoints, logic phân tách SKU/xe máy/ô tô, thuật toán tính giá vốn FIFO và xuất Excel ngầm.
---

# 📦 Module Tri Thức: Tồn Kho Phụ Tùng VinFast (Stock & FIFO Ledger) - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Module `vinfast-parts` quản lý danh mục và sổ cái kho phụ tùng VinFast (Ô tô & Xe máy), bóc tách tự động từ hóa đơn điện tử đầu vào (hóa đơn mua hàng từ VinFast) và hóa đơn đầu ra (hóa đơn dịch vụ/bán lẻ tại xưởng).

Các chức năng cốt lõi:
- **Tự động trích xuất mã phụ tùng (SKU)** từ mô tả hóa đơn theo biểu thức chính quy (Regex) và bảng ngoại lệ đặc thù của VinFast (vd: Pack Pin VF5, PIN xe máy điện).
- **Phân loại dòng xe**: Tự động phân định phụ tùng Ô tô (`CAR`) và Xe máy (`MOTORBIKE`) dựa trên danh sách mã quy chuẩn (`VINFAST_CAR_PART_CODES`).
- **Sổ cái nhập - xuất kho (`vinfast_parts_ledger`)**: Lưu vết toàn bộ dòng hàng hóa phát sinh kèm thông tin biển số xe (`license_plate`) và lệnh quyết toán (`settlement_order`).
- **Định giá tồn kho theo phương pháp FIFO (First In, First Out)**: Phân rã từng đơn vị hàng nhập (IN) ghép cặp với từng đơn vị hàng xuất (OUT) để tính giá vốn chính xác và số dư còn lại của từng lô.
- **Đồng bộ hóa đơn tự động/thủ công**: Hỗ trợ đồng bộ nền qua Server-Sent Events (SSE) theo dải ngày (`dateFrom` - `dateTo`) hoặc xóa tạo mới (`clearDb`).
- **Xuất báo cáo Excel chạy ngầm**: Hỗ trợ xuất file Excel bảng kê chi tiết và tổng hợp qua hàng đợi ngầm (`VinfastPartsStockExportBackgroundService`) với cơ chế tái sử dụng kết quả (cache query fingerprint) và TTL 24h.

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Bảng `vinfast_parts_catalog` (Danh mục phụ tùng)

| Cột | Kiểu | Nullable | Mặc định | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `sku` | `varchar(32)` | NO | | Mã SKU phụ tùng duy nhất (`UQ_ef411eebbae8fb679ccc8531833`) |
| `name` | `varchar(255)` | NO | | Tên phụ tùng đã chuẩn hóa |
| `uom` | `varchar(32)` | NO | | Đơn vị tính (Chiếc, Cái, Bộ, Lít...) |
| `is_service` | `boolean` | NO | `false` | Cờ phân biệt dịch vụ hay phụ tùng vật lý |
| `notes` | `text` | YES | `NULL` | Ghi chú |
| `created_at` | `timestamp` | NO | `now()` | Thời gian tạo |
| `updated_at` | `timestamp` | NO | `now()` | Thời gian cập nhật |

### 2.2. Bảng `vinfast_parts_ledger` (Sổ cái giao dịch phụ tùng)

| Cột | Kiểu | Nullable | Mặc định | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `part_sku` | `varchar(32)` | NO | | FK tham chiếu `vinfast_parts_catalog.sku` |
| `invoice_item_id` | `uuid` | NO | | FK tham chiếu `erp_invoice_items.id` (ON DELETE CASCADE) |
| `invoice_id` | `uuid` | NO | | FK tham chiếu `erp_invoices.id` (ON DELETE CASCADE) |
| `direction` | `varchar(3)` | NO | | Chiều giao dịch: `'IN'` (Nhập mua) hoặc `'OUT'` (Xuất xưởng/bán) |
| `qty` | `numeric(12,4)`| NO | | Số lượng phát sinh |
| `unit_cost` | `numeric(15,2)`| YES | `NULL` | Đơn giá trước thuế |
| `pre_vat_amount` | `numeric(15,2)`| YES | `NULL` | Thành tiền trước thuế |
| `transaction_date`| `date` | NO | | Ngày giao dịch (lấy từ `invoice_date`) |
| `license_plate` | `varchar(32)` | YES | `NULL` | Biển số xe bóc tách từ hóa đơn |
| `settlement_order`| `varchar(64)` | YES | `NULL` | Mã lệnh quyết toán bóc tách từ hóa đơn |
| `is_adjustment` | `boolean` | NO | `false` | Cờ hóa đơn điều chỉnh |
| `adj_sign` | `int` | NO | `1` | Dấu điều chỉnh (1: Tăng, -1: Giảm) |
| `created_at` | `timestamp` | NO | `now()` | Thời gian ghi sổ |

---

## 3. Cấu trúc Source Code Backend

```text
src/vinfast-parts/
├── dto/
│   └── fifo-unit-row.dto.ts                              # DTO cấu trúc dòng đơn vị FIFO (IN unit vs OUT unit)
├── entities/
│   ├── vinfast-parts-catalog.entity.ts                   # Entity bảng vinfast_parts_catalog
│   └── vinfast-parts-ledger.entity.ts                    # Entity bảng vinfast_parts_ledger
├── services/
│   └── vinfast-parts-stock-export-background.service.ts  # Service quản lý job xuất Excel ngầm, SSE progress, TTL 24h
├── vinfast-parts.controller.ts                           # Controller định tuyến API, SSE streams, Swagger, Guard
├── vinfast-parts.service.ts                              # Service chứa logic sync catalog, sync ledger, tính FIFO & export Excel
└── vinfast-parts.module.ts                               # Module NestJS đăng ký TypeORM và Background Service
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/vinfast-parts`  
Guards: `@UseGuards(JwtAuthGuard)`  
Tags: `VinFast Parts`

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `POST` | `/api/v1/vinfast-parts/sync-catalog` | Đồng bộ danh mục phụ tùng từ toàn bộ hóa đơn mua hàng VinFast |
| `POST` | `/api/v1/vinfast-parts/sync-ledger` | Khởi chạy đồng bộ sổ cái IN/OUT theo dải ngày (`dateFrom`, `dateTo`, `clearDb`) |
| `GET` | `/api/v1/vinfast-parts/stock` | Lấy danh sách số dư tồn kho phụ tùng (`vehicleType`, `search`, `sortBy`, `sortDir`, `column_filters`, phân trang) |
| `GET` | `/api/v1/vinfast-parts/stock/column-options` | Lấy danh sách giá trị distinct cho bộ lọc cột của bảng tồn kho |
| `GET` | `/api/v1/vinfast-parts/ledger/:sku` | Lấy lịch sử giao dịch sổ cái theo mã SKU (truy vết dòng tiền & luân chuyển) |
| `GET` | `/api/v1/vinfast-parts/fifo-rows/:sku` | Lấy bảng kê phân rã đơn vị FIFO (mapping từng đơn vị nhập với xuất/tồn) |
| `GET` | `/api/v1/vinfast-parts/sync/progress` | **SSE Stream**: Theo dõi tiến độ đồng bộ danh mục và sổ cái |
| `POST` | `/api/v1/vinfast-parts/stock/export/excel/background` | Khởi tạo tiến trình xuất file Excel tồn kho FIFO chạy ngầm |
| `GET` | `/api/v1/vinfast-parts/stock/export/excel/background/history` | Lấy lịch sử các lượt xuất file Excel của user hiện tại |
| `GET` | `/api/v1/vinfast-parts/stock/export/excel/background/:jobId/download` | Tải xuống file Excel tồn kho đã tạo thành công |
| `GET` | `/api/v1/vinfast-parts/stock/export/excel/progress/stream` | **SSE Stream**: Theo dõi % tiến độ tạo file Excel ngầm |

---

## 5. Logic Nghiệp vụ Trọng tâm

### 5.1. Bóc tách & Chuẩn hóa Mã Phụ Tùng (`resolveVinfastSku`)
- **Mã số thuế bên bán của VinFast (`VINFAST_SELLER_TAX_CODES`)**:
  - `0108926276` (VinFast Trading & Production)
  - `0318334886`
  - `0202357718`
- **Quy tắc Regex bóc tách SKU chuẩn**:
  - Mẫu: `/([A-Z]{3}[0-9][A-Z0-9]*)/` (3 chữ cái in hoa, 1 số, theo sau bởi các ký tự chữ số).
- **Quy tắc ngoại lệ đặc biệt**:
  - `VF5_HV_BATTERY_PACK_38_KWH` -> SKU gán: `EEP73110011AP`
  - `HV_BATTERY_41_9KWH` / `HV_BATTERY_41_9_KWH` / `BAT21001011` -> SKU gán: `BAT21001011`
  - `HV_BATTERY_PACK` -> SKU gán: `EEP73110011ALL`

### 5.2. Phân loại Ô tô (`CAR`) vs Xe máy (`MOTORBIKE`)
- Sử dụng tập hằng số `VINFAST_CAR_PART_CODES` từ `src/reports-core/vinfast-car-part-codes.ts`.
- Nếu `sku` thuộc tập hợp `VINFAST_CAR_PART_CODES` -> `vehicleType = 'CAR'`.
- Ngược lại -> `vehicleType = 'MOTORBIKE'`.

### 5.3. Thuật toán Ghép Cặp & Định Giá FIFO (`getFifoUnitRows`)
1. Lấy toàn bộ giao dịch `IN` (sắp xếp tăng dần theo `transactionDate`, `createdAt`).
2. Lấy toàn bộ giao dịch `OUT` (sắp xếp tăng dần theo `transactionDate`, `createdAt`).
3. Mở rộng từng giao dịch thành các đơn vị unit riêng lẻ (Unit `1..N`).
4. Ghép cặp tuần tự: Đơn vị `IN` đầu tiên được gán cho đơn vị `OUT` đầu tiên phát sinh sau đó.
5. Nếu đơn vị `IN` chưa được ghép với bất kỳ đơn vị `OUT` nào -> Trạng thái `IN_STOCK` (Tồn kho), đơn giá tồn là đơn giá nhập của chính đơn vị đó.
6. Tính số ngày lưu kho: `transactionDate(OUT) - transactionDate(IN)` hoặc `now() - transactionDate(IN)`.

### 5.4. Cơ chế Xuất Báo Cáo Chạy Ngầm (`VinfastPartsStockExportBackgroundService`)
- Lưu trữ memory map `jobs` với TTL = 24 giờ.
- Tạo fingerprint băm từ câu query (`buildQueryFingerprint`) để phát hiện và tái sử dụng ngay kết quả xuất trước đó (`findReusableCompletedJob`), giảm tải tối đa cho cơ sở dữ liệu.
- Định dạng xuất: File `.xlsx` đa sheet (Sheet Tổng hợp + Sheet Chi tiết FIFO từng mã) sử dụng thư viện `exceljs`.

---

## 6. Tích hợp Liên Module

- **`erp-invoices-core`**:
  - Khi hóa đơn mới được tải về hoặc cập nhật trạng thái trong `invoice-portal.service.ts`, hệ thống tự động kích hoạt sync bất đồng bộ vào `vinfast_parts_ledger`.
  - Khóa ngoại `invoice_item_id` và `invoice_id` có ràng buộc `ON DELETE CASCADE` đảm bảo khi hóa đơn bị xóa thì sổ cái tự động dọn sạch.
- **`reports-core`**:
  - Chia sẻ chung tập mã phân loại `VINFAST_CAR_PART_CODES` và dữ liệu nền tảng cho dashboard báo cáo.

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

Khi chỉnh sửa `vinfast-parts`:
1. Chạy Type-check: `bun run check:ci`
2. Chạy Unit test: `bunx jest src/vinfast-parts/ --forceExit`
3. Kiểm tra tính toàn vẹn khóa ngoại trong migration `1786406852396-VinfastPartsSchema.ts` và `1786414442074-LedgerCascade.ts`.
