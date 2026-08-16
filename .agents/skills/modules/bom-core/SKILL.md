---
name: bom-core
description: Module tri thức Định mức vật tư (BOM - Bill of Materials) trong erp-api. Chứa toàn bộ database schema, entities, DTOs, API endpoints, logic phân rã đa cấp (explode BOM), xuất/nhập Excel/CSV và tích hợp với Production & Inventory.
---

# 📦 Module Tri Thức: Định mức vật tư (BOM - Bill of Materials) - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Module BOM quản lý cấu trúc định mức nguyên vật liệu (Bill of Materials) cần thiết để sản xuất một đơn vị thành phẩm (Finished Good). BOM hỗ trợ:
- Định mức một cấp hoặc đa cấp (cây phân rã linh kiện lồng nhau, bán thành phẩm lồng thành phẩm).
- Tỷ lệ hao hụt (%) cho từng linh kiện.
- Đơn vị tính (UOM) độc lập cho từng dòng định mức.
- Xuất dữ liệu đa cấp ra Excel theo mẫu quy chuẩn K LOTUS (`K LOTUS-SX-BM-01-04`) hoặc CSV UTF-8.
- Tải file mẫu và import danh sách linh kiện từ Excel/CSV.
- Phân rã định mức đệ quy (`explodeBom`) cho Lệnh sản xuất (`production-core`), tự động phát hiện và chặn vòng lặp cấu trúc (Circular Dependency).
- Nhận diện linh kiện cần theo dõi serial để tạo As-Built BOM tracking.

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Bảng `erp_boms` (Header)

| Cột | Kiểu | Nullable | Mặc định | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `bom_code` | `varchar(255)` | NO | | Mã BOM duy nhất (Unique Index `IDX_4b5651bad5828ff8baf279728c`) |
| `bom_name` | `varchar(255)` | NO | | Tên định mức |
| `finished_good_item_id` | `uuid` | YES | `NULL` | FK tới `erp_inventory_items.id` (Thành phẩm) |
| `version` | `varchar(255)` | NO | `'1.0'` | Phiên bản định mức (vd: "1.0", "01") |
| `status` | `varchar(255)` | NO | `'ACTIVE'` | Trạng thái (`ACTIVE`, `INACTIVE`, `DRAFT`) |
| `effective_from` | `date` | YES | `NULL` | Ngày bắt đầu áp dụng |
| `effective_to` | `date` | YES | `NULL` | Ngày hết hiệu lực |
| `notes` | `text` | YES | `NULL` | Ghi chú thêm |
| `created_by` | `uuid` | YES | `NULL` | Người tạo |
| `is_deleted` | `boolean` | NO | `false` | Cờ xóa mềm (Soft delete) |
| `created_at` | `timestamptz` | NO | `now()` | Thời gian tạo |
| `updated_at` | `timestamptz` | NO | `now()` | Thời gian cập nhật |

### 2.2. Bảng `erp_bom_lines` (Details)

| Cột | Kiểu | Nullable | Mặc định | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `bom_id` | `uuid` | NO | | FK tham chiếu tới `erp_boms.id` |
| `line_no` | `int` | NO | | Thứ tự dòng trong BOM (1, 2, 3, ...) |
| `component_item_id` | `uuid` | YES | `NULL` | FK tới `erp_inventory_items.id` (Linh kiện) |
| `qty_required` | `numeric(18, 3)`| NO | | Số lượng định mức cho 1 đơn vị thành phẩm |
| `uom_id` | `uuid` | NO | | FK tới `erp_uoms.id` (Đơn vị tính) |
| `scrap_rate` | `numeric(18, 3)`| YES | `NULL` | Tỷ lệ hao hụt (%) (vd: `2.500` = 2.5%) |
| `notes` | `text` | YES | `NULL` | Ghi chú chi tiết dòng |
| `created_at` | `timestamptz` | NO | `now()` | Thời gian tạo |
| `updated_at` | `timestamptz` | NO | `now()` | Thời gian cập nhật |

---

## 3. Cấu trúc Source Code Backend

```text
src/bom-core/
├── entities/
│   ├── erp_bom.entity.ts           # Entity bảng erp_boms
│   └── erp_bom_line.entity.ts      # Entity bảng erp_bom_lines (ManyToOne uom, componentItem)
├── dto/
│   ├── create-bom.dto.ts           # DTO tạo BOM (header + lines)
│   ├── create-bom-line.dto.ts      # DTO cho từng dòng linh kiện
│   ├── list-bom.dto.ts             # DTO phân trang & lọc danh sách BOM
│   └── update-bom.dto.ts           # DTO cập nhật BOM (kế thừa PartialType(CreateBomDto))
├── bom-core.controller.ts          # Controller khai báo routing, RBAC, Swagger, Upload/Export
├── bom-core.service.ts             # Service xử lý transaction, import/export, đa cấp, column options
└── bom-core.module.ts              # Module đăng ký TypeORM và Service
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/bom` (Prefix: `bom`).  
Guards: `JwtAuthGuard`, `CoreRbacGuard`.

