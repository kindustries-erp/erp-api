---
name: purchasing
description: Module tri thức Quản lý Mua hàng (Purchase Orders & Purchase Requests) trong erp-api. Chứa toàn bộ database schema, entities, DTOs, API endpoints, logic sinh mã tự động PO-YYYYMM-xxx, quản lý dòng vật tư, theo dõi tiến độ nhập kho (Receipt Timeline), liên kết hóa đơn VAT và kiểm tra ràng buộc chứng từ.
---

# 📦 Module Tri Thức: Quản Lý Mua Hàng (Purchasing / PO & PR) - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Phân hệ Quản lý Mua hàng (bao gồm `purchase-orders-core` và `purchase-requests-core`) đóng vai trò quản lý toàn bộ chu trình thu mua vật tư, linh kiện, nguyên vật liệu từ khâu lập yêu cầu đến đặt hàng và tiếp nhận hàng hóa.

Các nghiệp vụ trọng tâm:
- **Yêu cầu Mua hàng (Purchase Requests - PR)**: Tiếp nhận đề xuất mua sắm từ các bộ phận/nhân viên, quản lý phê duyệt và chuyển đổi sang đơn mua hàng.
- **Đơn Mua hàng (Purchase Orders - PO)**: Lập và quản lý đơn đặt hàng gửi đến Nhà cung cấp (NCC), quản lý đơn giá, số lượng, điều khoản và lịch giao hàng dự kiến.
- **Sinh mã chứng từ tự động theo tháng**: Sinh mã `PO-YYYYMM-xxx` hoặc `PR-YYYYMM-xxx` có cơ chế transaction khóa an toàn tránh trùng mã.
- **Theo dõi Tiến độ Nhập kho (Receipt Timeline)**: Giám sát số lượng đã nhận (`qty_received`) so với số lượng đặt mua (`qty_ordered`) theo thời gian thực kết nối với Phiếu Nhập Kho (`erp_goods_receipts`).
- **Liên kết Hóa đơn Đầu vào (`erp_invoices`)**: Cho phép gán/hủy liên kết các hóa đơn điện tử đầu vào của nhà cung cấp vào đơn mua hàng tương ứng.
- **Đồ thị Kết nối Chứng từ (Connection Graph)**: Truy vết đa chiều từ Đơn mua hàng đến các Phiếu nhập kho (GR), Hóa đơn (Invoices) và Phiếu chi/Ủy nhiệm chi (Payment Vouchers).
- **Ràng buộc Hủy & Xóa Chặt chẽ**: Tích hợp với `DocumentDependenciesCoreService` ngăn chặn việc xóa/hủy đơn PO nếu đã phát sinh phiếu nhập kho hoặc hóa đơn/phiếu chi phụ thuộc.

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Bảng `erp_purchase_orders` (Đơn Mua Hàng)
| Cột | Kiểu dữ liệu | Nullable | Default | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `po_no` | `varchar(255)` | NO | — | Mã đơn mua hàng (Unique Index, định dạng `PO-YYYYMM-xxx`) |
| `supplier_id` | `uuid` | YES | `NULL` | FK tham chiếu `erp_business_partners.id` |
| `order_date` | `timestamptz` | NO | — | Ngày lập đơn mua hàng |
| `expected_date` | `timestamptz` | YES | `NULL` | Ngày dự kiến nhận hàng |
| `status` | `varchar(255)` | NO | `'ACTIVE'` | Trạng thái: `DRAFT`, `APPROVED`, `PARTIAL_RECEIVED`, `RECEIVED`, `FULLY_RECEIVED`, `CANCELLED` |
| `payment_status` | `varchar(255)` | NO | `'UNPAID'` | Trạng thái thanh toán: `UNPAID`, `PARTIAL_PAID`, `PAID` |
| `remarks` | `text` | YES | `NULL` | Ghi chú đơn hàng |
| `supplier_invoice_no` | `varchar(128)`| YES | `NULL` | Số hóa đơn / số chứng từ của NCC |
| `created_by` | `uuid` | YES | `NULL` | ID người tạo đơn |
| `is_deleted` | `boolean` | NO | `false` | Cờ xóa mềm |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật cuối |

