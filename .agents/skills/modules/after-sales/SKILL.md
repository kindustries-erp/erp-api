---
name: after-sales
description: Module tri thức Quản lý Sau bán hàng, Vòng đời Serial Xe/Linh kiện, Bàn giao Xe & Bảo hành Điện tử (After-Sales & Warranty Lifecycles) trong erp-api (inventory-core & public-warranty). Chứa toàn bộ database schema, entities, DTOs, API endpoints, logic bàn giao xe, kích hoạt bảo hành, tra cứu công khai và xử lý ghost lifecycles.
---

# 🛡️ Module Tri Thức: Quản Lý Sau Bán Hàng & Bảo Hành Điện Tử - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Phân hệ Sau Bán Hàng (`after-sales`, tích hợp giữa `inventory-core`, `public-warranty` và `sales-service-orders-core`) quản lý toàn bộ quá trình bàn giao xe thành phẩm, kích hoạt & theo dõi bảo hành điện tử, quản lý thông tin chủ sở hữu (khách hàng cuối & đại lý phân phối) và hỗ trợ tra cứu bảo hành công khai.

### 1.1. Các tính năng cốt lõi:
- **Quản lý Vòng Đời & Hồ Sơ Sau Bán Hàng (`erp_serial_lifecycles`)**:
  - Lưu trữ thông tin định danh cá thể xe/linh kiện (`serial_id`, `vin_id`, `engine_no`, `so_no`).
  - Ghi nhận thông tin đại lý phụ trách bàn giao (`dealer_id`, `dealer_name`).
  - Ghi nhận thông tin chủ sở hữu phương tiện: Họ tên (`customer_name`), Số điện thoại (`customer_phone`), Địa chỉ (`customer_address`), Số CCCD/Hộ chiếu (`customer_id_number`).
- **Bàn Giao Xe & Kích Hoạt Vòng Đời Hàng Loạt (`confirmDeliveries`)**:
  - Ghi nhận ngày bàn giao xe thực tế (`delivery_date`).
  - Cập nhật trạng thái Serial sang `SOLD` và Vehicle sang `SOLD`.
  - Cập nhật trạng thái Đơn bán hàng liên quan (`DELIVERING` $\to$ `DELIVERED`).
- **Bảo Hành Điện Tử Chuẩn Hóa**:
  - **Mã bảo hành điện tử (`warrantyCode`)**: Tự động sinh theo công thức chuẩn:  
    $$\text{warrantyCode} = \text{"WRN-" + YYYYMMDD(activatedAt) + "-" + VIN/Serial[-6:]}$$
    *(Ví dụ: `WRN-20260819-123456`)*.
  - **Tính toán hạn bảo hành tự động**:  
    $$\text{warrantyEndDate} = \text{warrantyActivatedAt} + \text{warrantyMonths}\text{ (tháng)}$$
  - **3 Trạng thái Bảo hành**:
    - `NOT_ACTIVATED`: Chưa kích hoạt (`warranty_activated_at IS NULL`).
    - `ACTIVE`: Đang trong hạn bảo hành (`warranty_activated_at IS NOT NULL` và $\text{warrantyEndDate} \ge \text{CURRENT\_DATE}$).
    - `EXPIRED`: Đã hết hạn bảo hành ($\text{warrantyEndDate} < \text{CURRENT\_DATE}$).
- **Cổng Tra Cứu & Kích Hoạt Công Khai (`public-warranty`)**:
  - Endpoint mở cho khách hàng tra cứu trạng thái bảo hành qua Số Khung (VIN) và Số Máy (Engine No).
  - Tự kích hoạt bảo hành trực tuyến cho khách mua xe mới.
- **Cơ Chế "Ghost Lifecycle" An Toàn**:
  - Hỗ trợ lưu trữ và kích hoạt bảo hành tạm thời (`attributes->>'is_ghost' = 'true'`) đối với các xe đã lưu thông thực tế nhưng chưa hoàn tất thủ tục nhập kho/sản xuất trên hệ thống ERP, tránh gián đoạn dịch vụ của khách hàng.

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Bảng `erp_serial_lifecycles` (Hồ Sơ Vòng Đời & Bảo Hành)

