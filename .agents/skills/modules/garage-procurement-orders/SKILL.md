---
name: garage-procurement-orders
description: Module tri thức Đơn mua (Procurement Order, PO) họ Garage trong erp-api. Chứa bảng erp_garage_proc_orders / lines / acceptances (có branch_id, branch_name), vòng đời DRAFT → ISSUED → CLOSED, giao nhận GOODS, nghiệm thu SERVICE, tiền tố GDMH, quyền garage_procurement_orders và cổng liên kết PR Garage.
---

# Module Tri Thức: Đơn mua (Garage)

Module `src/v2/modules/garage-procurement-orders`. Dùng chung lõi `src/v2/core/procurement-orders` với họ thường. Khác biệt: bảng, quyền, tiền tố `GDMH`, chi nhánh, route, và cổng liên kết PR Garage.

## 1. Database

- `erp_garage_proc_orders` (header), `erp_garage_proc_order_lines` (dòng, FK `order_id`), `erp_garage_proc_order_acceptances` (nghiệm thu, FK `order_id`, `order_line_id`).
- Migration: `20261105101000-CreateGarageProcurementTables.ts`.
- Cột giống họ thường (xem [`erp-procurement-orders`](../erp-procurement-orders/SKILL.md) mục 1), cộng `branch_id`, `branch_name` trên header.
- CHECK giống họ thường.

## 2. Vòng đời

Giống họ thường: DRAFT, PENDING_APPROVAL, APPROVED, ISSUED, CLOSED, CANCELLED. Các quy tắc submit, approve (chốt `approved_total`), reject, recall, issue, cancel, close giữ nguyên. `fulfillment_status` suy ra từ dòng.

- `approve`/`reject` cần `APPROVE`/`REJECT`, chặn tự duyệt.
- Nhật ký `erp_approval_events` với `doc_type = GARAGE_PROCUREMENT_ORDER`.
- Số phiếu: tiền tố `GDMH`.

## 3. Giao nhận và nghiệm thu

- GOODS: `POST :id/receipts` (`applyGoodsReceipt`), từ chối SERVICE, PO phải ISSUED.
- SERVICE: `POST :id/acceptances`, hủy bằng `POST :id/acceptances/:acceptanceId/void` (cần lý do, đánh dấu `is_voided`).
- Giống họ thường, `receipts` là endpoint tạm chờ module phiếu nhập kho Garage.

## 4. Chi nhánh

- `POST` bắt buộc `branchId`. `GET /` lọc theo `branchId` nếu có.

## 5. Liên kết PR Garage

- Tạo PO từ đề nghị Garage (`request_id`, `request_line_id`). Đề nghị phải APPROVED, cùng họ Garage, không vượt phần còn lại.
- Cổng `GARAGE_PROCUREMENT_REQUEST_LINK` cài bởi `GarageProcurementRequestLinkAdapter` (`services/garage-procurement-request-link.adapter.ts`), trỏ vào `GarageProcurementRequestOrderingService` của module `garage-procurement-requests`.

## 6. Endpoint (`/api/v2/garage-procurement-orders`)

Cùng bộ endpoint họ thường: `POST /`, `GET /`, `GET /:id`, `GET /:id/approval-events`, `PATCH /:id/lines`, `POST` cho submit, recall, approve, reject, issue, cancel, close, receipts, acceptances, và void.

Quyền resource: `garage_procurement_orders`. Seed từ `garage_purchase_orders`.

## 7. Tests

`procurement-order.controller.spec.ts` (RBAC), `procurement-order.di.spec.ts` (DI cổng `GARAGE_PROCUREMENT_REQUEST_LINK`).

## Liên quan

- Đề nghị Garage: [`garage-procurement-requests`](../garage-procurement-requests/SKILL.md)
- Họ thường: [`erp-procurement-orders`](../erp-procurement-orders/SKILL.md)
