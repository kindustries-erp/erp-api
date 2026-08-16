---
name: production-core
description: Module tri thức Quản lý Lệnh sản xuất (Production Orders / Manufacturing Orders) trong erp-api. Chứa toàn bộ database schema, entities, DTOs, API endpoints, logic phân rã BOM, As-Built BOM FIFO serial assignment, quy trình 2 giai đoạn (xuất NVL -> nhập thành phẩm) và tích hợp liên module.
---

# 📦 Module Tri Thức: Quản lý Lệnh Sản Xuất (Production Orders) - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Module Quản lý Lệnh sản xuất (`production-core` / `erp-productions`) quản lý toàn bộ vòng đời của Lệnh sản xuất (Manufacturing Order - MO) từ khâu lập kế hoạch, giữ chỗ nguyên vật liệu, xuất kho linh kiện đến khâu nghiệm thu nhập kho thành phẩm và truy xuất nguồn gốc linh kiện (As-Built BOM Traceability).

### 1.1. Các tính năng cốt lõi:
- **Tự động sinh mã lệnh sản xuất**: Quy tắc `MO-YYYYMMxxxx` (vd: `MO-2026080001`).
- **Phân rã BOM đa cấp & Thay thế linh kiện (`materialOverrides`)**: Tự động duyệt cây BOM thành phẩm theo số lượng cần sản xuất, tính toán hao hụt và hỗ trợ thay thế linh kiện tương đương (Alternative Items).
- **Vòng đời lệnh sản xuất**:
  - `DRAFT`: Bản nháp kế hoạch (không yêu cầu kiểm tra tồn kho).
  - `CONFIRMED`: Đã duyệt kế hoạch $\to$ tự động giữ chỗ nguyên vật liệu (`qtyReserved` trong `erp_inventory_balances`).
  - `IN_PROGRESS`: Đang thực hiện sản xuất $\to$ đã xuất ít nhất 1 đợt nguyên vật liệu.
  - `COMPLETED`: Đã nhập kho đủ 100% số lượng thành phẩm mục tiêu.
  - `CANCELLED`: Hủy lệnh $\to$ hoàn trả tồn kho giữ chỗ hoặc hoàn nhập vật tư chưa sử dụng.
- **Quy trình sản xuất 2 giai đoạn (Shop Floor Execution)**:
  - **Giai đoạn 1 — Bắt đầu sản xuất (`startProduction`)**: Xuất kho NVL theo tỷ lệ sản xuất, tự động tạo Phiếu xuất kho (`erp_goods_issues` mã `XK-YYYYMMxxx`) và ghi sổ giao dịch kho (`erp_inventory_transactions`).
  - **Giai đoạn 2 — Hoàn thành sản xuất (`completeProduction`)**: Kiểm tra tracking policy của thành phẩm (`VEHICLE`, `SERIAL`, `LOT`, `NONE`), tự động tạo Phiếu nhập kho thành phẩm (`erp_goods_receipts` mã `NK-YYYYMMxxx`), cập nhật tồn kho `qtyOnHand` và giá vốn bình quân gia quyền.
- **Truy xuất nguồn gốc As-Built BOM (FIFO Serial Assignment)**:
  - Với thành phẩm dạng Xe (`VEHICLE`), tạo bản ghi trong `erp_vehicles` (VIN, số máy, màu sắc) và `erp_inventory_tracking_serials`.
  - Tự động quét các dòng BOM linh kiện có tracking policy là `SERIAL` hoặc `CUSTOM`, lấy các serial `IN_STOCK` cũ nhất (FIFO) và gán vào bảng `erp_production_order_serial_assignments`, đồng thời chuyển trạng thái serial linh kiện thành `ASSEMBLED`.
- **Xuất biên bản Lệnh sản xuất ra Excel (`exportXlsx`)**: Tạo file `.xlsx` định dạng tiêu chuẩn chứa thông tin lệnh, danh mục NVL định mức và danh sách xe/serial đã hoàn thành.

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Bảng `erp_production_orders` (Header)

