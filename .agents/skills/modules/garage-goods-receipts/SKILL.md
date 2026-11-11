---
name: garage-goods-receipts
description: Module tri thức Quản lý Nhập kho và Quản lý kho Garage (Garage Goods Receipts & Inventory) trong erp-api (v2/modules/goods-receipts-garage) và erp-web. Chứa database schema (goods_receipts_garage, goods_receipt_lines_garage, inventory_balances_garage), DTOs, API endpoints, logic ghi sổ POSTED (tăng tồn kho), logic hủy CANCELLED (giảm hoàn tồn kho), và kiến trúc Web V2 theo chuẩn Atomic Design.
---

# 🏬 Module Tri Thức: Nhập Kho & Quản Lý Kho Garage (Garage Goods Receipts & Inventory)

## 1. Tổng quan Nghiệp vụ

Phân hệ Nhập kho và Quản lý kho Garage (`src/v2/modules/goods-receipts-garage` trên Backend và `src/v2/modules/goods-receipts-garage` trên Frontend) phục vụ nhập vật tư, phụ tùng thay thế và linh kiện phục vụ sửa chữa xe tại xưởng dịch vụ/garage.

Các nghiệp vụ trọng tâm:
- **Lập phiếu nhập kho Garage**: Nhập thông tin nhà cung cấp, ngày nhập kho, chi nhánh tiếp nhận, ghi chú và danh sách phụ tùng chi tiết (Mã SKU, tên phụ tùng, đơn vị tính, số lượng, đơn giá, thành tiền).
- **Trạng thái phiếu**:
  - `DRAFT`: Phiếu nháp, có thể chỉnh sửa chi tiết phụ tùng hoặc xóa phiếu.
  - `POSTED`: Đã ghi sổ nhập kho. Ghi sổ tồn garage `garage_stock_*` qua orchestrator `procurement-flow-garage` (chứng từ `GOODS_RECEIPT_GARAGE`). Không thể chỉnh sửa trực tiếp.
  - `CANCELLED`: Hủy phiếu nhập kho đã ghi sổ. Đảo bút toán trong sổ tồn garage (`_CANCEL`).
- **Tồn kho Garage**: nguồn đúng là sổ `garage_stock_balances/transactions/cost_layers` (xem skill `inventory-movements-core`). Bảng cũ `inventory_balances_garage` không còn được ghi (chỉ còn entity đăng ký, dữ liệu cũ giữ nguyên).

---

## 2. Database Schema & Quan hệ Dữ liệu

> [!NOTE]
> Trong mã nguồn TypeScript, `GarageGoodsReceipt` kế thừa từ `BaseGoodsReceiptEntity` và `GarageGoodsReceiptLine` kế thừa từ `BaseGoodsReceiptLineEntity` (tại `@/v2/core/goods-receipts-core/entities/`), giúp tái sử dụng toàn bộ schema cột chung trong khi tên bảng PostgreSQL và index vẫn duy trì độc lập hoàn toàn.

### Bảng `goods_receipts_garage` (Header)
| Cột | Kiểu dữ liệu | Nullable | Default | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `receipt_no` | `varchar(100)` | NO | — | Mã số phiếu (Unique, vd: `GGR-2026-0001`) |
| `receipt_date` | `date` | NO | — | Ngày nhập hàng thực tế |
| `supplier_id` | `varchar(100)` | YES | `NULL` | ID nhà cung cấp |
| `supplier_name` | `varchar(255)` | YES | `NULL` | Tên nhà cung cấp |
| `branch_id` | `varchar(100)` | YES | `NULL` | ID chi nhánh nhận hàng; tối đa 1 chi nhánh, `NULL` = nhóm không chi nhánh |
| `branch_name` | `varchar(255)` | YES | `NULL` | Tên chi nhánh nhận hàng |
| `total_amount` | `numeric(15,2)` | NO | `0` | Tổng giá trị hàng nhập |
| `status` | `varchar(50)` | NO | `'DRAFT'` | Trạng thái (`DRAFT`, `POSTED`, `CANCELLED`) |
| `payment_status` | `varchar(50)` | NO | `'UNPAID'` | Trạng thái thanh toán |
| `remarks` | `text` | YES | `NULL` | Ghi chú phiếu |
| `created_by` | `varchar(100)` | YES | `NULL` | User tạo |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật |
| `deleted_at` | `timestamptz` | YES | `NULL` | Thời điểm xóa mềm |

