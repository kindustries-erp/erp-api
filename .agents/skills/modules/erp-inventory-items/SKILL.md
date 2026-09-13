---
name: erp-inventory-items
description: Module tri thức Danh mục Mặt hàng & Master Data Kho trong Liouni ERP. Chứa toàn bộ database schema (erp_inventory_items, erp_uoms, erp_item_types, erp_tracking_policies, erp_entity_attribute_values), Module Config EAV engine, DTOs, API endpoints, quy trình quản lý SKU, migration runbook và tích hợp đa module.
---

# 📦 Module Tri Thức: Danh Mục Mặt Hàng & Dữ Liệu Gốc Kho (`erp-inventory-items`)

## 1. Tổng quan Nghiệp vụ & Kiến trúc Module Config EAV

Module `erp-inventory-items` (thuộc phân hệ `inventory-core`) quản lý toàn bộ danh mục vật tư, phụ tùng, linh kiện và thành phẩm trong hệ thống Liouni ERP. Đây là master data nền tảng cho mọi hoạt động Mua hàng (PO), Bán hàng (SO), Sản xuất (BOM & MO), Quản lý Kho và Kế toán giá vốn.

Phân hệ đã được **chuẩn hóa 100% theo kiến trúc Module Config Engine (EAV)**:
1. **Master Data & Ràng buộc toàn vẹn**:
   - `uom_id` (FK $\to$ `erp_uoms`), `item_type_id` (FK $\to$ `erp_item_types`), `tracking_policy_id` (FK $\to$ `erp_tracking_policies`) được duy trì trên bảng vật lý `erp_inventory_items` nhằm bảo toàn hiệu năng và ràng buộc Foreign Key toàn hệ thống.
2. **Dynamic Custom Fields & System Attributes**:
   - Thuộc tính checklist tính năng (`item_features`: `CAN_BE_SOLD`, `CAN_BE_PURCHASED`, `CAN_BE_MANUFACTURED`) cùng mọi trường tùy chỉnh động do quản trị viên cấu hình (như Màu sắc, Kích thước, Thông số kỹ thuật...) được lưu trữ và quản lý thống nhất trong bảng EAV `erp_entity_attribute_values` (`entity_type = 'INVENTORY_ITEM'`).
3. **Đồng nhất API Response 3 trường & Dual-Key Access**:
   - Mọi API truy vấn (`findOne`, `findAll`) tự động trả về 3 trường chuẩn: `attributeValues` (Metadata), `customAttributes` (Key-Value Map hỗ trợ cả Def ID lẫn Code), và `attributes` (Alias tương thích ngược bảo toàn mảng tag) thông qua `EntityCustomFieldsHelper`.

---

## 2. Database Schema & Bảng Ánh Xạ

### 2.1. Bảng `erp_inventory_items` (Mặt hàng / SKU)

| Cột | Kiểu | Nullable | Mặc định | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (Primary Key) |
| `sku` | `varchar(255)` | NO | | Mã SKU duy nhất (Unique Index `idx_inventory_items_sku`) |
| `item_name` | `varchar(255)` | NO | | Tên mặt hàng |
| `uom_id` | `uuid` | NO | | FK $\to$ `erp_uoms.id` (Đơn vị tính) |
| `item_type_id` | `uuid` | NO | | FK $\to$ `erp_item_types.id` (Loại mặt hàng) |
| `tracking_policy_id` | `uuid` | YES | `NULL` | FK $\to$ `erp_tracking_policies.id` (Chính sách tracking) |
| `status` | `varchar(255)` | NO | `'ACTIVE'` | Trạng thái: `ACTIVE`, `INACTIVE` |
| `note` | `text` | YES | `NULL` | Ghi chú mô tả mặt hàng |
| `attributes` | `text[]` | NO | `'{}'` | Cột mảng lưu tags nghiệp vụ (`CAN_BE_SOLD`, `CAN_BE_MANUFACTURED`...) |
| `is_deleted` | `boolean` | NO | `false` | Cờ xóa mềm (Soft delete) |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật |

### 2.2. Bảng Master Data & Bảng Lưu Trữ EAV
- `erp_uoms`: Chứa các ĐVT: `CAI` (Cái), `BO` (Bộ), `CUON` (Cuốn), `CON` (Con), `GRAM` (Gram), `SOI` (Sợi), `CONG` (Công), `PCS` (Piece), `KG`, `LIT`, `MET`, `CHIEC`, `HOP`, `BINH`, `GOI`.
- `erp_item_types`: Chứa phân loại mặt hàng gốc (`RAW` - Linh kiện, `FG` - Thành phẩm, `SERVICE` - Dịch vụ).
- `erp_tracking_policies`: Chứa chính sách định danh (`NONE`, `SERIAL`, `LOT`, `VEHICLE`, `CUSTOM`).
- `erp_entity_attribute_values`: Lưu trữ toàn bộ EAV của SKU (`entity_type = 'INVENTORY_ITEM'`).

