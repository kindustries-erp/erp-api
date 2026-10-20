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

## 3. Cấu trúc Source Code Backend (Chuẩn /api-service-refactor)

```text
src/vinfast-parts/
├── dto/
│   └── fifo-unit-row.dto.ts                              # DTO cấu trúc dòng đơn vị FIFO (IN unit vs OUT unit)
├── entities/
│   ├── vinfast-parts-catalog.entity.ts                   # Entity bảng vinfast_parts_catalog
│   └── vinfast-parts-ledger.entity.ts                    # Entity bảng vinfast_parts_ledger
├── engines/
│   ├── vinfast-fifo.engine.ts                            # Pure Engine tính toán FIFO độc lập
│   └── vinfast-fifo.engine.spec.ts                       # Unit tests cho FIFO Engine
├── helpers/
│   └── vinfast-parts-query.helper.ts                     # Helper thuần túy sinh SQL multi-keyword, exact search, blank filter
├── services/
│   ├── vinfast-parts-stock.service.ts                    # Sub-service quản lý tồn kho, column-options, summary
│   ├── vinfast-parts-ledger.service.ts                   # Sub-service quản lý lịch sử sổ cái, FIFO unit rows
│   ├── vinfast-parts-sync.service.ts                     # Sub-service quản lý SKU resolve, sync catalog & ledger
│   └── vinfast-parts-stock-export-background.service.ts  # Service quản lý job xuất Excel ngầm, SSE progress, TTL 24h
├── controllers/
│   ├── vinfast-parts-sync.controller.ts                  # sync-catalog, sync-ledger, SSE sync/progress (RBAC: VINFAST UPDATE/READ)
│   ├── vinfast-parts-stock.controller.ts                 # stock, stock/column-options (RBAC: VINFAST READ)
│   ├── vinfast-parts-ledger.controller.ts                # ledger/:sku, fifo-rows/:sku (RBAC: VINFAST READ)
│   └── vinfast-parts-stock-export.controller.ts          # export Excel nền, history, download, SSE progress (RBAC: VINFAST READ)
├── vinfast-parts.service.ts                              # Facade Service tinh gọn, Clean DI Constructor
└── vinfast-parts.module.ts                               # Module NestJS đăng ký TypeORM, Sub-services & Background Service
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/vinfast-parts`  
Guards: `@UseGuards(JwtAuthGuard, CoreRbacGuard)` + `@RequirePermissions({ resource: ErpResource.VINFAST, action })` trên từng handler (ghi/sync = `UPDATE`, đọc/xuất = `READ`)  
Tags: `VinFast Parts`

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `POST` | `/api/v1/vinfast-parts/sync-catalog` | Đồng bộ danh mục phụ tùng từ toàn bộ hóa đơn mua hàng VinFast |
| `POST` | `/api/v1/vinfast-parts/sync-ledger` | Khởi chạy đồng bộ sổ cái IN/OUT theo dải ngày (`dateFrom`, `dateTo`, `clearDb`) |
| `GET` | `/api/v1/vinfast-parts/stock` | Lấy danh sách số dư tồn kho phụ tùng (`vehicleType`, `stockTab` [`ALL`, `IN_STOCK`, `OUT_OF_STOCK`, `NEGATIVE`], `search`, `sortBy`, `sortDir`, `column_filters`, phân trang), trả về song song `items` và `data: items` kèm `summary` (Grand Totals) và `cumulative` totals |
| `GET` | `/api/v1/vinfast-parts/stock/column-options` | Lấy danh sách giá trị distinct cho bộ lọc cột của bảng tồn kho (hỗ trợ lọc theo `stockTab`) |
| `GET` | `/api/v1/vinfast-parts/ledger/:sku` | Lấy lịch sử giao dịch sổ cái theo mã SKU (truy vết dòng tiền & luân chuyển) |
| `GET` | `/api/v1/vinfast-parts/fifo-rows/:sku` | Lấy bảng kê phân rã đơn vị FIFO (mapping từng đơn vị nhập với xuất/tồn) |
| `GET` | `/api/v1/vinfast-parts/sync/progress` | **SSE Stream**: Theo dõi tiến độ đồng bộ danh mục và sổ cái |
| `POST` | `/api/v1/vinfast-parts/stock/export/excel/background` | Khởi tạo tiến trình xuất file Excel tồn kho FIFO chạy ngầm |
| `GET` | `/api/v1/vinfast-parts/stock/export/excel/background/history` | Lấy lịch sử các lượt xuất file Excel của user hiện tại |
| `GET` | `/api/v1/vinfast-parts/stock/export/excel/background/:jobId/download` | Tải xuống file Excel tồn kho đã tạo thành công |
| `GET` | `/api/v1/vinfast-parts/stock/export/excel/progress/stream` | **SSE Stream**: Theo dõi % tiến độ tạo file Excel ngầm |

