---
name: erp-procurement-orders
description: Module tri thức Đơn mua (Procurement Order, PO) họ ERP thường trong erp-api. Chứa bảng erp_proc_orders / erp_proc_order_lines / erp_proc_order_acceptances, vòng đời DRAFT → PENDING_APPROVAL → APPROVED → ISSUED → CLOSED/CANCELLED, giao nhận GOODS, nghiệm thu SERVICE, liên kết PR (RequestLinkPort), endpoint và RBAC.
---

# Module Tri Thức: Đơn mua (ERP thường)

Module `src/v2/modules/procurement-orders-erp`. Lõi dùng chung ở `src/v2/core/procurement-orders-core` (contract, engine thuần, `AbstractProcurementOrderCommandService`, `AbstractProcurementOrderFulfilmentService`, `RequestLinkPort`). Lõi không import lõi PR.

## 1. Database

- `erp_proc_orders` (header), `erp_proc_order_lines` (dòng, FK `order_id`), `erp_proc_order_acceptances` (nghiệm thu SERVICE, FK `order_id`, `order_line_id`).
- Migration: `20261105100500-CreateProcurementTables.ts`.

**Header**: `order_no` (unique), `order_date`, `expected_date`, `supplier_id`, `supplier_name`, `request_id` (nullable, FK RESTRICT), `source_type` (`REQUEST` | `DIRECT`), `status`, `fulfillment_status`, `total_amount`, `approved_total`, `issued_by/at`, `cancelled_by/at`, `cancel_reason`, `closed_at`, `close_reason`, `remarks`, cột duyệt như PR, `created_by`, `is_deleted`.

**Dòng**: `line_no`, `line_type` (`GOODS`|`SERVICE`), `item_*`, `qty_ordered`, `qty_fulfilled`, `unit_price`, `amount`, `request_line_id` (nullable, FK RESTRICT).

**Nghiệm thu** `erp_proc_order_acceptances`: `qty`, `accepted_by/at`, `note`, `is_voided`, `voided_by/at`, `void_reason`.

CHECK: `line_type IN ('GOODS','SERVICE')`; `source_type IN ('DIRECT','REQUEST')`; `0 <= qty_fulfilled <= qty_ordered`; nghiệm thu `qty > 0`.

## 2. Vòng đời

- `status`: DRAFT, PENDING_APPROVAL, APPROVED, ISSUED, CLOSED, CANCELLED.
- submit (DRAFT→PENDING, cần NCC và đơn giá mọi dòng), approve (PENDING→APPROVED, chốt `approved_total`), reject (PENDING→DRAFT, lý do bắt buộc), recall, issue (APPROVED→ISSUED), cancel (APPROVED/ISSUED→CANCELLED, chỉ khi chưa có giao nhận hay nghiệm thu nào; lý do bắt buộc), close (ISSUED→CLOSED, lý do bắt buộc).
- Sửa dòng chỉ khi DRAFT.
- `fulfillment_status` (NONE/PARTIAL/FULL) suy ra từ dòng. FULL thì tự CLOSED.

## 3. Giao nhận và nghiệm thu

- Dòng **GOODS**: nhận qua `POST :id/receipts` (`applyGoodsReceipt`). Từ chối dòng SERVICE. PO phải ISSUED. Không vượt `qty_ordered`.
- Dòng **SERVICE**: nghiệm thu qua `POST :id/acceptances`. Từ chối dòng GOODS. Số lượng không vượt phần còn lại. Hủy bằng `POST :id/acceptances/:acceptanceId/void` (đánh dấu `is_voided`, cần lý do, không xóa, tính lại `qty_fulfilled`).
- `POST :id/receipts` là endpoint tạm; khi có module phiếu nhập kho sẽ gọi `applyGoodsReceipt` trong transaction của phiếu nhập.

## 4. Liên kết PR

- Tạo PO từ PR: `request_id` + `request_line_id` từng dòng. PR phải APPROVED, cùng họ, và `qty_ordered` không vượt phần còn lại.
- Giữ số lượng: `reserve` khi tạo/thay dòng DRAFT; `release` khi xóa dòng hoặc hủy PO. Cổng `RequestLinkPort` được cài bởi `ProcurementRequestLinkAdapter` (`services/procurement-request-link.adapter.ts`), trỏ vào `ProcurementRequestOrderingService` của module PR thường.

## 5. Duyệt và quyền

- `approve`/`reject` cần `APPROVE`/`REJECT`. Chặn tự duyệt. Nhật ký `erp_approval_events` với `doc_type = PROCUREMENT_ORDER`.
- Các endpoint còn lại dùng quyền UPDATE; đọc dùng READ.
- Quyền resource: `procurement_orders`. Seed từ `purchase_orders` (read/create/update/delete).

## 6. Endpoint (`/api/v2/erp-procurement-orders`)

| Method | Path | Quyền |
| :--- | :--- | :--- |
| POST | `/` | CREATE |
| GET | `/`, `/:id`, `/:id/approval-events` | READ |
| PATCH | `/:id/lines` | UPDATE (DRAFT) |
| POST | `/:id/submit`, `/recall`, `/issue`, `/cancel`, `/close`, `/receipts`, `/acceptances`, `/acceptances/:acceptanceId/void` | UPDATE |
| POST | `/:id/approve` | APPROVE |
| POST | `/:id/reject` | REJECT |

Không có `po-draft` (PO đọc phần còn lại từ PR qua `/procurement-requests/:id/po-draft`).

## 7. Tests

`procurement-order.controller.spec.ts` (RBAC), `procurement-order.di.spec.ts` (DI của cổng `PROCUREMENT_REQUEST_LINK`). Lõi có spec riêng ở `src/v2/core/procurement-orders-core/`.

## Liên quan

- Module Garage: [`garage-procurement-orders`](../garage-procurement-orders/SKILL.md)
- PR thường: [`erp-procurement-requests`](../erp-procurement-requests/SKILL.md)
