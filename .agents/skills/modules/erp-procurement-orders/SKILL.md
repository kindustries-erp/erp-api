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

- `status`: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, ISSUED, CLOSED, CANCELLED.
- submit (DRAFT→PENDING, cần NCC và đơn giá mọi dòng), approve (PENDING→APPROVED, chốt `approved_total`), reject (PENDING→REJECTED, lý do bắt buộc), recall, issue (APPROVED→ISSUED), cancel (APPROVED/ISSUED→CANCELLED, chỉ khi chưa có giao nhận hay nghiệm thu nào; lý do bắt buộc), close (ISSUED→CLOSED, lý do bắt buộc).
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

## 6. Endpoint (`/api/v2/procurement-orders-erp`)

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

## Response duyệt: khối `approval` (2026-11-08)

- Header PR/PO (list, detail, kết quả transition) trả `approval`: `{ approverId, approverEmail, submit, approve, reject, cancel, close, issue }`. Mỗi bước là `{ by, byEmail, at, reason? }` hoặc `null` khi chưa xảy ra. PR không có `issue`. `reason` chỉ có ở reject/cancel/close.
- Danh sách (`GET /`) trả `{ items, pagination: { page, pageSize, total, totalPages }, summaries }`. `summaries` theo `summary_keys` (helper `applyListSummaries`): `totalAmount` trả `{ total, pageSubtotal, cumulative }`; key ngoài whitelist trả `null`; không gửi `summary_keys` thì `{}`. Chỉ có `page`/`pageSize`, chưa có bộ lọc cột (`column_filters`).
- `approverEmail` = người đã duyệt; chưa duyệt thì người được giao (`approvedBy ?? approverId`).
- Đã bỏ key phẳng (breaking, web đã sửa cùng đợt). PR: `submittedBy, approvedBy, approverId, approverEmail, rejectedBy, rejectReason, cancelReason, closeReason`. PO: `approverId, rejectReason, cancelReason, closeReason`.
- `closed_by` (migration `20261108130000`) ghi người đóng; tự đóng khi đủ hàng giữ `null`.
- Email resolve theo lô qua `resolveApprovalEmails` (approval-core), một lần cho cả trang, không N+1.
- Mapper dùng chung: `toApprovalSummary` (`core/approval-core/helpers/approval-summary.mapper.ts`).

## extraData (JSON tùy biến, 2026-11-08)

- **DB**: cột `extra_data jsonb NOT NULL DEFAULT '{}'` (CHECK: object) trên: `erp_proc_orders`, `erp_proc_order_lines`, `erp_proc_order_acceptances`. Migration `20261108120000-add-extra-data-to-v2-tables.ts`. Dữ liệu cũ là `{}`.
- **DTO**: field `extraData?: Record<string, unknown>` (`@ExtraDataField()`, base-core). Không gửi thì không đổi.
- **Ghi**: tạo mặc định `{}`. Sửa header merge cấp 1 (`null` xóa key). Dòng chứng từ ghi theo payload, không merge.
- **Giới hạn**: 16 KB, sâu 5 cấp, key ≤ 64 ký tự, cấm `__proto__`/`constructor`/`prototype` (400 qua `RejectUnsafeExtraDataPipe` và service).
- **Response**: luôn có `extraData` (object).

## 9. Cập nhật 2026-11-11: từ chối → REJECTED và nhân bản

- Từ chối (`reject`) chuyển `PENDING_APPROVAL → REJECTED` (trước đây về DRAFT). REJECTED là trạng thái khóa: không có action nào chuyển đi từ REJECTED. Chỉ xem chi tiết, lịch sử duyệt và nhân bản.
- Nhân bản: `POST /:id/clone` (quyền CREATE) tạo nháp mới từ phiếu REJECTED hoặc CANCELLED. Copy đầu đề và dòng, không copy trạng thái duyệt hay lý do. Gán `cloned_from_id` trỏ về phiếu gốc (cột mới, nullable, migration `20261111100000-add-cloned-from-to-procurement`, không backfill). Phiếu ở trạng thái khác → 409 `ConflictException`. Không tồn tại → 404.
- Lõi `cloneDraft` nằm ở `abstract-*-command.service.ts` và dùng chung cho ERP và Garage. Garage giữ `branchId`/`branchName` khi nhân bản.
- PO: reject cũng trả số lượng đã giữ về PR nguồn (như cancel). Trước đó reject không trả, đã sửa trong lõi PO. Nhân bản PO giữ `requestId`/`requestLineId` để `createDraft` giữ lại số lượng PR.
- PR nhân bản không copy `orderingStatus` (luôn `NONE`).
- Spec: `abstract-*-clone.spec.ts` (quy tắc clone, 409/404, REJECTED là trạng thái cuối, PO reject trả số lượng PR).

## Cập nhật 2026-11-11: thu hồi

- `recall` chỉ người tạo (`created_by`) được thực hiện; người khác nhận 403 "Chỉ người tạo mới được thu hồi".