| Cột | Kiểu | Nullable | Mặc định | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `serial_id` | `uuid` | NO | | FK duy nhất tham chiếu `erp_inventory_tracking_serials.id` (Unique Index) |
| `sales_order_id` | `uuid` | YES | `NULL` | FK tham chiếu `erp_sales_orders.id` |
| `goods_issue_id` | `uuid` | YES | `NULL` | FK tham chiếu `erp_goods_issues.id` |
| `dealer_id` | `uuid` | YES | `NULL` | FK tham chiếu `erp_business_partners.id` (Đại lý giao xe) |
| `delivery_date` | `date` | YES | `NULL` | Ngày thực tế bàn giao xe cho khách |
| `customer_name` | `varchar(255)` | YES | `NULL` | Họ tên khách hàng sở hữu |
| `customer_phone` | `varchar(255)` | YES | `NULL` | SĐT khách hàng |
| `customer_address` | `text` | YES | `NULL` | Địa chỉ cư trú của khách hàng |
| `customer_id_number` | `varchar(255)`| YES | `NULL` | Số CMND / CCCD / Hộ chiếu |
| `warranty_activated_at`| `timestamptz`| YES | `NULL` | Thời điểm kích hoạt bảo hành điện tử |
| `warranty_months` | `int` | YES | `36` | Thời hạn bảo hành tiêu chuẩn (tháng) |
| `warranty_end_date` | `date` | YES | `NULL` | Ngày hết hạn bảo hành |
| `status` | `varchar(50)` | NO | `'ACTIVE'` | Trạng thái hồ sơ bảo hành |
| `notes` | `text` | YES | `NULL` | Ghi chú sau bán hàng |
| `attributes` | `jsonb` | YES | `NULL` | JSONB metadata (`dealer_name`, `ghost_vin`, `ghost_engine`, `is_ghost`) |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật |

### 2.2. Bảng `erp_inventory_tracking_serials` (Tracking Serial Xe)

| Cột | Kiểu | Nullable | Ghi chú |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | Khóa chính (PK) |
| `serial_no` | `varchar(255)` | NO | Số Serial xe / Mã COC 3 |
| `vin_id` | `uuid` | YES | FK tham chiếu `erp_vehicles.id` |
| `status` | `varchar(50)` | NO | `IN_STOCK`, `RESERVED`, `DELIVERING`, `SOLD` |
| `attributes` | `jsonb` | YES | Chứa màu xe (`attributes->>'color'`), đại lý (`attributes->>'dealer_name'`) |

---

## 3. Cấu trúc Source Code Backend

```text
src/
├── inventory-core/
│   ├── entities/
│   │   ├── erp_serial_lifecycle.entity.ts          # TypeORM Entity erp_serial_lifecycles
│   │   └── erp_inventory_tracking_serial.entity.ts # TypeORM Entity erp_inventory_tracking_serials
│   ├── dto/
│   │   ├── confirm-delivery.dto.ts                 # DTO xác nhận giao hàng & bàn giao xe
│   │   └── update-serial-lifecycle.dto.ts          # DTO cập nhật thông tin khách hàng & bảo hành
│   ├── services/
│   │   └── inventory-serial.service.ts             # Service chứa listSerialLifecycles, updateSerialLifecycle, confirmDeliveries
│   └── inventory-core.controller.ts                # REST Controller khai báo các route /serial-lifecycles/*
├── public-warranty/
│   ├── dto/
│   │   ├── check-warranty.dto.ts                   # DTO kiểm tra bảo hành qua VIN & Engine No
│   │   └── activate-warranty.dto.ts                # DTO kích hoạt bảo hành công khai
│   ├── public-warranty.controller.ts               # Controller công khai (No Auth) /api/v1/public-warranty/*
│   ├── public-warranty.service.ts                  # Service tra cứu và kích hoạt bảo hành (hỗ trợ Ghost lifecycles)
│   └── public-warranty.module.ts                   # Module công khai
└── sales-service-orders-core/
    ├── sales-service-orders-core.controller.ts     # Controller bridge cho đơn dịch vụ / bán hàng
    ├── sales-service-orders-core.service.ts        # Service chuyển đổi SO sang định dạng chứng từ dịch vụ
    └── sales-service-orders-core.module.ts         # Module đăng ký
```

---

## 4. Danh sách API Endpoints & RBAC Contract

### 4.1. Phân hệ Quản Trị Sau Bán Hàng (`inventory-core`)
Base Route: `/api/v1/inventory`  
Guards: `@UseGuards(JwtAuthGuard, CoreRbacGuard)`