### 2.2. Bảng `erp_purchase_order_lines` (Chi Tiết Mặt Hàng Trong PO)
| Cột | Kiểu dữ liệu | Nullable | Default | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `purchase_order_id`| `uuid` | NO | — | FK tham chiếu `erp_purchase_orders.id` |
| `line_no` | `int` | NO | — | Số thứ tự dòng (bắt đầu từ 1) |
| `item_id` | `uuid` | YES | `NULL` | FK tham chiếu `erp_inventory_items.id` |
| `item_code` | `varchar(128)` | YES | `NULL` | Mã mặt hàng snapshot tại thời điểm đặt |
| `item_name` | `varchar(255)` | YES | `NULL` | Tên mặt hàng snapshot |
| `description` | `text` | YES | `NULL` | Mô tả quy cách chi tiết |
| `qty_ordered` | `numeric(18,3)`| NO | — | Số lượng đặt mua |
| `qty_received` | `numeric(18,3)`| NO | `0` | Số lượng đã nhập kho thực tế |
| `unit_price` | `numeric(18,3)`| YES | `NULL` | Đơn giá mua (chưa VAT) |
| `amount` | `numeric(18,3)`| YES | `NULL` | Thành tiền ($= \text{qty\_ordered} \times \text{unit\_price}$) |

### 2.3. Bảng `erp_purchase_requests` (Phiếu Yêu Cầu Mua Hàng)
| Cột | Kiểu dữ liệu | Nullable | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | Khóa chính (PK) |
| `request_no` | `varchar(255)` | NO | Mã phiếu yêu cầu (Unique Index) |
| `request_date` | `timestamptz` | NO | Ngày tạo yêu cầu |
| `requester_employee_id` | `uuid` | YES | FK tham chiếu nhân viên yêu cầu |
| `status` | `varchar(255)` | NO | `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `remarks` | `text` | YES | Ghi chú lý do mua hàng |
| `is_deleted` | `boolean` | NO | Cờ xóa mềm |

---

## 3. Cấu trúc Source Code Backend

```text
src/
├── purchase-orders-core/
│   ├── dto/
│   │   ├── create-purchase-order.dto.ts       # DTO tạo PO kèm mảng nested lines
│   │   ├── create-purchase-order-line.dto.ts  # DTO chi tiết từng dòng mặt hàng
│   │   └── update-purchase-order.dto.ts       # DTO cập nhật PO
│   ├── entities/
│   │   ├── erp_purchase_order.entity.ts       # TypeORM entity bảng erp_purchase_orders
│   │   └── erp_purchase_order_line.entity.ts  # TypeORM entity bảng erp_purchase_order_lines
│   ├── purchase-orders-core.controller.ts     # Controller khai báo các route /purchase-orders
│   ├── purchase-orders-core.service.ts        # Service chứa toàn bộ business logic PO
│   └── purchase-orders-core.module.ts         # NestJS Module đăng ký DI
└── purchase-requests-core/
    ├── dto/
    │   ├── create-purchase-request.dto.ts
    │   └── update-purchase-request.dto.ts
    ├── entities/
    │   ├── erp_purchase_request.entity.ts
    │   └── erp_purchase_request_line.entity.ts
    ├── purchase-requests-core.controller.ts   # Controller khai báo các route /purchase-requests
    ├── purchase-requests-core.service.ts      # Service xử lý yêu cầu mua hàng
    └── purchase-requests-core.module.ts
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Guards: `@UseGuards(JwtAuthGuard, CoreRbacGuard)`

