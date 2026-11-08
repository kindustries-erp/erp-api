---
name: erp-procurement-requests
description: Module tri thức Đề nghị mua (Purchase Request) họ ERP thường trong erp-api. Chứa bảng erp_proc_requests / erp_proc_request_lines, vòng đời duyệt (DRAFT → PENDING_APPROVAL → APPROVED → CLOSED/CANCELLED), trục đặt hàng ordering_status, endpoint, RBAC approve/reject và cách PO lấy số lượng còn lại.
---

# Module Tri Thức: Đề nghị mua (ERP thường)

Module `src/v2/modules/procurement-requests-erp`. Lõi nghiệp vụ dùng chung ở `src/v2/core/procurement-requests-core` (contract, engine thuần, lớp abstract command/ordering). Module chỉ gắn bảng, quyền, route và facade.

## 1. Database

Bảng `erp_proc_requests` (header) và `erp_proc_request_lines` (dòng, FK `request_id` ON DELETE CASCADE). Migration: `20261105100500-CreateProcurementTables.ts`.

**Header `erp_proc_requests`**: `id`, `request_no` (unique), `request_date`, `needed_date`, `title`, `requester_employee_id`, `status`, `ordering_status`, `estimated_total`, `remarks`, `submitted_by/at`, `approved_by/at`, `rejected_by/at`, `reject_reason`, `cancelled_by/at`, `cancel_reason`, `closed_at`, `close_reason`, `created_by`, `is_deleted`, `created_at`, `updated_at`.

**Dòng `erp_proc_request_lines`**: `line_no`, `line_type` (`GOODS` | `SERVICE`), `item_id`, `item_code`, `item_name`, `description`, `qty_requested`, `qty_ordered`, `est_unit_price`, `est_amount`, `notes`.

Ràng buộc CHECK: `line_type IN ('GOODS','SERVICE')`; `0 <= qty_ordered <= qty_requested`.

## 2. Vòng đời

- `status`: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `CLOSED`, `CANCELLED`.
- Chuyển trạng thái (`PURCHASE_REQUEST_TRANSITIONS`): submit (DRAFT→PENDING), recall (PENDING→DRAFT), approve (PENDING→APPROVED), reject (PENDING→DRAFT, bắt buộc lý do), cancel (PENDING/APPROVED→CANCELLED, bắt buộc lý do, chỉ khi chưa có PO giữ số lượng), close (APPROVED→CLOSED, bắt buộc lý do).
- Sửa dòng chỉ khi `DRAFT`.
- `ordering_status` (`NONE`/`PARTIAL`/`FULL`) suy ra từ các dòng bằng `orderingStatusOf`, không sửa tay. Khi `FULL` thì tự chuyển `CLOSED` (không ghi lý do).
- Tổng `estimated_total` = Σ `qty_requested × est_unit_price`, làm tròn 2 số.

## 3. Duyệt và quyền

- `approve` cần quyền `APPROVE`, `reject` cần quyền `REJECT` (`ErpAction`). Không seed sẵn cho role nào; anh gán trong màn hình RBAC.
- Chặn tự duyệt: người duyệt phải khác `created_by` (`assertNotSelfApproval`).
- Mọi bước ghi một dòng vào `erp_approval_events` (`doc_type = PROCUREMENT_REQUEST`) trong cùng transaction, kèm tên role của người thao tác.
- Người thao tác lấy từ JWT (`req.user.sub`), không nhận từ body.
- Khóa: `pessimistic_write` trên header trước khi kiểm tra trạng thái.
- Lõi dùng chung `approval-core` (2026-11-06): không có dòng trong `erp_approval_settings` thì giữ hành vi cũ (LEGACY, `approverId` tùy chọn). Module họ thường không seed khóa.

## 4. Endpoint (`/api/v2/erp-procurement-requests`)