| Cột | Kiểu | Nullable | Mặc định | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (Primary Key) |
| `reference_no` | `varchar(255)` | NO | | Mã lệnh sản xuất (vd: `MO-2026080001`) |
| `finished_good_item_id` | `uuid` | NO | | FK tới `erp_inventory_items.id` (Mặt hàng thành phẩm) |
| `qty_to_produce` | `numeric(18, 3)`| NO | | Số lượng thành phẩm cần sản xuất theo kế hoạch |
| `qty_produced` | `numeric(18, 3)`| NO | `0` | Số lượng thành phẩm đã hoàn thành nhập kho lũy kế |
| `planned_start_date` | `date` | YES | `NULL` | Ngày dự kiến bắt đầu |
| `planned_end_date` | `date` | YES | `NULL` | Ngày dự kiến hoàn thành |
| `warehouse_code` | `varchar(100)` | YES | `NULL` | Mã kho thực hiện sản xuất |
| `status` | `varchar(50)` | NO | `'POSTED'` | Trạng thái: `DRAFT`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| `output_metadata` | `jsonb` | YES | `NULL` | Lưu `bomId`, `explosionTree`, `materialOverrides` |
| `notes` | `text` | YES | `NULL` | Ghi chú lệnh |
| `created_by` | `uuid` | YES | `NULL` | ID người tạo lệnh |
| `is_deleted` | `boolean` | NO | `false` | Cờ xóa mềm (Soft delete) |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật |

### 2.2. Bảng `erp_production_order_materials` (Định mức NVL thực tế cho Lệnh)

| Cột | Kiểu | Nullable | Mặc định | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (Primary Key) |
| `production_order_id` | `uuid` | NO | | FK tham chiếu tới `erp_production_orders.id` |
| `item_id` | `uuid` | NO | | FK tới `erp_inventory_items.id` (Linh kiện / NVL) |
| `qty_required` | `numeric(18, 3)`| NO | | Tổng số lượng NVL cần cho toàn bộ lệnh |
| `qty_issued` | `numeric(18, 3)`| NO | `0` | Số lượng NVL thực tế đã xuất kho qua các đợt |
| `unit_cost` | `numeric(18, 3)`| YES | `NULL` | Giá vốn đơn vị tại thời điểm tạo/xuất |
| `amount` | `numeric(18, 3)`| YES | `NULL` | Thành tiền NVL định mức (`qtyRequired * unitCost`) |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo |

### 2.3. Bảng `erp_production_order_serial_assignments` (As-Built BOM Linh kiện $\to$ Xe)

| Cột | Kiểu | Nullable | Mặc định | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính |
| `production_order_id` | `uuid` | NO | | FK tới `erp_production_orders.id` (Index `idx_po_serial_asgn_production_order`) |
| `vehicle_id` | `uuid` | NO | | FK tới `erp_vehicles.id` (Index `idx_po_serial_asgn_vehicle`) |
| `bom_line_id` | `uuid` | YES | `NULL` | FK tới `erp_bom_lines.id` |
| `serial_id` | `uuid` | NO | | FK tới `erp_inventory_tracking_serials.id` (Unique Index `idx_po_serial_asgn_serial`) |
| `assigned_at` | `timestamptz` | NO | | Thời điểm gán linh kiện vào xe |
| `assignment_source` | `varchar(50)` | NO | `'AUTO_FIFO'`| Nguồn gán: `AUTO_FIFO`, `MANUAL_SCAN`, `QR_SCAN` |
| `checkpoint_id` | `uuid` | YES | `NULL` | FK tới `erp_production_checkpoints.id` (Trạm lắp ráp) |
| `worker_id` | `uuid` | YES | `NULL` | FK tới `users.id` (Công nhân thao tác) |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo |

### 2.4. Bảng `erp_production_checkpoints` (Danh mục Trạm lắp ráp dây chuyền)

| Cột | Kiểu | Nullable | Mặc định | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính |
| `code` | `varchar(100)` | NO | | Mã trạm duy nhất (vd: `CP-FRAME`, `CP-ENGINE`, `CP-BATTERY`, `CP-QC`) |
| `name` | `varchar(255)` | NO | | Tên trạm lắp ráp |
| `sort_order` | `int` | NO | `0` | Thứ tự hiển thị / quy trình trên dây chuyền |
| `is_active` | `boolean` | NO | `true` | Trạng thái hoạt động |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo |

---

## 3. Cấu trúc Source Code Backend

```text
src/production-core/
├── entities/
│   ├── erp_production_order.entity.ts                    # Entity lệnh sản xuất
│   ├── erp_production_order_material.entity.ts           # Entity định mức NVL của lệnh
│   ├── erp_production_order_serial_assignment.entity.ts  # Entity As-Built BOM gán serial vào xe
│   └── erp_production_checkpoint.entity.ts               # Entity trạm kiểm tra / công đoạn
├── dto/
│   ├── execute-production.dto.ts                         # DTO tạo mới lệnh & phân rã BOM
│   ├── start-production.dto.ts                           # DTO xuất kho NVL theo tỷ lệ
│   ├── complete-production.dto.ts                        # DTO nhập kho thành phẩm & định danh xe/serial
│   └── list-production.dto.ts                            # DTO phân trang, lọc và tìm kiếm lệnh
├── production-core.controller.ts                         # Controller routing, guards, Swagger, RBAC
├── production-core.service.ts                            # Toàn bộ business logic, transaction, stock, FIFO As-Built, Excel export
├── production-core.service.spec.ts                       # Unit tests
└── production-core.module.ts                             # NestJS module khai báo TypeORM entities & providers
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/production`  
Guards: `JwtAuthGuard`, `CoreRbacGuard`