### 4.1. Đơn Mua Hàng (`/api/v1/purchase-orders`)
| Method | Endpoint | RBAC Permission | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/purchase-orders` | `purchase_orders:create` | Tạo mới đơn mua hàng (kèm tự sinh mã `PO-YYYYMM-xxx` và lưu mảng `lines`) |
| `GET` | `/api/v1/purchase-orders` | `purchase_orders:read` | Lấy danh sách PO (hỗ trợ phân trang, lọc đa cột `column_filters`, tìm kiếm, lọc theo NCC, trạng thái, chỉ lấy đơn có thể nhận hàng `only_receivable`) |
| `GET` | `/api/v1/purchase-orders/next-no` | `purchase_orders:read` | Dự báo mã số đơn mua hàng tiếp theo trong tháng |
| `GET` | `/api/v1/purchase-orders/column-options` | `purchase_orders:read` | Lấy danh sách giá trị distinct cho dropdown lọc của bảng đơn PO |
| `GET` | `/api/v1/purchase-orders/items` | `purchase_orders:read` | Lấy danh sách dòng hàng PO chi tiết (hỗ trợ phân trang, lọc theo NCC, tìm kiếm đa cột, sort) |
| `GET` | `/api/v1/purchase-orders/items/column-options` | `purchase_orders:read` | Lấy danh sách distinct options cho bộ lọc các cột bảng dòng hàng PO |
| `GET` | `/api/v1/purchase-orders/supplier-stats/:supplierId` | `purchase_orders:read` | Lấy thống kê tổng hợp số đơn, chi tiêu, đã nhận, tỷ lệ hoàn tất theo nhà cung cấp |
| `GET` | `/api/v1/purchase-orders/:id` | `purchase_orders:read` | Lấy chi tiết đơn mua hàng kèm danh sách dòng hàng và timeline nhập kho |
| `PATCH`| `/api/v1/purchase-orders/:id` | `purchase_orders:update` | Cập nhật thông tin chung và đồng bộ mảng lines của PO |
| `DELETE`| `/api/v1/purchase-orders/:id` | `purchase_orders:delete` | Xóa mềm đơn mua hàng (chỉ cho phép khi ở trạng thái `DRAFT`) |
| `POST` | `/api/v1/purchase-orders/:id/cancel` | `purchase_orders:update` | Hủy đơn mua hàng (kiểm tra không cho hủy nếu đã có hàng nhập hoặc phiếu chi liên quan) |
| `GET` | `/api/v1/purchase-orders/:id/receipts` | `purchase_orders:read` | Lấy lịch sử dòng thời gian các phiếu nhập kho đã thực hiện đối với đơn PO này |
| `GET` | `/api/v1/purchase-orders/:id/connections` | `purchase_orders:read` | Lấy sơ đồ liên kết giữa PO với Goods Receipts, Invoices, Payment Vouchers |
| `GET` | `/api/v1/purchase-orders/:id/invoices` | `purchase_orders:read` | Lấy danh sách các hóa đơn điện tử được liên kết với đơn PO này |
| `POST` | `/api/v1/purchase-orders/:id/link-invoices` | `purchase_orders:update` | Gán danh sách ID hóa đơn vào đơn mua hàng |
| `DELETE`| `/api/v1/purchase-orders/:id/invoices/:invoiceId` | `purchase_orders:update` | Hủy liên kết một hóa đơn khỏi đơn mua hàng |
| `GET` | `/api/v1/purchase-orders/:id/export/excel` | `purchase_orders:read` | Xuất file Excel Bảng kê mua hàng (Mẫu 06-VT) hoặc Phiếu đề xuất mua hàng (Draft) |

### 4.2. Yêu Cầu Mua Hàng (`/api/v1/purchase-requests`)
| Method | Endpoint | RBAC Permission | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/purchase-requests` | `purchase_requests:create` | Tạo mới phiếu yêu cầu mua hàng |
| `GET` | `/api/v1/purchase-requests` | `purchase_requests:read` | Lấy danh sách phiếu yêu cầu mua hàng |
| `GET` | `/api/v1/purchase-requests/:id` | `purchase_requests:read` | Lấy chi tiết phiếu yêu cầu |
| `PATCH`| `/api/v1/purchase-requests/:id` | `purchase_requests:update` | Cập nhật phiếu yêu cầu mua hàng |
| `DELETE`| `/api/v1/purchase-requests/:id` | `purchase_requests:delete` | Xóa phiếu yêu cầu (chỉ khi `status = 'DRAFT'`) |
| `POST` | `/api/v1/purchase-requests/:id/cancel` | `purchase_requests:update` | Hủy phiếu yêu cầu mua hàng |