| Method | Endpoint | Query / Body Params | RBAC Permission | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/inventory/serial-lifecycles` | `page, pageSize, search, warrantyStatus, dealerId, column_filters, column_search, sortField, sortOrder` | `sales_orders:read` | Lấy danh sách hồ sơ xe sau bán hàng, tra cứu thông tin khách, đại lý, trạng thái bảo hành và mã WRN |
| `GET` | `/api/v1/inventory/serial-lifecycles/column-options` | `column, search, page, pageSize, column_filters` | `sales_orders:read` | Lấy danh sách tùy chọn lọc dữ liệu theo cột cho bảng AfterSales |
| `PATCH` | `/api/v1/inventory/serial-lifecycles/:id` | `id: UUID` (serialId), `UpdateSerialLifecycleDto` | `sales_orders:update` | Cập nhật thông tin khách hàng, CCCD, địa chỉ, ngày kích hoạt bảo hành, số tháng bảo hành, đại lý |
| `POST` | `/api/v1/inventory/serials/confirm-delivery-bulk` | `ConfirmDeliveriesDto` (`deliveryDate, serialIds, notes`) | `sales_orders:update` | Bàn giao xe hàng loạt, chuyển trạng thái Serial sang `SOLD`, cập nhật `delivery_date` |

### 4.2. Phân hệ Tra Cứu Bảo Hành Công Khai (`public-warranty`)
Base Route: `/api/v1/public-warranty` (Public - Không yêu cầu JWT Auth)

| Method | Endpoint | Body Params | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/public-warranty/check` | `vin_no: string, engine_no: string` | Tra cứu trạng thái bảo hành của phương tiện (hỗ trợ cả xe đã xác thực và xe ghost) |
| `POST` | `/api/v1/public-warranty/activate` | `vin_no, engine_no, customer_name, customer_phone, customer_address, dealer_name` | Kích hoạt bảo hành điện tử trực tuyến |

---

## 5. Logic Nghiệp vụ Trọng tâm

### 5.1. Tự Động Tính Hạn Bảo Hành Khi Cập Nhật (`updateSerialLifecycle`)
```typescript
if (lifecycle.warrantyActivatedAt && lifecycle.warrantyMonths) {
  const endDate = new Date(lifecycle.warrantyActivatedAt);
  endDate.setMonth(endDate.getMonth() + lifecycle.warrantyMonths);
  lifecycle.warrantyEndDate = endDate.toISOString().split('T')[0];
}
```

### 5.2. Công Thức Sinh Mã Bảo Hành Điện Tử (`warrantyCode`)
```typescript
const warrantyCode = row.warranty_activated_at
  ? `WRN-${new Date(row.warranty_activated_at).toISOString().slice(0, 10).replace(/-/g, '')}-${(row.vin_no || row.serial_no || '000000').slice(-6)}`
  : null;
```

### 5.3. Quy Tắc Tìm Kiếm Đa Từ Khóa (Multi-keyword OR Matching)
Tại các trường tìm kiếm cột (`column_search`), người dùng có thể nhập nhiều từ khóa ngăn cách bởi dấu chấm phẩy (`;`), hệ thống tự động tách và nối điều kiện bằng mệnh đề `OR`:
```typescript
const keywords = (val as string).split(';').map((k) => k.trim()).filter(Boolean);
if (keywords.length > 0) {
  const conditions = keywords.map(() => `CAST(${searchField} AS TEXT) ILIKE $${paramIdx++}`);
  sql += ` AND (${conditions.join(' OR ')})`;
}
```

---

## 6. Tích hợp Liên Module & Frontend

- **Frontend Web (`erp-web`)**:
  - Giao diện quản trị sau bán hàng: `src/modules/after-sales/components/AfterSalesPage.tsx` và `AfterSalesListPage.tsx`.
  - Form Drawer chỉnh sửa thông tin bảo hành & khách hàng: `AfterSalesDrawer.tsx`.
  - Hook truy vấn dữ liệu: `useAfterSalesQuery.ts` gọi `inventoryCoreApi.listSerialLifecycles`.
- **`inventory-core`**: Lưu trữ định danh serials và điều phối trạng thái tồn kho (`SOLD`).
- **`sales-orders-core`**: Đồng bộ trạng thái giao hàng của đơn bán hàng khi hoàn tất bàn giao xe.
- **`business-partners-core`**: Cung cấp master data danh sách đại lý và khách hàng.

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng

```bash
# 1. Chạy linter và typecheck
bun run check:ci

# 2. Chạy test cho inventory-core
bunx jest src/inventory-core/ --forceExit

# 3. Build kiểm tra runtime artifact
bun run build
```
