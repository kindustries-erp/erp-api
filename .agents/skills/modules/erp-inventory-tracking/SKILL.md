---
name: erp-inventory-tracking
description: Module tri thức Quản lý Định danh & Truy xuất Nguồn gốc Tồn kho (Serials, VINs, Lots, Custom Barcodes, Serial Lifecycle) trong Liouni ERP. Chứa toàn bộ database schema, API endpoints, DTOs, luồng vòng đời Serial (IN_STOCK -> ASSEMBLED/SOLD), bàn giao xe và bảo hành điện tử.
---

# 📦 Module Tri Thức: Quản Lý Định Danh & Truy Xuất Nguồn Gốc (`erp-inventory-tracking`)

## 1. Tổng quan Nghiệp vụ

Phân hệ `erp-inventory-tracking` (thuộc `inventory-core`) đóng vai trò là **Hub Quản lý Định danh Tập trung (Central Identifier Hub)** cho mọi đơn vị hàng hóa có tính truy xuất nguồn gốc cá thể trong Liouni ERP (Xe điện, Khung sườn, Động cơ, Pin Lithium, Phụ tùng có Serial, Hàng theo Lô sản xuất, Mã Barcode/QR tùy chỉnh).

### 1.1. Các tính năng cốt lõi:
- **Hub Định danh Đa Chính sách (Hub Tracking Pattern)**:
  - Bảng trung tâm `erp_inventory_tracking_serials` đại diện cho mọi định danh cá thể:
    - `VEHICLE`: Quản lý 3 mã độc lập: Số Khung (`vin_no`), Số Máy (`engine_no`), và Số Serial xe (COC số 3 lưu tại `serial_no`), liên kết với `erp_vehicles`.
    - `SERIAL`: Quản lý phụ tùng / linh kiện có Serial riêng của nhà sản xuất.
    - `CUSTOM`: Quản lý mã Barcode/QR định danh nội bộ, liên kết `erp_inventory_tracking_customs`.
    - `LOT`: Quản lý theo số Lô (`lot_no`) với ngày sản xuất và hạn sử dụng trong `erp_inventory_tracking_lots`.
- **Vòng đời Trạng thái Serial (Serial Lifecycle State Machine)**:
  - `IN_STOCK`: Tồn kho khả dụng, sẵn sàng xuất kho hoặc đưa vào lắp ráp.
  - `RESERVED`: Đang giữ chỗ cho Đơn bán hàng (SO) hoặc Lệnh sản xuất (MO).
  - `ISSUED`: Đã xuất kho phục vụ bảo hành hoặc luân chuyển nội bộ.
  - `ASSEMBLED`: Đã lắp ráp thành công vào cụm xe thành phẩm (As-Built BOM Traceability).
  - `SOLD`: Đã xuất bán và bàn giao cho khách hàng / đại lý.
  - `RETURNED`: Khách hàng hoàn trả hoặc nhập thu hồi.
  - `SCRAPPED`: Linh kiện hỏng, phế phẩm, đã hủy bỏ.
- **Bàn Giao Xe & Bảo Hành Điện Tử (`confirmDeliveryBulk`)**:
  - Ghi nhận thông tin bàn giao xe: Đại lý (`dealer_id`), Khách hàng (Tên, SĐT, CCCD, Địa chỉ), Ngày giao hàng (`deliveryDate`).
  - Tự động tạo hoặc cập nhật bản ghi `erp_serial_lifecycles`.
  - Tự động kích hoạt ngày bắt đầu bảo hành `warranty_activated_at = now()`, tính ngày hết hạn bảo hành $\text{warrantyEndDate} = \text{deliveryDate} + \text{warrantyMonths}$.
  - Chuyển trạng thái Serial xe từ `IN_STOCK` / `RESERVED` $\to$ `SOLD`.
- **Truy xuất Nguồn gốc Linh kiện Lắp ráp (As-Built BOM Traceability)**:
  - Cho phép tra cứu bất kỳ Số Khung (VIN) nào để xem toàn bộ danh mục Serial của các linh kiện đã cấu thành nên chiếc xe đó (Pin, Động cơ, Khung, v.v.).