| Method | Endpoint | Quyền yêu cầu | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/bom` | `{ resource: 'bom', action: 'create' }` | Tạo mới BOM và danh sách dòng trong transaction |
| `GET` | `/api/v1/bom` | `{ resource: 'bom', action: 'read' }` | Lấy danh sách BOM (phân trang, search, lọc theo `finishedGoodItemId`) |
| `GET` | `/api/v1/bom/column-options` | `{ resource: 'bom', action: 'read' }` | Lấy danh sách giá trị distinct cho bộ lọc cột (`bom_code`, `bom_name`, `version`, `status`, `finished_good_item_name`) |
| `GET` | `/api/v1/bom/import/template` | `{ resource: 'bom', action: 'read' }` | Tải file Excel mẫu 2 sheet: `Template` và `Danh sách linh kiện` |
| `POST` | `/api/v1/bom/import/parse` | `{ resource: 'bom', action: 'create' }` | Upload file Excel/CSV, validate SKU và trả về danh sách dòng hợp lệ |
| `GET` | `/api/v1/bom/:id/export` | `{ resource: 'bom', action: 'read' }` | Xuất BOM đa cấp đệ quy ra định dạng `xlsx` (mẫu K LOTUS) hoặc `csv` |
| `GET` | `/api/v1/bom/:id` | `{ resource: 'bom', action: 'read' }` | Lấy chi tiết BOM, lines, enrich thông tin SKU/Tên và cờ `requiresSerialTracking` |
| `PATCH` | `/api/v1/bom/:id` | `{ resource: 'bom', action: 'update' }` | Cập nhật header và ghi đè toàn bộ dòng lines trong transaction |
| `DELETE`| `/api/v1/bom/:id` | `{ resource: 'bom', action: 'delete' }` | Xóa mềm BOM (`isDeleted = true`) |

---

## 5. Logic Nghiệp vụ Trọng tâm

### 5.1. Tạo và Cập nhật Lines (Transaction Safety)
- Khi `create` hoặc `update` có mảng `lines`, service chạy trong `dataSource.transaction`.
- Nếu dòng không truyền `uomId`, service tự động query `uom_id` mặc định từ `erp_inventory_items`.
- Số thứ tự `lineNo` được đánh số tự động từ `1..N`.
- Khi `update`, service xóa các dòng cũ (`lineRepo.delete({ bomId: id })`) và chèn các dòng mới để bảo đảm tính toàn vẹn.

### 5.2. Phân rã Đa cấp & Chống Vòng Lặp (`exportMultiLevelBom` & `explodeBom`)
- Thuật toán duyệt đệ quy cây định mức dựa trên `componentItemId` -> tìm BOM ACTIVE tương ứng của linh kiện đó.
- Cột STT dạng đa cấp: `1`, `1.1`, `1.2`, `1.2.1`, `2`, `2.1`...
- **Bảo vệ vòng lặp**: Sử dụng `Set<string>` (hoặc stack kiểm tra đường đi) để phát hiện và ném ngoại lệ nếu BOM A chứa linh kiện B mà BOM B lại chứa A.

### 5.3. Nhận diện Yêu cầu Theo dõi Serial (`requiresSerialTracking`)
- Trong `findOne`, service join với `erp_tracking_policies` của từng linh kiện.
- Nếu policy là `SERIAL` hoặc `CUSTOM` -> `requiresSerialTracking = true`.
- Cờ này được module Sản xuất (`production-core`) sử dụng để tự động sinh các bản ghi phân bổ serial trong bảng `erp_production_order_serial_assignments` (As-Built BOM).

---

## 6. Tích hợp Liên Module

- **`production-core`**:
  - Khi thực hiện Lệnh sản xuất (`executeProduction`) hoặc xem trước định mức (`explodePreview`), gọi `explodeBom` để tính tổng nhu cầu nguyên vật liệu thực tế:  
    $$\text{Nhu cầu} = \text{SL sản xuất} \times \text{Định mức dòng} \times \left(1 + \frac{\text{Hao hụt}}{100}\right)$$
  - Lưu trữ `bomId` vào cột JSONB `output_metadata -> bomId` của Lệnh sản xuất.
- **`inventory-core` & `inventory-stock-core`**:
  - Dùng dữ liệu BOM để tự động đề xuất tạo Phiếu xuất kho sản xuất (Goods Issue).
  - Lọc thành phẩm hợp lệ bằng cờ `CAN_BE_MANUFACTURED` trong `erp_inventory_items`.

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

Khi chỉnh sửa `bom-core`, bắt buộc:
1. Chạy Type-check: `bun run check:ci`
2. Chạy Unit test liên quan: `bunx jest src/bom-core/ --forceExit` hoặc `src/production-core/production-core.service.spec.ts`
3. Xác minh database thật qua `DATABASE_URL` trước khi thay đổi schema/DTO (Gate 0 Precheck).