### 2.3. Bảng Ánh Xạ Chuẩn Hóa Code & Alias (Normalization Table)

| Field | Mã Trong EAV / Module Config | Mã Gốc / Alias Trong Hệ Thống | Diễn Giải Tiếng Việt |
| :--- | :--- | :--- | :--- |
| **Loại Item** | `RAW_MATERIAL` | `RAW` | Nguyên vật liệu / Linh kiện |
| **Loại Item** | `FINISHED_GOODS` | `FG`, `FINISHED` | Thành phẩm xe / Pin / Cụm lắp ráp |
| **Loại Item** | `SPARE_PART` | `PART` | Phụ tùng / Linh kiện thay thế |
| **Loại Item** | `SERVICE` | `SERVICE` | Dịch vụ sửa chữa / Nhân công |
| **Loại Item** | `SEMI_FINISHED` | `SEMI_FINISHED` | Bán thành phẩm |
| **Loại Item** | `CONSUMABLE` | `CONSUMABLE` | Vật tư tiêu hao (keo, mỡ, ốc...) |
| **Thuộc tính** | `item_features` | `attributes` | `CAN_BE_SOLD`, `CAN_BE_PURCHASED`, `CAN_BE_MANUFACTURED` |

---

## 3. Cấu trúc Source Code

### 3.1. Backend (`erp-api`)
```text
src/inventory-core/
├── entities/
│   ├── erp_inventory_item.entity.ts          # Entity SKU mặt hàng (hỗ trợ customAttributes & attributeValues)
│   ├── erp_uom.entity.ts                     # Entity Đơn vị tính (bảng erp_uoms)
│   ├── erp_item_type.entity.ts               # Entity Loại mặt hàng (bảng erp_item_types)
│   └── erp_tracking_policy.entity.ts         # Entity Chính sách tracking (bảng erp_tracking_policies)
├── dto/
│   ├── create-item.dto.ts                    # DTO tạo SKU (kế thừa BaseEntityCustomFieldsDto)
│   ├── update-item.dto.ts                    # DTO sửa SKU
│   └── inventory-item-query.dto.ts           # DTO phân trang & lọc danh sách SKU
├── services/
│   ├── inventory-items-query.service.ts      # Service query & batch enrichment (EntityCustomFieldsHelper.enrichMany)
│   ├── inventory-items-lifecycle.service.ts  # Service CRUD mặt hàng (EntityCustomFieldsHelper.saveInTx & enrichOne)
│   └── inventory-masters.service.ts          # Service quản lý Master Data (UOM, Item Types, Tracking Policies)
├── inventory-core.controller.ts              # Controller các routes /api/v1/inventory/*
└── inventory-core.module.ts                  # Module NestJS
```

### 3.2. Frontend (`erp-web`)
```text
src/
├── pages/
│   ├── MfgItems.tsx                          # Trang Quản lý Danh mục Mặt hàng chuẩn
│   └── inventory/InventoryStockPage.tsx      # Sổ tổng hợp tồn kho
└── modules/inventory-core/
    ├── api/inventoryCoreApi.ts               # Client API calls cho Items (hỗ trợ customAttributes)
    └── components/
        ├── InventoryItemFormDrawer.tsx       # StandardFormDrawer tích hợp Module Config, tự động normalize code & load masters
        └── InventoryStockLedgerSection.tsx   # Lịch sử xuất nhập và tồn kho của mặt hàng
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/inventory`  
Guards: `JwtAuthGuard`, `CoreRbacGuard`