- **Chuẩn hóa UI/UX Bảng Định danh & Tracking (`TrackedGoodsPage.tsx` & `TrackedGoodsDrawer.tsx`)**:
  - Cột STT `#` cố định 40px ở đầu bảng, căn giữa.
  - Chuẩn hóa cột Phiếu xuất kho (`goodsIssueNo`) và Đơn hàng (`soNo`) qua `TableText`, gỡ bỏ icon drawer rải rác.
  - Action Menu: "Xem chi tiết" (Icon `Eye`), "Xem phiếu xuất kho" (Icon `PackageMinus`), "Xem đơn hàng" (Icon `FileText`) trong nhóm `TRA CỨU`, và "Chỉnh sửa" (Icon `Pencil` - mở `TrackedGoodsDrawer` với `initialMode="edit"`) trong nhóm `THAO TÁC`.

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Bảng `erp_inventory_tracking_serials` (Hub Định danh)

| Cột | Kiểu | Nullable | Mặc định | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính |
| `item_id` | `uuid` | YES | `NULL` | FK $\to$ `erp_inventory_items.id` |
| `serial_no` | `varchar(255)` | NO | | Số Serial hoặc Số Serial xe (COC 3) |
| `status` | `varchar(50)` | NO | `'IN_STOCK'` | Trạng thái: `IN_STOCK`, `RESERVED`, `ISSUED`, `ASSEMBLED`, `SOLD`, `RETURNED`, `SCRAPPED` |
| `vin_id` | `uuid` | YES | `NULL` | FK $\to$ `erp_vehicles.id` (Chỉ dùng cho policy `VEHICLE`) |
| `custom_id` | `uuid` | YES | `NULL` | FK $\to$ `erp_inventory_tracking_customs.id` |
| `receipt_line_id` | `uuid` | YES | `NULL` | FK $\to$ `erp_goods_receipt_lines.id` |
| `sales_order_line_id`| `uuid` | YES | `NULL` | FK $\to$ `erp_sales_order_lines.id` |
| `goods_issue_line_id`| `uuid` | YES | `NULL` | FK $\to$ `erp_goods_issue_lines.id` |
| `production_order_id`| `uuid` | YES | `NULL` | FK $\to$ `erp_production_orders.id` |
| `lot_no` | `varchar(255)` | YES | `NULL` | Số lô sản xuất (nếu có) |
| `notes` | `text` | YES | `NULL` | Ghi chú cá thể |
| `attributes` | `jsonb` | YES | `NULL` | Thuộc tính mở rộng tự do (JSONB) |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật |

### 2.2. Bảng `erp_serial_lifecycles` (Vòng đời & Bảo hành Điện tử)

| Cột | Kiểu | Nullable | Mặc định | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính |
| `serial_id` | `uuid` | NO | | FK duy nhất $\to$ `erp_inventory_tracking_serials.id` (Unique Index) |
| `sales_order_id` | `uuid` | YES | `NULL` | FK $\to$ `erp_sales_orders.id` |
| `goods_issue_id` | `uuid` | YES | `NULL` | FK $\to$ `erp_goods_issues.id` |
| `dealer_id` | `uuid` | YES | `NULL` | FK $\to$ `erp_business_partners.id` (Đại lý giao xe) |
| `delivery_date` | `date` | YES | `NULL` | Ngày bàn giao xe |
| `customer_name` | `varchar(255)` | YES | `NULL` | Họ tên khách hàng sở hữu |
| `customer_phone` | `varchar(255)` | YES | `NULL` | SĐT khách hàng |
| `customer_address` | `text` | YES | `NULL` | Địa chỉ |
| `customer_id_number` | `varchar(255)`| YES | `NULL` | Số CCCD/Hộ chiếu |
| `warranty_activated_at`| `timestamptz`| YES | `NULL` | Thời điểm kích hoạt bảo hành điện tử |
| `warranty_months`| `int` | YES | `NULL` | Số tháng bảo hành tiêu chuẩn (vd: 24, 36) |
| `warranty_end_date` | `date` | YES | `NULL` | Ngày hết hạn bảo hành |
| `status` | `varchar(50)` | NO | `'ACTIVE'` | Trạng thái bảo hành |

