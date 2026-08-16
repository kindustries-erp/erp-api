---
name: erp-inventory-items
description: Module tri thức Danh mục Mặt hàng & Master Data Kho trong Liouni ERP. Chứa toàn bộ database schema (erp_inventory_items, erp_uom, erp_item_types, erp_tracking_policies, erp_tracking_categories), DTOs, API endpoints, quy trình quản lý SKU, ràng buộc xóa mềm và sơ đồ kết nối phụ thuộc (connections/movements).
---

# 📦 Module Tri Thức: Danh Mục Mặt Hàng & Dữ Liệu Gốc Kho (`erp-inventory-items`)

## 1. Tổng quan Nghiệp vụ

Module `erp-inventory-items` (thuộc phân hệ `inventory-core`) quản lý toàn bộ danh mục vật tư, phụ tùng, linh kiện và thành phẩm trong hệ thống Liouni ERP. Đây là master data nền tảng cho mọi hoạt động Mua hàng (PO), Bán hàng (SO), Sản xuất (BOM & MO), Quản lý Kho và Kế toán giá vốn.

### 1.1. Các tính năng cốt lõi:
- **Quản lý Danh mục Mặt hàng (SKU Catalog)**:
  - Mã SKU duy nhất toàn hệ thống (`sku` unique index).
  - Tên mặt hàng (`itemName`), ghi chú kỹ thuật (`note`), trạng thái hoạt động (`status = 'ACTIVE' | 'INACTIVE'`).
  - Phân loại đơn vị tính (`uom_id` FK $\to$ `erp_uom`).
  - Phân loại nhóm hàng (`item_type_id` FK $\to$ `erp_item_types` như NVL, Bán thành phẩm, Thành phẩm, Phụ tùng, Dịch vụ).
- **Chính sách Theo dõi Định danh (Tracking Policies)**:
  - `NONE`: Hàng hóa thông thường, chỉ quản lý số lượng tổng (`qtyOnHand`).
  - `SERIAL`: Quản lý từng mã Serial đơn lẻ của sản phẩm.
  - `LOT`: Quản lý theo số Lô sản xuất / nhập hàng (`lot_no`).
  - `CUSTOM`: Quản lý theo mã barcode/mã quản lý nội bộ tùy chỉnh.
  - `VEHICLE`: Quản lý xe thành phẩm gồm 3 định danh độc lập: Số Khung (VIN), Số Máy (Engine No), và Số Serial xe (COC số 3).
- **Phân nhóm Theo dõi (Tracking Categories)**:
  - Phân loại nhóm quản lý định danh (vd: Khung xe, Động cơ, Pin Lithium, ECU, v.v.).
- **Sơ đồ Kết nối Phụ thuộc (`getItemConnections`)**:
  - Tra cứu trực quan toàn bộ chứng từ phát sinh liên quan đến mặt hàng: Đơn mua hàng (PO), Đơn bán hàng (SO), Phiếu nhập kho (GR), Phiếu xuất kho (GI), Định mức kỹ thuật (BOM), Lệnh sản xuất (MO), Phiếu điều chỉnh (Adjustment).
- **Nhật ký Biến động Mặt hàng (`getMovements`)**:
  - Lịch sử chi tiết từng lần Nhập, Xuất, Điều chỉnh số lượng và đơn giá của mặt hàng theo dòng thời gian.
- **Ràng buộc Xóa An toàn (Safe Soft-Delete)**:
  - Cơ chế xóa mềm (`is_deleted = true`).
  - Chặn xóa mặt hàng nếu đã phát sinh giao dịch kho (`erp_inventory_transactions`), serials (`erp_inventory_tracking_serials`) hoặc có trong định mức BOM đang hoạt động.

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Bảng `erp_inventory_items` (Mặt hàng / SKU)

| Cột | Kiểu | Nullable | Mặc định | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (Primary Key) |
| `sku` | `varchar(255)` | NO | | Mã SKU duy nhất (Unique Index `idx_inventory_items_sku`) |
| `item_name` | `varchar(255)` | NO | | Tên mặt hàng |
| `uom_id` | `uuid` | NO | | FK $\to$ `erp_uom.id` (Đơn vị tính) |
| `item_type_id` | `uuid` | NO | | FK $\to$ `erp_item_types.id` (Loại mặt hàng) |
| `tracking_policy_id` | `uuid` | YES | `NULL` | FK $\to$ `erp_tracking_policies.id` (Chính sách tracking) |
| `tracking_category_id` | `uuid` | YES | `NULL` | FK $\to$ `erp_tracking_categories.id` (Nhóm tracking) |
| `status` | `varchar(255)` | NO | `'ACTIVE'` | Trạng thái: `ACTIVE`, `INACTIVE` |
| `note` | `text` | YES | `NULL` | Ghi chú mô tả mặt hàng |
| `attributes` | `text[]` | NO | `'{}'` | Mảng thuộc tính mở rộng (màu sắc, thông số) |
| `is_deleted` | `boolean` | NO | `false` | Cờ xóa mềm (Soft delete) |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật |

### 2.2. Các Bảng Master Data Danh Mục Liên Quan

#### Bảng `erp_uom` (Đơn vị tính)
- `id` (`uuid`), `code` (`varchar(100)` unique: vd `CAI`, `BO`, `KG`, `LIT`), `name` (`varchar(255)`), `description` (`text`), `is_active` (`boolean`), `is_deleted` (`boolean`).

#### Bảng `erp_item_types` (Loại mặt hàng)
- `id` (`uuid`), `code` (`varchar(100)` unique: vd `RAW_MATERIAL`, `FINISHED_GOODS`, `SPARE_PART`, `SERVICE`), `name` (`varchar(255)`), `description` (`text`), `is_active` (`boolean`), `is_deleted` (`boolean`).

#### Bảng `erp_tracking_policies` (Chính sách theo dõi)
- `id` (`uuid`), `code` (`varchar(50)` unique: `NONE`, `SERIAL`, `LOT`, `CUSTOM`, `VEHICLE`), `name` (`varchar(255)`), `description` (`text`), `is_active` (`boolean`), `is_deleted` (`boolean`).

#### Bảng `erp_tracking_categories` (Nhóm phân loại định danh)
- `id` (`uuid`), `code` (`varchar(100)` unique), `name` (`varchar(255)`), `description` (`text`), `is_active` (`boolean`), `is_deleted` (`boolean`).

---

## 3. Cấu trúc Source Code

### 3.1. Backend (`erp-api`)
```text
src/inventory-core/
├── entities/
│   ├── erp_inventory_item.entity.ts          # Entity SKU mặt hàng
│   ├── erp_uom.entity.ts                     # Entity Đơn vị tính
│   ├── erp_item_type.entity.ts               # Entity Loại mặt hàng
│   ├── erp_tracking_policy.entity.ts         # Entity Chính sách tracking
│   └── erp_tracking_category.entity.ts       # Entity Nhóm tracking
├── dto/
│   ├── create-item.dto.ts                    # DTO tạo SKU (sku, itemName, uomId, itemTypeId, trackingPolicyId, etc.)
│   ├── update-item.dto.ts                    # DTO sửa SKU
│   ├── inventory-item-query.dto.ts           # DTO phân trang & lọc danh sách SKU
│   ├── create-uom.dto.ts / update-uom.dto.ts # DTOs đơn vị tính
│   └── create-item-type.dto.ts               # DTOs loại mặt hàng
├── services/
│   ├── inventory-items-query.service.ts      # Service truy vấn tìm kiếm, filter, phân trang SKU
│   ├── inventory-items-lifecycle.service.ts  # Service CRUD mặt hàng, soft-delete guards, connections, movements
│   └── inventory-masters.service.ts          # Service quản lý Master Data (UOM, Item Types, Tracking Policies)
├── inventory-core.controller.ts              # Controller các routes /api/v1/inventory/*
└── inventory-core.service.ts                 # Facade service tích hợp các domain services
```

### 3.2. Frontend (`erp-web`)
```text
src/
├── pages/
│   ├── MfgItems.tsx                          # Trang Quản lý Danh mục Vật tư / Mặt hàng chuẩn
│   └── inventory/
│       ├── InventoryUomPage.tsx              # Trang Quản lý Đơn vị tính (UOM)
│       ├── InventoryItemTypesPage.tsx        # Trang Quản lý Loại mặt hàng
│       └── InventoryTrackingCategoriesPage.tsx # Trang Quản lý Nhóm Tracking
└── modules/inventory-core/
    ├── api/inventoryCoreApi.ts               # Client API calls cho Items và Master data
    ├── components/
    │   ├── InventoryItemFormDrawer.tsx       # StandardFormDrawer tạo/sửa thông tin mặt hàng
    │   └── InventoryStockLedgerSection.tsx   # Hiển thị lịch sử xuất nhập và tồn kho của mặt hàng
    └── hooks/useInventoryGraph.ts            # Hook vẽ sơ đồ quan hệ phụ thuộc chứng từ (connections)
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/inventory`  
Guards: `JwtAuthGuard`, `CoreRbacGuard`

