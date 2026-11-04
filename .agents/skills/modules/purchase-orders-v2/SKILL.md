---
name: purchase-orders-v2
description: Module tri thức PO v2 (Đơn mua hàng) trong erp-api: lõi dùng chung src/v2/core/purchase-orders, module src/v2/modules/purchase-orders (route /api/v2/purchase-orders, bảng erp_purchase_orders dùng chung với v1). Gồm trạng thái, API hành động, lọc EXISTS, số chứng từ có khóa, và lộ trình để v1 kế thừa lõi.
---

# Module Tri Thức: Đơn Mua Hàng v2 (Purchase Orders v2)

## 1. Phạm vi

- Lõi: `src/v2/core/purchase-orders/` (không controller, không `@Entity`).
  - `contracts/purchase-order.contract.ts`: trạng thái, bảng chuyển trạng thái, hook.
  - `services/purchase-order-engine.service.ts`: luật thuần (chuyển trạng thái, khóa dòng khi đã nhận, chuẩn hóa dòng, tổng).
  - `services/purchase-order-numbering.service.ts`: số `PREFIX-YYYYMMDD-001` có advisory lock, múi giờ VN.
  - `services/abstract-purchase-order-command.service.ts`: lệnh ghi (template method).
  - `services/abstract-purchase-order-query.service.ts`: đọc, lọc, sắp xếp, tổng, gợi ý cột.
  - `entities/`, `dto/`, `helpers/purchase-order.mapper.ts` (entity → response, khớp `toCoreDocument` v1).
- Module: `src/v2/modules/purchase-orders/` (route `/api/v2/purchase-orders`).
  - Entity `PurchaseOrder` (`erp_purchase_orders`), `PurchaseOrderLine` (`erp_purchase_order_lines`). Tên class khác v1 để TypeORM không đăng ký trùng. Không DDL.
  - Chạy song song với v1 `/api/v1/purchase-orders`. Không đổi route v1.

## 2. Trạng thái và hành động

| Hành động | Từ | Đến |
| :--- | :--- | :--- |
| `POST :id/approve` | `DRAFT` | `APPROVED` |
| `POST :id/confirm` | `DRAFT`, `APPROVED` | `CONFIRMED` |
| `POST :id/cancel` | `APPROVED`, `CONFIRMED`, `PARTIAL_RECEIVED` | `CANCELLED` (kiểm tra `checkDependencies('purchase_orders', id)`) |

- `PATCH :id` không nhận `status`. Muốn đổi trạng thái phải gọi action.
- Hủy `DRAFT` bị chặn: dùng `DELETE :id` (xóa mềm, chỉ khi `DRAFT`).
- Sửa header và dòng bị chặn khi `RECEIVED` hoặc `CANCELLED`.
- Sửa dòng đã có số nhận: không đặt SL nhỏ hơn số đã nhận, không xóa dòng có số nhận (H2).

## 3. API

| Method | Route | Quyền |
| :--- | :--- | :--- |
| POST | `/api/v2/purchase-orders` | `purchase_orders:create` (createdBy lấy từ JWT `sub`) |
| GET | `/api/v2/purchase-orders` | `purchase_orders:read` (phân trang, lọc, `summaries.totalAmount`) |
| GET | `/api/v2/purchase-orders/next-no?date=YYYY-MM-DD` | read (xem trước, không giữ số) |
| GET | `/api/v2/purchase-orders/column-options?column=...` | read |
| GET | `/api/v2/purchase-orders/:id` | read |
| GET | `/api/v2/purchase-orders/:id/receipts` | read |
| GET | `/api/v2/purchase-orders/:id/connections` | read |
| GET | `/api/v2/purchase-orders/:id/invoices` | read |
| PATCH | `/api/v2/purchase-orders/:id` | `purchase_orders:update` |
| DELETE | `/api/v2/purchase-orders/:id` | `purchase_orders:delete` |
| POST | `/api/v2/purchase-orders/:id/approve\|confirm\|cancel` | `purchase_orders:update` |
| POST | `/api/v2/purchase-orders/:id/link-invoices` | update (`invoiceIds` UUID, không rỗng) |
| DELETE | `/api/v2/purchase-orders/:id/invoices/:invoiceId` | update |