| Method | Endpoint | Quyền yêu cầu | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/production/orders` | `{ resource: 'production', action: 'read' }` | Danh sách lệnh sản xuất (phân trang, search, lọc theo trạng thái, thành phẩm, ngày) |
| `GET` | `/api/v1/production/orders/next-reference-no` | `{ resource: 'production', action: 'read' }` | Tự động sinh mã lệnh tiếp theo (`MO-YYYYMMxxxx`) |
| `GET` | `/api/v1/production/orders/column-options` | `{ resource: 'production', action: 'read' }` | Lấy danh sách options distinct cho bộ lọc header cột DataTable |
| `GET` | `/api/v1/production/explode-preview` | `{ resource: 'production', action: 'read' }` | Xem trước cây phân rã định mức BOM và danh sách NVL cần thiết theo số lượng |
| `GET` | `/api/v1/production/orders/:id` | `{ resource: 'production', action: 'read' }` | Lấy chi tiết lệnh sản xuất kèm danh sách NVL (`materials`), tiến độ, xe và serials đã tạo |
| `GET` | `/api/v1/production/orders/:id/export-xlsx` | `{ resource: 'production', action: 'read' }` | Xuất biên bản Lệnh sản xuất ra file Excel `.xlsx` |
| `POST`| `/api/v1/production/execute` | `{ resource: 'production', action: 'create' }` | Tạo mới lệnh sản xuất (chạy trong transaction: explode BOM, override linh kiện, reserve kho) |
| `PATCH`| `/api/v1/production/orders/:id` | `{ resource: 'production', action: 'update' }` | Cập nhật thông tin lệnh sản xuất ở trạng thái `DRAFT` |
| `DELETE`| `/api/v1/production/orders/:id` | `{ resource: 'production', action: 'delete' }` | Xóa mềm lệnh sản xuất nháp (`isDeleted = true`) |
| `POST`| `/api/v1/production/:id/confirm` | `{ resource: 'production', action: 'update' }` | Chuyển trạng thái từ `DRAFT` $\to$ `CONFIRMED` và thực hiện giữ chỗ tồn kho NVL |
| `POST`| `/api/v1/production/:id/cancel` | `{ resource: 'production', action: 'update' }` | Hủy lệnh sản xuất và hoàn trả tồn kho giữ chỗ |
| `POST`| `/api/v1/production/orders/:id/start` | `{ resource: 'production', action: 'update' }` | **Giai đoạn 1**: Xuất NVL theo tỷ lệ $\to$ sinh Goods Issue `XK-YYYYMMxxx`, cập nhật `qtyIssued` |
| `POST`| `/api/v1/production/orders/:id/complete` | `{ resource: 'production', action: 'update' }` | **Giai đoạn 2**: Nhập thành phẩm $\to$ sinh Goods Receipt `NK-YYYYMMxxx`, tạo xe, gán FIFO As-Built |
| `POST`| `/api/v1/production/shop-floor/scan` | `{ resource: 'production', action: 'update' }` | API quét mã barcode/QR tại trạm công đoạn Shop Floor |

---

## 5. Logic Nghiệp vụ Trọng tâm

### 5.1. Phân rã BOM Đa cấp & Thay thế Linh kiện (`execute` / `explodePreview`)
- Sử dụng đệ quy `explodeBom` để phân rã toàn bộ cây BOM con cho đến các lá linh kiện mua ngoài (`isLeaf = true`).
- **Material Overrides**: Cho phép người dùng chỉ định thay thế linh kiện gốc (`originalItemId`) bằng linh kiện thay thế (`alternativeItemId`). Khi phân rã, hệ thống tự động tráo mã linh kiện và gộp số lượng theo đúng cây định mức.
- **Giữ chỗ tồn kho (`qtyReserved`)**:
  - Nếu tạo ở trạng thái `DRAFT`, bỏ qua kiểm tra tồn kho.
  - Nếu tạo hoặc chuyển sang `CONFIRMED`, hệ thống kiểm tra tồn kho khả dụng $\text{Available} = \text{qtyOnHand} - \text{qtyReserved}$. Nếu đủ, cộng dồn `qtyReserved` tương ứng cho từng linh kiện. Bỏ qua kiểm tra đối với mặt hàng dịch vụ (`SERVICE`).

### 5.2. Giai đoạn 1: Bắt đầu sản xuất & Xuất kho NVL (`startProduction`)
1. Khóa bi quan lệnh sản xuất (`pessimistic_write`).
2. Tính tỷ lệ NVL cần xuất cho đợt này: $\text{Proportion} = \frac{\text{qtyToManufacture}}{\text{qtyToProduce}}$.
3. Kiểm tra số lượng tồn kho vật lý thực tế (`qtyOnHand`).
4. Tự động sinh số phiếu xuất kho `XK-YYYYMMxxx` (loại `PRODUCTION`).
5. Tạo bản ghi `erp_goods_issues` và các dòng `erp_goods_issue_lines`.
6. Giảm trừ cả `qtyOnHand` và `qtyReserved` trong `erp_inventory_balances`.
7. Ghi sổ nhật ký giao dịch kho `erp_inventory_transactions` (loại `ISSUE`, docType `GOODS_ISSUE`).
8. Cập nhật `qtyIssued` trong `erp_production_order_materials`.
9. Cập nhật trạng thái lệnh thành `IN_PROGRESS`.

### 5.3. Giai đoạn 2: Hoàn thành sản xuất & Nhập kho Thành phẩm (`completeProduction`)
1. Kiểm tra toàn bộ NVL định mức của lệnh đã được xuất kho đủ 100% chưa.
2. Kiểm tra Tracking Policy của mặt hàng thành phẩm:
   - `VEHICLE`: Bắt buộc nhập đủ số VIN, Số máy, Số serial, Mã màu hợp lệ (`DEN`, `TRANG`, `DO`, `XANH`, `XAM`, `BAC`). Validate chống trùng lặp VIN và Số máy trong toàn bộ hệ thống.
   - `SERIAL`: Bắt buộc nhập danh sách Serial number.
   - `LOT`: Bắt buộc nhập Lot number.
   - `NONE`: Không bắt buộc định danh.
3. Tự động sinh số phiếu nhập kho `NK-YYYYMMxxx` (loại `RECEIPT`, docType `GOODS_RECEIPT`).
4. Tạo `erp_goods_receipts` và `erp_goods_receipt_lines`.
5. Tạo xe thành phẩm trong `erp_vehicles` và serial thành phẩm trong `erp_inventory_tracking_serials` (`status = 'IN_STOCK'`, liên kết `vinId`).
6. **Thuật toán FIFO As-Built BOM**:
   - Quét các linh kiện trong BOM có tracking policy là `SERIAL` hoặc `CUSTOM`.
   - Tìm các serial linh kiện đang `IN_STOCK` có ngày tạo cũ nhất (`createdAt ASC`).
   - Tạo bản ghi trong `erp_production_order_serial_assignments` map `(productionOrderId, vehicleId, bomLineId, serialId)`.
   - Cập nhật trạng thái serial linh kiện từ `IN_STOCK` sang `ASSEMBLED`.
7. Tăng tồn kho thành phẩm `qtyOnHand` và cập nhật lại giá vốn bình quân gia quyền `avgUnitCost`.
8. Cập nhật `qtyProduced` lũy kế. Nếu $\text{qtyProduced} \ge \text{qtyToProduce}$, chuyển trạng thái lệnh sang `COMPLETED`.

---

## 6. Tích hợp Liên Module

- **`bom-core`**: Cung cấp cấu trúc định mức và logic đệ quy `explodeBom`, nhận diện linh kiện yêu cầu tracking serial.
- **`inventory-core` & `inventory-stock-core`**: Cung cấp dữ liệu tồn kho khả dụng (`erp_inventory_balances`), ghi sổ giao dịch kho (`erp_inventory_transactions`), quản lý serials (`erp_inventory_tracking_serials`).
- **`goods-issues-core`**: Tự động sinh phiếu xuất kho NVL sản xuất (`XK-...`).
- **`goods-receipts-core`**: Tự động sinh phiếu nhập kho thành phẩm (`NK-...`).
- **`erp-mfg-core`**: Quản lý hồ sơ xe xuất xưởng (`erp_vehicles`).

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

Khi thực hiện bất kỳ thay đổi nào trong `production-core`:
1. **Gate 0 Database Verification**: Xác minh các bảng `erp_production_orders`, `erp_production_order_materials`, `erp_production_order_serial_assignments` qua `DATABASE_URL`.
2. **TypeCheck**: Bắt buộc chạy `bun run check:ci` trong thư mục `erp-api/`.
3. **Unit Tests**: Chạy bộ kiểm thử Jest: `bunx jest src/production-core/ --forceExit`.
4. Không commit/push trực tiếp từ workspace cha; luôn `cd` vào `erp-api` để thao tác Git.
