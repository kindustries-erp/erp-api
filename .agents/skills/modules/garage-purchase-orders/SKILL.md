---
name: garage-purchase-orders
description: Module tri thức Đơn mua hàng Garage (Garage Purchase Orders) trong erp-api, v2 (src/v2/modules/garage-purchase-orders, route /api/v2/garage-purchase-orders). Bảng riêng erp_garage_purchase_orders và erp_garage_purchase_order_lines, có chi nhánh, tên NCC trên phiếu, tổng tiền lưu cột total_amount. Dùng lõi PO v2.
---

# Module Tri Thức: Đơn Mua Hàng Garage (Garage Purchase Orders)

## 1. Phạm vi

- Module: `src/v2/modules/garage-purchase-orders/`, route `/api/v2/garage-purchase-orders`, quyền `garage_purchase_orders` (seed copy từ resource `garage`, chưa gán cho vai trò).
- Bảng mới (migration `20261104100000-CreateGaragePurchaseOrdersTables`):
  - `erp_garage_purchase_orders`: như header PO core, cộng `branch_id`, `branch_name`, `supplier_name`, `total_amount numeric(18,2)`.
  - `erp_garage_purchase_order_lines`: như dòng PO core, FK `garage_purchase_order_id` ON DELETE CASCADE.
- Lõi: `src/v2/core/purchase-orders/` (dùng chung với PO core). Module này chỉ khai báo bảng, tiền tố, hook và các trường riêng.
- Chưa nối với phiếu nhập garage (`erp_garage_goods_receipts` chưa có `purchase_order_id`). Phần này để bước sau.

## 2. Khác PO core

| Điểm | PO core (`purchase-orders`) | PO garage |
| :--- | :--- | :--- |
| Bảng | `erp_purchase_orders` (dùng chung v1) | `erp_garage_purchase_orders` (mới) |
| Tiền tố số | `PO-YYYYMMDD-xxx` | `GPO-YYYYMMDD-xxx` |
| Tổng tiền | Cộng từ dòng khi đọc | Cột `total_amount`, ghi trong `onLinesPersisted` cùng transaction |
| Tên NCC | Join `erp_business_partners` | Cột `supplier_name` trên phiếu, không có quan hệ supplier |
| Chi nhánh | Không có | `branch_id`, `branch_name` (lọc `branch_id` ở danh sách) |
| Hủy | Kiểm tra `checkDependencies('purchase_orders')` | Không kiểm tra (chưa có phiếu nhập garage liên kết) |
| Liên kết hóa đơn, receipts, connections | Có | Không có |

## 3. API

| Method | Route | Quyền |
| :--- | :--- | :--- |
| POST | `/api/v2/garage-purchase-orders` | `garage_purchase_orders:create` (createdBy từ JWT) |
| GET | `/api/v2/garage-purchase-orders` | read (có `branch_id`) |
| GET | `/api/v2/garage-purchase-orders/next-no?date=` | read |
| GET | `/api/v2/garage-purchase-orders/column-options?column=` | read |
| GET | `/api/v2/garage-purchase-orders/:id` | read |
| PATCH | `/api/v2/garage-purchase-orders/:id` | update (không nhận `status`) |
| DELETE | `/api/v2/garage-purchase-orders/:id` | delete (chỉ khi `DRAFT`) |
| POST | `/api/v2/garage-purchase-orders/:id/approve\|confirm\|cancel` | update |

Trạng thái và bảng chuyển trạng thái giống PO core (xem `purchase-orders-v2`).

## 4. Ghi chú

- Response: khuôn PO core cộng `branchId`, `branchName`. `totalAmount` đọc từ cột đã lưu.
- Tổng tiền làm tròn 2 chữ số khi ghi cột `numeric(18,2)`. Dòng vẫn lưu `numeric(18,3)`.
- Cột `total_amount` chỉ module garage ghi. Không sửa tay.
- Khi nối phiếu nhập garage sau này: gọi `applyReceiptProgress(manager, headerId, receivedByLineId)` của lệnh ghi trong cùng transaction phiếu nhập, để khóa header và cập nhật `qty_received` đúng cách.
- Spec: `garage-purchase-orders.contract.spec.ts` (route, quyền, facade), `services/garage-purchase-order-command.service.spec.ts` (tiền tố, trường chi nhánh, tổng tiền).

## 9. Trạng thái: đã thay thế (2026-11-05)

- Đơn mua Garage được thay bằng [`garage-procurement-orders`](../garage-procurement-orders/SKILL.md) (luồng PR → PO → GR).
- Controller GPO đánh dấu deprecated (`@ApiExcludeController`, header `Deprecation: true`), chưa xóa. Web đã gỡ module GPO v2 và chuyển route, menu sang PR/PO mới.
- Chưa làm: migrate dữ liệu, drop bảng `erp_garage_purchase_orders` và quyền `garage_purchase_orders`. Cần đếm dữ liệu trên từng DB và xác nhận trước khi drop.