| Method | Endpoint | Quyền yêu cầu | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/inventory/items` | `{ resource: 'inventory_items', action: 'read' }` | Lấy danh sách mặt hàng (tự động nhúng `customAttributes`, `attributeValues`) |
| `GET` | `/api/v1/inventory/items/column-options` | `{ resource: 'inventory_items', action: 'read' }` | Lấy danh sách distinct options phục vụ filter đa chiều cho DataTable |
| `GET` | `/api/v1/inventory/items/:id` | `{ resource: 'inventory_items', action: 'read' }` | Lấy chi tiết mặt hàng theo ID (nhúng đầy đủ 3 trường Module Config) |
| `GET` | `/api/v1/inventory/items/:id/traceability-graph` | `{ resource: 'inventory_items', action: 'read' }` | Lấy cây đồ thị mạng lưới chứng từ liên kết đa tầng (Traceability Graph Data) giữa Item $\leftrightarrow$ NK $\leftrightarrow$ XK $\leftrightarrow$ MO $\leftrightarrow$ PO $\leftrightarrow$ SO $\leftrightarrow$ BOM |
| `POST` | `/api/v1/inventory/items` | `{ resource: 'inventory_items', action: 'create' }` | Tạo mới mặt hàng (hỗ trợ cả Code, Alias lẫn UUID, lưu `customAttributes` qua Transaction EAV) |
| `PATCH` | `/api/v1/inventory/items/:id` | `{ resource: 'inventory_items', action: 'update' }` | Cập nhật mặt hàng & đồng bộ `customAttributes` |
| `DELETE`| `/api/v1/inventory/items/:id` | `{ resource: 'inventory_items', action: 'delete' }` | Xóa mềm mặt hàng (có kiểm tra an toàn dữ liệu) |

---

## 5. Hướng Dẫn & Runbook Migration Từ Cơ Chế Cũ Sang Cơ Chế Mới

### 5.1. Quy trình Chạy Migration TypeORM
Khi triển khai trên database mới hoặc cập nhật môi trường staging/production:

1. **Chạy TypeORM Migration Runner**:
   ```bash
   cd /home/dev/repos/erp/erp-api
   bun run migration:run
   ```
2. **File Migration Chính**: `src/migrations/1788900000000-MigrateInventoryItemAttributesToModuleConfig.ts`.
3. **Các Bước Migration Thực Hiện Tự Động**:
   - Bổ sung toàn bộ options còn thiếu trong `erp_module_attribute_defs` (`code = 'uom'`, `code = 'item_type'`).
   - Đọc mảng `attributes: text[]` hiện có trên `erp_inventory_items` và insert vào `erp_entity_attribute_values` dưới dạng JSON array chuỗi (`["CAN_BE_SOLD", "CAN_BE_MANUFACTURED"]`).
   - Tự động map và đồng bộ mã UOM (`erp_uoms.code`), Loại Item (`RAW` $\to$ `RAW_MATERIAL`, `FG` $\to$ `FINISHED_GOODS`) và Tracking Policy (`erp_tracking_policies.code`) sang bảng EAV.
   - Thao tác là hoàn toàn Idempotent (không insert trùng lặp).

### 5.2. Nguyên Tắc Lập Trình (Best Practices)
- **Backend Lifecycle Service**:
  - Khi client gửi `itemTypeId`, `uomId`, hoặc `trackingPolicyId` dưới dạng Code string (`RAW_MATERIAL`, `CAI`, `VEHICLE`) hoặc UUID, service tự động phân giải qua `normalizeItemTypeCode` và gán ID vào bảng chính, đồng thời gọi `EntityCustomFieldsHelper.saveInTx` để lưu EAV nguyên tử.
- **Backend Query Service**:
  - Dùng `EntityCustomFieldsHelper.enrichMany` (Batch 1 query) để nhúng `customAttributes` & `attributeValues` cho danh sách mặt hàng.
  - Tự động parse JSON string cho các giá trị mảng như `item_features`.
  - Không bao giờ ghi đè `(item as any).attributes = {}` làm mất mảng tags nghiệp vụ của PostgreSQL entity.
- **Frontend Form Drawer**:
  - Chỉ gọi `moduleConfigApi.getGlobalAttributeDefs("INVENTORY_ITEM")` 1 lần duy nhất trong `loadMasters`.
  - Không gọi lại các API cũ (`listUoms`, `listItemTypes`, `listTrackingPolicies`).
  - Trong `buildForm(item)`: Sử dụng `normalizeItemTypeCode` để khớp mã `item_type` với danh sách options từ Module Config.
  - Hỗ trợ đa tầng fallback cho `item_features`: `customAttributes.item_features` $\to$ `attributeValues` $\to$ `attributes` array.

---

## 6. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

1. **Backend Tests & CI Check**:
   ```bash
   cd /home/dev/repos/erp/erp-api && bun test src/inventory-core
   cd /home/dev/repos/erp/erp-api && bun run check:ci
   ```
2. **Frontend Type Check**:
   ```bash
   cd /home/dev/repos/erp/erp-web && bun run type:check
   ```