Response: `{ message, data }` cho chi tiết và hành động; danh sách trả `{ items, total, page, pageSize, totalPages, summaries }`. Số là chuỗi (`qtyOrdered`, `unitPrice`, `amount`), khớp v1.

## 4. Lọc và sắp xếp

- Lọc nhiều cột dùng helper chung `src/common/utils/table-query/` (`column_search`, `column_filters`, `column_operators`, `date_ranges`). Tham số JSON sai định dạng bị bỏ qua.
- `only_receivable=true`: `EXISTS` trên dòng có `qty_ordered > qty_received` và có `item_id`. `false` không lọc (H1: v1 từng đảo giá trị này).
- `inventory_item_id`: `EXISTS` trong SQL trên dòng. v1 ghép mảng id trong bộ nhớ. Cơ chế tag (`sys_entity_tags`) không được hỗ trợ trong ERP, nên v2 không nhận `tag_id`.
- Sắp xếp theo whitelist cột. Tham số lạ rơi về `created_at DESC`.
- `date_from` và `date_to` lọc theo `order_date` (v1 cũng lọc theo ngày lập đơn).
- `pageSize` tối đa 200 (#10).
- `column-options` nhận thêm `option_search` để lọc danh sách gợi ý, không dùng `search` (từ khóa toàn bảng).

## 5. Liên kết hóa đơn (#6)

`link-invoices` kiểm tra: PO tồn tại và chưa hủy; mọi hóa đơn tồn tại và chưa xóa; không hóa đơn nào đang thuộc PO khác (409). Ghi trong một transaction.
Chưa kiểm tra "đúng nhà cung cấp": bảng `erp_invoices` không có cột NCC tham chiếu được, chỉ có tên người bán/mua. Cần quyết định nghiệp vụ trước khi thêm.

## 6. Mapper và hợp đồng

- `toPurchaseOrderResponse(header, lines, { totalAmount? })` là hàm thuần, không lộ entity.
- Core: `totalAmount` cộng từ dòng (SQL: subquery trên `erp_purchase_order_lines`).
- Spec hợp đồng: `purchase-orders.contract.spec.ts`; spec so khớp v1: `helpers/purchase-order.mapper.spec.ts`.

## 7. Lộ trình để v1 kế thừa lõi (chưa làm)

Khi refactor `purchase-orders-core` (v1), không đổi DB và không đổi route:
1. `ErpPurchaseOrder extends BasePurchaseOrderEntity` (cùng bảng). Dòng: `extends BasePurchaseOrderLineEntity`.
2. Service v1 `extends AbstractPurchaseOrderCommandService` và `AbstractPurchaseOrderQueryService`; khai báo `target`, `numberPrefix`, và hook.
3. Thay `toCoreDocument` bằng `toPurchaseOrderResponse`; giữ các trường v1 đặc thù (ví dụ `receipts`) ở lớp v1.
4. Chứng minh bằng `purchase-orders-inheritance.spec.ts` (lớp kiểu v1 chạy create, approve, cancel, update qua lõi).

Chưa làm trong thay đổi này: Excel, `/items`, `/supplier-stats`, UI v2, và việc `goods-receipts-core` v1 vẫn ghi trạng thái PO trực tiếp.

## 8. Ghi chú vận hành

- Migration đã chạy trên `erp_greenway_staging`: `CreateGaragePurchaseOrdersTables`, `AddIndexesToPurchaseOrders` (index đơn cột, khớp decorator entity), `SeedGaragePurchaseOrdersPermissions`.
- Index trên `erp_purchase_orders` là thay đổi trên bảng đang chạy production. Chưa áp dụng cho tenant khác.
- Hủy PO không kiểm tra phụ thuộc phía garage (xem module garage).