---

## 5. Logic Nghiệp vụ Trọng tâm

### 5.1. Bóc tách & Chuẩn hóa Mã Phụ Tùng (`resolveVinfastSku` / Tiền tố `VF-`)
- **Quy tắc chuẩn hóa 100% SKU có tiền tố `VF-`**:
  - Mẫu: `/^(?:VF-)?([A-Z]{3,6}[0-9]{5,8}[A-Z0-9]{0,3})/` $\to$ Gán `VF-<PART_NO>`.
  - Mã số thuần 5-10 số (classic part number) $\to$ Gán `VF-<NUMBERS>`.
- **Mã số thuế bên bán của VinFast (`VINFAST_SELLER_TAX_CODES`)**:
  - `0108926276` (VinFast Trading & Production)
  - `0318334886`
  - `0202357718`
- **Quy tắc ngoại lệ đặc biệt**:
  - `VF5_HV_BATTERY_PACK_38_KWH` -> SKU gán: `VF-EEP73110011AP`
  - `HV_BATTERY_41_9KWH` / `HV_BATTERY_41_9_KWH` / `BAT21001011` -> SKU gán: `VF-BAT21001011`
  - `HV_BATTERY_PACK` -> SKU gán: `VF-EEP73110011ALL`

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
7. Trạng thái đơn vị: `IN_STOCK` (còn kho), `SOLD`, `RETURNED` (đã bán rồi trả về kho, vẫn tính tồn tới khi bán lại), `ADJUSTMENT` (lô nhập bị điều chỉnh giảm), `SHORTAGE` (xuất vượt tồn, không có giá vốn). Invariant: `Σ(IN_STOCK + RETURNED) − Σ(SHORTAGE) = qtyBalance`.
8. Hàng trả (OUT qty âm do điều chỉnh `adj_sign=-1`): đảo các lần bán gần nhất, đưa đơn vị về kho với giá vốn cũ; COGS dòng trả là âm.
9. **Một lõi duy nhất**: `runFifo(entries)` trong `engines/vinfast-fifo.engine.ts` trả `{ unitRows, metrics }`. `calculateFifoUnitRows` (bảng kê) và `calculateLedgerHistoryCogs` (lịch sử sổ cái) đều lấy từ lõi này, không còn hàng đợi thứ hai.
10. Lịch sử `GET /vinfast-parts/ledger/:sku` trả thêm cho mỗi dòng: `calculatedCogs`, `calculatedUnitCost`, `balanceQty` (tồn lũy kế, có thể âm), `balanceValue`, `shortageQty` (tổng thiếu hàng lũy kế). Dòng cuối của mỗi SKU khớp `qtyBalance` của bảng tồn (đã đối chiếu 1.042 SKU trên DB, 0 lệch).
11. Dashboard `reports-core` (`calculateVinfastFifo`) dùng cùng lõi: `buildVinfastFifoPeriodMetrics` (`reports-core/helpers/vinfast-fifo-period-metrics.helper.ts`) gọi `calculateLedgerHistoryCogs`. Hình dạng kết quả không đổi. So với bản inline cũ trên DB: doanh thu và số lượng bán khớp, giá vốn giảm 13,4 triệu ở 14 SKU có hàng trả (hàng trả được hoàn kho theo giá vốn cũ).
12. Quy tắc dịch vụ khi nạp danh mục (`syncCatalog`, chỉ đọc hóa đơn mua vào): chỉ theo tiền tố `EEH/EMT/LFP/QTS/XSH` (`isVinfastServicePrefix`). Mã số thuần (`isVinfastLabourCode`) trên hóa đơn mua vẫn là phụ tùng. Mã công lao động chỉ xuất hiện trên hóa đơn bán nên không vào danh mục.