### Bảng `goods_receipt_lines_garage` (Detail Lines)
| Cột | Kiểu dữ liệu | Nullable | Default | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `receipt_id` | `uuid` | NO | — | FK trỏ về `goods_receipts_garage.id` (CASCADE) |
| `item_code` | `varchar(100)` | NO | — | Mã phụ tùng (SKU) |
| `item_name` | `varchar(255)` | NO | — | Tên phụ tùng |
| `unit` | `varchar(50)` | YES | `'Cái'` | Đơn vị tính |
| `qty_received` | `numeric(12,2)` | NO | `0` | Số lượng nhập |
| `unit_cost` | `numeric(15,2)` | NO | `0` | Đơn giá nhập |
| `amount` | `numeric(15,2)` | NO | `0` | Thành tiền (`qty_received * unit_cost`) |
| `notes` | `text` | YES | `NULL` | Ghi chú dòng |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật |

### Bảng `inventory_balances_garage` (cũ, không còn được ghi; cột thực tế là `qty_on_hand`, không phải `quantity`)
| Cột | Kiểu dữ liệu | Nullable | Default | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `item_code` | `varchar(100)` | NO | — | Mã phụ tùng (Unique kết hợp cùng `branch_id`) |
| `item_name` | `varchar(255)` | YES | `NULL` | Tên phụ tùng |
| `unit` | `varchar(50)` | YES | `'Cái'` | Đơn vị tính |
| `branch_id` | `varchar(100)` | YES | `NULL` | Chi nhánh lưu kho |
| `quantity` | `numeric(12,2)` | NO | `0` | Số lượng tồn kho hiện tại |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật |

---

## 3. API Endpoints (`/api/v2/garage-goods-receipts`)