---

## 3. Cấu trúc Source Code

### 3.1. Backend (`erp-api`)
```text
src/inventory-core/
├── entities/
│   ├── erp_inventory_tracking_serial.entity.ts # Entity Serial/VIN trung tâm
│   ├── erp_inventory_tracking_lot.entity.ts    # Entity Quản lý Lô (Lot)
│   ├── erp_inventory_tracking_custom.entity.ts # Entity Quản lý Custom Barcode
│   └── erp_serial_lifecycle.entity.ts          # Entity Vòng đời & Bảo hành điện tử
├── dto/
│   ├── inventory-serial-query.dto.ts           # DTO phân trang & lọc Serial
│   ├── update-inventory-serial.dto.ts          # DTO sửa thông tin serial
│   ├── confirm-delivery.dto.ts                 # DTO bàn giao xe & kích hoạt bảo hành
│   └── update-serial-lifecycle.dto.ts          # DTO cập nhật vòng đời bảo hành
├── services/
│   ├── inventory-serial.service.ts             # Service nghiệp vụ serial, lifecycles, bàn giao xe
│   ├── inventory-lot.service.ts                # Service quản lý lô và hạn sử dụng
│   └── inventory-custom.service.ts             # Service quản lý barcode tùy chỉnh
└── inventory-core.controller.ts                # Controller các endpoints /api/v1/inventory/serials/*
```

### 3.2. Frontend (`erp-web`)
```text
src/
├── pages/inventory/
│   ├── InventoryTrackingPage.tsx               # Màn hình Quản lý Định danh Xe & Serial chính
│   ├── InventoryTrackingPartsPage.tsx          # Màn hình Serial linh kiện / phụ tùng
│   ├── InventoryTrackingLotPage.tsx            # Màn hình Quản lý Hàng theo Lô (Lot)
│   └── InventoryTrackingCustomPage.tsx         # Màn hình Quản lý Mã Barcode tùy chỉnh
└── modules/inventory-core/components/
    └── AsBuiltBomTable.tsx                     # Bảng hiển thị cây truy xuất As-Built BOM của xe
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Base Controller: `src/inventory-core/inventory-core.controller.ts`  
Guards: `JwtAuthGuard`, `CoreRbacGuard`

| Method | Endpoint | Quyền yêu cầu | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/inventory/serials` | `{ resource: 'inventory_items', action: 'read' }` | Danh sách Serial/VIN (phân trang, search, lọc theo status, trackingPolicy, itemId, SO line, exact search `""`, multi-search `;`, blank filter `__BLANK__` / `(blank)`) |
| `GET` | `/api/v1/inventory/serials/:id` | `{ resource: 'inventory_items', action: 'read' }` | Lấy chi tiết serial kèm thông tin xe (VIN, Engine No), đơn bán và vòng đời bảo hành |
| `PATCH` | `/api/v1/inventory/serials/:id` | `{ resource: 'inventory_items', action: 'update' }` | Cập nhật thông tin serial/lot/ghi chú |
| `GET` | `/api/v1/inventory/serials/column-options` | `{ resource: 'inventory_items', action: 'read' }` | Lấy options distinct theo cột cho header bảng Serial (hỗ trợ param `trackingPolicy`, exact/multi/blank search) |
| `POST` | `/api/v1/inventory/serials/confirm-delivery-bulk` | `{ resource: 'sales_orders', action: 'update' }` | Bàn giao xe hàng loạt: chuyển trạng thái `SOLD`, cập nhật khách hàng & kích hoạt bảo hành |
| `GET` | `/api/v1/inventory/serial-lifecycles` | `{ resource: 'sales_orders', action: 'read' }` | Danh sách hồ sơ vòng đời và bảo hành xe |
| `PATCH` | `/api/v1/inventory/serial-lifecycles/:id` | `{ resource: 'sales_orders', action: 'update' }` | Cập nhật thông tin khách hàng hoặc điều chỉnh hạn bảo hành |
| `GET` | `/api/v1/inventory/lots` | `{ resource: 'inventory_items', action: 'read' }` | Danh sách các Lô hàng (`erp_inventory_tracking_lots`) |
| `GET` | `/api/v1/inventory/customs` | `{ resource: 'inventory_items', action: 'read' }` | Danh sách mã định danh tùy chỉnh (`erp_inventory_tracking_customs`) |