### 5.3b. Quy tắc dùng chung (`helpers/vinfast-ledger-rules.helper.ts`)
- **Trạng thái hóa đơn tính vào tồn/FIFO**: `tax_invoice_status IN (1, 2, 3, 5)`. Loại `4` (HĐ gốc đã bị thay thế, trùng với HĐ thay thế) và `6` (hủy). Dùng `VINFAST_VALID_STATUS_SQL` và `VINFAST_VALID_LEDGER_SUBQUERY_SQL` (qty đã nhân `adj_sign`) cho bảng tồn, lịch sử, FIFO và dashboard `reports-core`.
- **Điều chỉnh**: số lượng âm = trả hàng (`adj_sign=-1`); số lượng dương chỉ tính khi diễn giải có "tăng số lượng"; điều chỉnh đơn giá không có số lượng = `qty 0`.
- **Thứ tự ghi sổ**: `VINFAST_LEDGER_ORDER_SQL` — cùng ngày, nhập trước xuất, rồi theo số hóa đơn và `created_at`.
- **Dịch vụ / công lao động** (`isVinfastServiceSku`): mã số thuần `VF-\d{5,10}` và tiền tố `LFP/EEH/EMT/QTS/XSH` không phải phụ tùng; cờ `is_service=true` loại khỏi tồn.

### 5.6. Nhà cung cấp phụ tùng VinFast (`isVinfastCandidateSeller`)
- Ứng viên: tên người bán chứa "VinFast" (không phân biệt hoa thường), hoặc MST `0318334886` (Greenway Automotives; chỉ nhận dòng có mã VinFast trích được từ diễn giải).
- Mã phụ tùng chỉ lấy từ diễn giải/mã hàng bằng `extractVinfastItemCode` (mẫu VinFast). Không đoán mã từ chuỗi bất kỳ, nên không còn SKU như `VF-MMX30`, `VF-CAT6`.
- Sync theo hóa đơn: `syncCatalog`/`syncLedger` nhận `invoiceIds`; luồng nhập hóa đơn chỉ sync đúng hóa đơn vừa xử lý.

### 5.4. Cơ chế Xuất Báo Cáo Chạy Ngầm (`VinfastPartsStockExportBackgroundService`)
- Lưu trữ memory map `jobs` với TTL = 24 giờ.
- Tạo fingerprint băm từ câu query (`buildQueryFingerprint`) để phát hiện và tái sử dụng ngay kết quả xuất trước đó (`findReusableCompletedJob`), giảm tải tối đa cho cơ sở dữ liệu.
- Định dạng xuất: File `.xlsx` đa sheet (Sheet Tổng hợp + Sheet Chi tiết FIFO từng mã) sử dụng thư viện `exceljs`.

### 5.5. Filter Engine Nâng Cao (`column_search` & `column_filters`)
- **Multi-keyword (`;`)**: Tách chuỗi từ khóa qua dấu chấm phẩy và tạo điều kiện `OR` an toàn bằng `buildRawMultiKeywordSql`.
- **Exact Search (`""`)**: Phát hiện chuỗi trong ngoặc kép và match chính xác tuyệt đối không kèm `%`.
- **Blank Filter (`__BLANK__`)**: Xử lý `__BLANK__` trong `columnFilters` và `column_search` thành điều kiện `(field IS NULL OR field = '')`.

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

## Đồng bộ dựa trên mã hóa đơn (giai đoạn 5)
- `resolveVinfastSku(itemCode, description)`: nếu dòng hóa đơn đã có `item_code`, chỉ `VF-*` là phụ tùng; mã khác (`DV-`, `PT-`, `VT-`, `CK-`) không vào sổ cái. Chỉ khi chưa có mã mới trích từ mô tả.
- `syncLedger` gỡ dòng sổ cái cũ của dòng hóa đơn không còn là phụ tùng (đếm vào `deletedCount`).
- Dashboard `reports-core` (`calculateVinfastFifo`) loại SKU dịch vụ (`catalog.is_service = true`).

## Trạng thái và tiến trình đồng bộ (giai đoạn 6)
- `GET /vinfast-parts/sync/status`: trạng thái lượt đồng bộ hiện tại hoặc gần nhất (`running`, `startedAt`, `finishedAt`, `phase`, `current`, `total`, `message`, `lastError`). Drawer web hỏi định kỳ (2 giây khi đang chạy) và không phụ thuộc SSE.
- `POST /vinfast-parts/sync-ledger` trả 409 khi đang có lượt chạy (chặn chạy trùng trong một tiến trình API). Lượt chạy là `runFullSync`: danh mục rồi sổ cái.
- `syncLedger` nạp trước sổ cái và danh mục theo lô, bỏ qua dòng không đổi, tiến trình theo vị trí (mỗi 200 dòng).
- Hai luồng SSE (`sync/progress`, `stock/export/excel/progress/stream`) đặt `X-Accel-Buffering: no`, `Cache-Control: no-cache, no-transform`, nhịp ping 10 giây (`helpers/sse-headers.helper.ts`).