| Phương thức | Endpoint | Resource RBAC | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v2/garage-goods-receipts` | `garage_goods_receipts:read` | Lấy danh sách phân trang, tìm kiếm, lọc theo cột |
| `GET` | `/api/v2/garage-goods-receipts/options` | `garage_goods_receipts:read` | Lấy danh sách distinct options cho bộ lọc cột |
| `GET` | `/api/v2/garage-goods-receipts/next-code` | `garage_goods_receipts:read` | Sinh mã phiếu kế tiếp tự động (`GGR-YYYY-XXXX`) |
| `GET` | `/api/v2/garage-goods-receipts/:id` | `garage_goods_receipts:read` | Xem chi tiết phiếu kèm toàn bộ dòng phụ tùng |
| `POST` | `/api/v2/garage-goods-receipts` | `garage_goods_receipts:create` | Tạo mới phiếu nhập và lưu danh sách dòng hàng |
| `PUT` | `/api/v2/garage-goods-receipts/:id` | `garage_goods_receipts:update` | Cập nhật phiếu nhập kho ở trạng thái `DRAFT` |
| `POST` | `/api/v2/garage-goods-receipts/:id/post` | `garage_goods_receipts:update` | Ghi sổ phiếu nhập: chuyển status `POSTED` & tăng tồn kho |
| `POST` | `/api/v2/garage-goods-receipts/:id/cancel` | `garage_goods_receipts:update` | Hủy phiếu đã ghi sổ: chuyển `CANCELLED` & hoàn trừ tồn kho |
| `DELETE` | `/api/v2/garage-goods-receipts/:id` | `garage_goods_receipts:delete` | Xóa mềm phiếu nhập kho |

---

## 4. Frontend Web V2 Architecture

- **Thư mục module**: `erp/erp-web/src/v2/modules/goods-receipts-garage/`
- **Routing URL**: `/garage-goods-receipts`
- **Cấu trúc Atomic Design**:
  - `domain/entities/`: Entity interfaces & Form contracts.
  - `domain/rules/`: Validation và dirty checking rules.
  - `components/molecules/`: Badges trạng thái semantic (`GarageGoodsReceiptStatusBadge`).
  - `components/organisms/`: Bảng dữ liệu chuẩn hóa, Lưới dòng hàng (`GarageGoodsReceiptLinesTable`, `GarageGoodsReceiptLineRow`), Form sections.
  - `drawers/`: Drawer chi tiết & chỉnh sửa (`GarageGoodsReceiptDrawer` sử dụng `V2StandardDrawer`).
  - `pages/`: Template trang V2 (`GarageGoodsReceiptsPage`).

---

## 5. Kiến Trúc Kế Thừa V2 Core & Phân Quyền RBAC

### Kế thừa V2 Core Base Voucher Engine
Module `garage-goods-receipts` (`src/v2/modules/goods-receipts-garage/`) sử dụng cơ chế **Mô hình 2 (Bảng DB riêng biệt, Kế thừa Engine ở Tầng Code)**:
- **DB riêng biệt**: Dùng các bảng `goods_receipts_garage`, `goods_receipt_lines_garage`; tồn nằm ở sổ `garage_stock_*`.
- **Tái sử dụng Engine từ V2 Core**: Inject `BaseVoucherEngineService` từ `src/v2/core/goods-receipts-core/`:
  - `generateDailyReceiptNo`: Tự động sinh mã `GGR-YYYYMMDD-XXX`.
  - `sumLineAmounts`: Tính tổng tiền chi tiết từ các dòng hàng.
  - `validateVoucherTransition`: Xác thực chuyển trạng thái DRAFT -> POSTED -> CANCELLED và chặn sửa/xóa khi không hợp lệ.
  - Ghi tồn: `post`/`cancel` giao cho `GarageProcurementFlowService` (module `procurement-flow-garage`), không tự ghi tồn.

### Phân quyền RBAC
- **Migration**: `SeedGarageGoodsReceiptsPermissions20261103085000` tự động sao chép các quyền READ, CREATE, UPDATE, DELETE từ resource `garage` sang `garage_goods_receipts`.
- **Backend Guard**: Controller được bảo vệ bởi `@UseGuards(JwtAuthGuard, CoreRbacGuard)` và `@RequirePermissions({ resource: ErpResource.GARAGE_GOODS_RECEIPTS, action: ... })`.
- **Rbac Core Collections API**: Đã khai báo `{ resource: ErpResource.GARAGE_GOODS_RECEIPTS, label: 'Nhập kho Garage (Garage Goods Receipts)' }` trong `rbacCoreService.getAvailableResources()` (`GET /api/v1/rbac-core/collections`) để hiển thị trực tiếp trên ma trận phân quyền `ErpPermissionsCorePage`.
- **Frontend RBAC**: Khai báo `garage_goods_receipts` trong `RBAC_COLLECTIONS` và `PERMISSION_RESOURCE_GROUPS` (nhóm "Garage & Xưởng dịch vụ") trên Web giúp quản trị viên phân quyền linh hoạt qua Role Drawer và Permission Matrix.

## 8. Cập nhật 2026-11-05: nối đơn mua Garage

- Migration `20261105103500-LinkGarageGoodsReceiptsToProcOrders`: phiếu có `garage_procurement_order_id` (FK RESTRICT, có chỉ mục), dòng có `procurement_order_line_id`. Đều nullable; phiếu không nối thì hành vi cũ giữ nguyên.
- `post` phiếu có PO: kiểm tra PO tồn tại và chưa xóa, cùng chi nhánh (null so với null), cùng NCC, mọi dòng có `procurement_order_line_id`, rồi gọi `applyGoodsReceipt` trong transaction.
- `cancel` phiếu đã POSTED có PO: gọi `revertGoodsReceipt`, số đã nhận trên PO giảm; PO từ CLOSED tự mở lại thành ISSUED nếu không còn đủ.
- Tồn kho: `balanceBranch` dùng `IsNull()` khi chi nhánh null, không khớp nhầm mọi chi nhánh. Chưa có khóa dòng tồn (`pessimistic_write`) khi cộng/trừ tồn.
- Module phụ thuộc: `garage-goods-receipts-core.module` import `GarageProcurementOrdersModule`.

## 9. Cập nhật 2026-11-05: khóa phiếu và tồn

- `post`/`cancel` khóa phiếu bằng `pessimistic_write` rồi mới kiểm trạng thái, nên post lặp hoặc post song song cùng phiếu bị chặn (400 từ lần sau).
- Tồn được cập nhật qua `GarageInventoryBalanceService`: khóa từng mặt hàng theo `itemCode` tăng dần; dòng tồn mới tạo bằng `INSERT ... ON CONFLICT DO NOTHING` theo hai partial unique index (`UQ_garage_inv_bal_branch_item`, `UQ_garage_inv_bal_null_branch_item`, migration `20261105105500`).
- Thứ tự khóa: phiếu GR → đầu đơn PO → dòng PO → dòng tồn (theo itemCode). Không đảo thứ tự.
- Đã đóng: `update` phiếu nháp khóa phiếu bằng `pessimistic_write` trong transaction, kiểm trạng thái trên bản đã khóa rồi mới ghi dòng. Một lần post đồng thời không thể bị sửa dòng chồng lên.

## 10. Cập nhật 2026-11-06: chi nhánh tùy chọn

- `branch_id` nullable từ đầu, không đổi schema. Một phiếu chọn tối đa 1 chi nhánh hoặc để trống (`NULL`).
- DTO tạo/sửa: `branchId` và `branchName` nhận `null`. Web gửi `null` khi người dùng bỏ trống, để `PUT`/`PATCH` xóa được chi nhánh cũ. Mapper (`toGarageGoodsReceiptEntityFields`) giữ `null` và chỉ bỏ `undefined`.
- Tồn kho khi post: `branch_id = NULL` cộng vào nhóm không chi nhánh (`UQ_garage_inv_bal_null_branch_item`). Không đổi logic tồn kho.
- Kiểm tra cùng chi nhánh với PO (`garage-goods-receipt-command.service.ts`): so sánh có xử lý null, hai bên cùng trống thì hợp lệ.
- Spec: `garage-goods-receipt.mapper.spec.ts` (giữ `null`, không ghi đè khi thiếu).

## extraData (JSON tùy biến, 2026-11-08)

- **DB**: cột `extra_data jsonb NOT NULL DEFAULT '{}'` (CHECK: object) trên: `goods_receipts_garage`, `goods_receipt_lines_garage`. Migration `20261108120000-add-extra-data-to-v2-tables.ts`. Dữ liệu cũ là `{}`.
- **DTO**: field `extraData?: Record<string, unknown>` (`@ExtraDataField()`, base-core). Không gửi thì không đổi.
- **Ghi**: tạo mặc định `{}`. Sửa header merge cấp 1 (`null` xóa key). Dòng chứng từ ghi theo payload, không merge.
- **Giới hạn**: 16 KB, sâu 5 cấp, key ≤ 64 ký tự, cấm `__proto__`/`constructor`/`prototype` (400 qua `RejectUnsafeExtraDataPipe` và service).
- **Response**: luôn có `extraData` (object).

## 11. Cập nhật 2026-11-11: hợp nhất tồn vào sổ garage_stock

- `post`/`cancel` chỉ còn `GarageProcurementFlowService.postReceipt/cancelReceipt(id)`: khóa phiếu `pessimistic_write` → kiểm trạng thái → (có PO) kiểm khớp chi nhánh/NCC/dòng → nhận hàng vào PO → `StockMovementEngineService.post` (IN/RECEIPT, `WEIGHTED_AVG`, `documentType GOODS_RECEIPT_GARAGE`, `documentId` = id phiếu) → POSTED. Cancel: hoàn PO + `reverse` → CANCELLED. Cùng một transaction; thông báo gửi sau commit.
- Không tạo `garage_stock_receipts`: phiếu GR là chứng từ nhập duy nhất.
- Đã gỡ `GarageInventoryBalanceService` và cơ chế kẹp tồn về 0 khi hủy. Engine chặn tồn âm; dòng có `qty_received <= 0` giờ làm post lỗi (trước đây cộng 0).
- Thứ tự khóa: phiếu GR → PO → dòng PO → dòng sổ tồn.

## 12. Cập nhật 2026-11-11: phiếu nhập bắt buộc gắn đơn mua

- `CreateGarageGoodsReceiptDto.garageProcurementOrderId` **bắt buộc** (`@IsUUID`). Update không đổi được đơn (400 "Không đổi được đơn mua của phiếu nhập"); phiếu cũ chưa có đơn được gắn đơn lần đầu.
- Create/update nạp đơn (`helpers/garage-receipt-order.helper.ts`): đơn phải tồn tại, chưa xóa, `ISSUED`, chưa `FULL`. **NCC và chi nhánh ghi đè theo đơn** (bỏ giá trị client); **tổng tiền = tổng dòng nhận** do server tính (bỏ `totalAmount` client).
- Response thêm `garageProcurementOrderNo` và `orderTotalAmount` (join một truy vấn cho cả trang: `GarageGoodsReceiptQueryService.findOrderSummaries`).
- Danh sách lọc được theo `garageProcurementOrderId` (`column_filters`), dùng cho lịch sử nhập kho của đơn.
- Phiếu cũ không có đơn vẫn đọc/sửa được như trước.