| Method | Endpoint | Quyền yêu cầu | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/inventory/items` | `{ resource: 'inventory_items', action: 'read' }` | Lấy danh sách mặt hàng (phân trang, search, lọc theo itemTypeId, trackingPolicy) |
| `GET` | `/api/v1/inventory/items/:id` | `{ resource: 'inventory_items', action: 'read' }` | Lấy chi tiết mặt hàng theo ID |
| `POST` | `/api/v1/inventory/items` | `{ resource: 'inventory_items', action: 'create' }` | Tạo mới mặt hàng (tự động khởi tạo bản ghi `erp_inventory_balances` ban đầu) |
| `PATCH` | `/api/v1/inventory/items/:id` | `{ resource: 'inventory_items', action: 'update' }` | Cập nhật thông tin mặt hàng |
| `DELETE`| `/api/v1/inventory/items/:id` | `{ resource: 'inventory_items', action: 'delete' }` | Xóa mềm mặt hàng (có kiểm tra an toàn dữ liệu) |
| `GET` | `/api/v1/inventory/items/:id/connections` | `{ resource: 'inventory_items', action: 'read' }` | Lấy sơ đồ quan hệ chứng từ phụ thuộc (PO, SO, GR, GI, MO, BOM) |
| `GET` | `/api/v1/inventory/items/:id/movements` | `{ resource: 'inventory_items', action: 'read' }` | Lấy dòng lịch sử xuất nhập tồn của mặt hàng |
| `GET` | `/api/v1/inventory/items/balances` | `{ resource: 'inventory_items', action: 'read' }` | Lấy số dư tồn kho tức thời cho danh sách ID mặt hàng |
| `GET` | `/api/v1/inventory/uoms` | `{ resource: 'inventory_items', action: 'read' }` | Danh sách đơn vị tính |
| `POST` | `/api/v1/inventory/uoms` | `{ resource: 'inventory_items', action: 'create' }` | Tạo mới đơn vị tính |
| `PATCH` | `/api/v1/inventory/uoms/:id` | `{ resource: 'inventory_items', action: 'update' }` | Sửa đơn vị tính |
| `DELETE`| `/api/v1/inventory/uoms/:id` | `{ resource: 'inventory_items', action: 'delete' }` | Xóa mềm đơn vị tính |
| `GET` | `/api/v1/inventory/item-types` | `{ resource: 'inventory_items', action: 'read' }` | Danh sách loại mặt hàng |
| `GET` | `/api/v1/inventory/tracking-policies` | `{ resource: 'inventory_items', action: 'read' }` | Danh sách chính sách theo dõi định danh |
| `GET` | `/api/v1/inventory/tracking-categories` | `{ resource: 'inventory_items', action: 'read' }` | Danh sách nhóm phân loại tracking |

---

## 5. Logic Nghiệp vụ Trọng tâm

### 5.1. Quy trình Tạo Mặt Hàng Mới (`create`)
1. Kiểm tra tính hợp lệ của mã SKU (không trùng với SKU khác chưa bị xóa).
2. Kiểm tra sự tồn tại của `uomId` và `itemTypeId`.
3. Lưu bản ghi vào bảng `erp_inventory_items`.
4. Tự động khởi tạo bản ghi số dư ban đầu trong `erp_inventory_balances` với `warehouse_code = 'MAIN'`, `qty_on_hand = 0`, `qty_reserved = 0`, `avg_unit_cost = 0`.

### 5.2. Quy trình Xóa Mềm An Toàn (`softDeleteItem`)
1. Kiểm tra tồn tại mặt hàng trong DB.
2. Kiểm tra xem mặt hàng đã phát sinh số lượng tồn kho $> 0$ trong `erp_inventory_balances` hay chưa.
3. Kiểm tra số lượng Serial đã tạo trong `erp_inventory_tracking_serials`.
4. Nếu mặt hàng đã có phát sinh giao dịch nghiệp vụ: Cập nhật `is_deleted = true` và `status = 'INACTIVE'`, giữ nguyên dữ liệu lịch sử để đảm bảo tính toàn vẹn kiểm toán (Audit Trail).

---

## 6. Tích hợp Liên Module

- **`purchase-orders-core` & `goods-receipts-core`**: Dùng SKU để tạo dòng đơn mua và phiếu nhập kho.
- **`sales-orders-core` & `goods-issues-core`**: Dùng SKU để tạo đơn bán và phiếu xuất kho giao khách.
- **`bom-core` & `production-core`**: Dùng SKU làm thành phẩm hoặc nguyên vật liệu định mức trong lệnh sản xuất.

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

1. **TypeCheck**: Chạy `bun run check:ci` trong `erp-api/` và `erp-web/`.
2. **Unit Tests**: Chạy `bunx jest src/inventory-core/services/inventory-items-query.service.spec.ts --forceExit`.