---

## 5. Logic Nghiệp vụ Trọng tâm

### 5.1. Quy trình Bàn Giao Xe Hàng Loạt (`confirmDeliveries`)
1. Nhận danh sách các lượt bàn giao `items: Array<{ serialId, deliveryDate, customerName, customerPhone, customerAddress, customerIdNumber, warrantyMonths, dealerId, salesOrderId }>`.
2. Mở Database Transaction.
3. Với mỗi `serialId`:
   - Khóa bi quan bản ghi Serial trong `erp_inventory_tracking_serials`.
   - Cập nhật `status = 'SOLD'`.
   - Tìm hoặc tạo mới bản ghi trong `erp_serial_lifecycles`.
   - Tính ngày hết hạn bảo hành: $\text{warrantyEndDate} = \text{deliveryDate} + \text{warrantyMonths}$.
   - Kích hoạt `warranty_activated_at = now()`, `activation_source = 'ERP_DELIVERY'`.
4. Commit Transaction và trả về danh sách kết quả đã bàn giao thành công.

### 5.2. Cơ chế Kích hoạt Bảo hành UNVERIFIED (Ghost Flow & Whitelist 200 xe Đợt 3)
1. **Mục đích**: Cho phép khách hàng/đại lý kích hoạt bảo hành sớm khi quét mã QR trên xe dù dữ liệu xe chưa kịp hoàn tất thủ tục nhập kho/sản xuất chính thống.
2. **Whitelist 200 Xe Đợt 3 (`unverified-vehicles-batch3.json`)**:
   - Khi xe chưa có trong bảng `erp_vehicles`, hệ thống **chỉ cho phép** các xe có Số Khung & Số Máy khớp chính xác với 200 xe xuất xưởng Đợt 3 được kích hoạt.
   - Các xe ngoài danh mục sẽ bị từ chối (`found: false, reason: 'NOT_IN_SYSTEM'`).
3. **Quy tắc Số Serial & Prefix `UNVERIFIED_`**:
   - **Luồng UNVERIFIED**: Lưu trực tiếp vào Database `attributes.ghost_serial = 'UNVERIFIED_' + serial_no` (ví dụ: `UNVERIFIED_XDA1754752`).
   - **Luồng Sản Xuất Đúng Quy Trình**: Serial trong bảng `erp_inventory_tracking_serials` lưu số serial chuẩn sạch, **không** có prefix.
4. **Truy vấn & Hiển thị trên ERP**:
   - SQL biểu thức cột `serial_no`:
     ```sql
     COALESCE(s.serial_no, l.attributes->>'ghost_serial', 'UNVERIFIED_' || (l.attributes->>'ghost_vin')) AS serial_no
     ```
   - SQL biểu thức cột màu sơn:
     ```sql
     COALESCE(s.attributes->>'color', l.attributes->>'ghost_color') AS color
     ```

---

## 6. Tích hợp Liên Module

- **`goods-receipts-core`**: Tự động sinh bản ghi Serial khi hoàn tất Phiếu nhập kho hàng hóa có tracking policy `SERIAL` / `VEHICLE`.
- **`production-core`**: Tự động gán các Serial linh kiện `IN_STOCK` theo thuật toán FIFO vào xe thành phẩm (`erp_production_order_serial_assignments`) và chuyển trạng thái serial linh kiện sang `ASSEMBLED`.
- **`sales-orders-core`**: Giữ chỗ Serial cho đơn bán hàng và chuyển trạng thái `SOLD` khi giao xe.

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

1. **TypeCheck**: Chạy `bun run check:ci` trong `erp-api/` và `erp-web/`.
2. **Unit Tests**: Chạy `bunx jest src/inventory-core/services/inventory-serial.service.spec.ts --forceExit`.