---

## 5. Logic Nghiệp vụ Trọng tâm

### 5.1. Thuật Toán Sinh Mã Số `PO-YYYYMM-xxx`
- Tiền tố `PO-` kết hợp `YYYYMM-` theo ngày của đơn (`orderDate`).
- Tìm số hiệu lớn nhất đang có trong cơ sở dữ liệu có cùng tiền tố:
  ```sql
  SELECT po_no FROM erp_purchase_orders WHERE po_no LIKE 'PO-202602-%' ORDER BY po_no DESC LIMIT 1;
  ```
- Tăng sequence lên 1 đơn vị và pad số 3 chữ số (`001`, `002`, ...).

### 5.2. Đồng Bộ Hóa Dòng Sản Phẩm (`lines`) Khi Cập Nhật
- Thực hiện bên trong TypeORM database transaction (`dataSource.transaction`).
- Đối sánh theo vị trí index:
  - Nếu dòng cũ đã tồn tại: Cập nhật thông tin (`itemId`, `itemCode`, `itemName`, `qtyOrdered`, `unitPrice`, `amount`).
  - Nếu có dòng mới thêm vào: Tạo mới thực thể `ErpPurchaseOrderLine`.
  - Nếu mảng gửi lên ít hơn số dòng hiện tại: Tự động xóa các dòng thừa (`lineRepo.remove`).

### 5.3. Ràng Buộc Vòng Đời Trạng Thái (Lifecycle State Machine)
- Không cho phép chuyển một đơn hàng đã rời `DRAFT` quay trở lại `DRAFT`.
- Không cho phép hủy hoặc thay đổi trạng thái nếu đơn đã ở trạng thái `RECEIVED` hoặc `FULLY_RECEIVED`.
- Khi hủy hoặc xóa đơn: Bắt buộc gọi `documentDependenciesCoreService.checkDependencies('purchase_orders', id)` để đảm bảo không bị mồ côi dữ liệu chứng từ liên quan.

### 5.4. Lọc Nâng Cao Đơn Hàng Có Thể Nhập Kho (`only_receivable`)
- Lọc các đơn hàng mà tồn tại ít nhất một dòng có:
  $$\text{CAST}(\text{qtyOrdered AS NUMERIC}) > \text{CAST}(\text{qtyReceived AS NUMERIC})$$
- Phục vụ trực tiếp cho màn hình Lập Phiếu Nhập Kho (Goods Receipt) từ Đơn Mua Hàng.

---

## 6. Tích hợp Liên Module

- **`business-partners-core`**: Cung cấp thông tin Nhà cung cấp (`supplierId` -> `erp_business_partners`).
- **`inventory-core` & `inventory-stock-core`**: Định danh vật tư (`itemId` -> `erp_inventory_items`).
- **`goods-receipts-core`**: Khi nhập kho từ PO, hệ thống cập nhật tăng `qty_received` trên các dòng `erp_purchase_order_lines` và chuyển trạng thái PO sang `PARTIAL_RECEIVED` hoặc `RECEIVED`.
- **`erp-invoices-core`**: Cho phép đính kèm các hóa đơn điện tử (`erp_invoices`) vào PO phục vụ đối soát thanh toán.
- **`document-dependencies-core`**: Kiểm tra ràng buộc phụ thuộc trước khi hủy/xóa PO.
- **`reports-core`**: Cung cấp dữ liệu đầu vào cho Dashboard Mua hàng (`getPurchasingDashboard`).

---

## 7. Quy tắc Kiểm thử & QC Mandate

Khi thực hiện chỉnh sửa hoặc refactor phân hệ mua hàng:
1. **Type-check**: `bun run check:ci`
2. **Unit test**:
   ```bash
   bunx jest src/purchase-orders-core/ --forceExit
   bunx jest src/purchase-requests-core/ --forceExit
   ```
3. Đảm bảo toàn bộ các trường `qtyOrdered`, `qtyReceived`, `unitPrice`, `amount` được định dạng `string` / `numeric(18,3)` nhất quán tránh sai lệch số học dấu phẩy động.