| Method | Path | Quyền |
| :--- | :--- | :--- |
| POST | `/` | CREATE |
| GET | `/` | READ |
| GET | `/:id` | READ |
| GET | `/:id/approval-events` | READ |
| GET | `/:id/po-draft` | READ (chỉ đọc, phần còn lại chưa đặt; PR chưa APPROVED → 409) |
| PATCH | `/:id/lines` | UPDATE (chỉ DRAFT) |
| POST | `/:id/submit`, `/recall`, `/cancel`, `/close` | UPDATE |
| POST | `/:id/approve` | APPROVE |
| POST | `/:id/reject` | REJECT (bắt buộc `reason`) |

Quyền resource: `procurement_requests`. Seed từ `purchase_requests` (read/create/update/delete).

## 5. Liên kết với PO

PO không import module này. Cổng `RequestLinkPort` do `ProcurementRequestLinkAdapter` (module `erp-procurement-orders`) cài đặt bằng `ProcurementRequestOrderingService`, export từ module này. Đặt hàng giữ số lượng bằng `reserve`/`release` trong cùng transaction với PO.

## 6. Tests

`procurement-request.controller.spec.ts` (RBAC metadata), `procurement-requests.service.spec.ts` (facade dùng `getUserRoleNames`). Lõi có spec riêng ở `src/v2/core/procurement-requests-core/`.

## Liên quan

- Module Garage tương ứng: [`garage-procurement-requests`](../garage-procurement-requests/SKILL.md)
- PO thường: [`erp-procurement-orders`](../erp-procurement-orders/SKILL.md)
- Nhật ký duyệt dùng chung: `src/v2/core/approval-core/`

## 9. Cập nhật 2026-11-05: PR không tự đóng

- Lõi `AbstractPurchaseRequestOrderingService` chỉ ghi `orderingStatus`. Đặt đủ không đổi `status`; `CLOSED` chỉ do Đóng thủ công (có lý do).
- Migration `20261105105000` đưa PR tự đóng cũ (`CLOSED`, `close_reason IS NULL`, `ordering_status = FULL`) về `APPROVED`.

## Response duyệt: khối `approval` (2026-11-08)

- Header PR/PO (list, detail, kết quả transition) trả `approval`: `{ approverId, approverEmail, submit, approve, reject, cancel, close, issue }`. Mỗi bước là `{ by, byEmail, at, reason? }` hoặc `null` khi chưa xảy ra. PR không có `issue`. `reason` chỉ có ở reject/cancel/close.
- `approverEmail` = người đã duyệt; chưa duyệt thì người được giao (`approvedBy ?? approverId`).
- Đã bỏ key phẳng (breaking, web đã sửa cùng đợt). PR: `submittedBy, approvedBy, approverId, approverEmail, rejectedBy, rejectReason, cancelReason, closeReason`. PO: `approverId, rejectReason, cancelReason, closeReason`.
- `closed_by` (migration `20261108130000`) ghi người đóng; tự đóng khi đủ hàng giữ `null`.
- Email resolve theo lô qua `resolveApprovalEmails` (approval-core), một lần cho cả trang, không N+1.
- Mapper dùng chung: `toApprovalSummary` (`core/approval-core/helpers/approval-summary.mapper.ts`).

## extraData (JSON tùy biến, 2026-11-08)

- **DB**: cột `extra_data jsonb NOT NULL DEFAULT '{}'` (CHECK: object) trên: `erp_proc_requests`, `erp_proc_request_lines`. Migration `20261108120000-add-extra-data-to-v2-tables.ts`. Dữ liệu cũ là `{}`.
- **DTO**: field `extraData?: Record<string, unknown>` (`@ExtraDataField()`, base-core). Không gửi thì không đổi.
- **Ghi**: tạo mặc định `{}`. Sửa header merge cấp 1 (`null` xóa key). Dòng chứng từ ghi theo payload, không merge.
- **Giới hạn**: 16 KB, sâu 5 cấp, key ≤ 64 ký tự, cấm `__proto__`/`constructor`/`prototype` (400 qua `RejectUnsafeExtraDataPipe` và service).
- **Response**: luôn có `extraData` (object).
