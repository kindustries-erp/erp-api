---
name: garage-procurement-requests
description: Module tri thức Đề nghị mua (Purchase Request) họ Garage trong erp-api. Chứa bảng erp_garage_proc_requests / erp_garage_proc_request_lines (có branch_id, branch_name), vòng đời duyệt giống họ thường, tiền tố số GDNM, quyền garage_procurement_requests, endpoint và cổng liên kết PO Garage.
---

# Module Tri Thức: Đề nghị mua (Garage)

Module `src/v2/modules/garage-procurement-requests`. Dùng chung lõi `src/v2/core/procurement-requests` với họ thường. Khác biệt chỉ nằm ở bảng, quyền, tiền tố số, chi nhánh và route.

## 1. Database

- Bảng `erp_garage_proc_requests` (header) và `erp_garage_proc_request_lines` (dòng, FK `request_id` ON DELETE CASCADE).
- Migration: `20261105101000-CreateGarageProcurementTables.ts`.
- Cột giống họ thường (xem [`erp-procurement-requests`](../erp-procurement-requests/SKILL.md) mục 1), cộng thêm:
  - Header: `branch_id` (uuid), `branch_name`.
- CHECK giống họ thường: `line_type IN ('GOODS','SERVICE')`, `0 <= qty_ordered <= qty_requested`.
- Chỉ mục theo chi nhánh trên header.

## 2. Vòng đời và duyệt

Giống hệt họ thường: `DRAFT → PENDING_APPROVAL → APPROVED → CLOSED / CANCELLED`, `ordering_status` suy ra từ dòng, sửa dòng chỉ ở DRAFT.

- `approve` cần `APPROVE`, `reject` cần `REJECT`, chặn tự duyệt, lý do bắt buộc khi reject/cancel/close.
- Nhật ký `erp_approval_events` với `doc_type = GARAGE_PROCUREMENT_REQUEST`.
- Số phiếu: tiền tố `GDNM`.

## 3. Chi nhánh

- `POST` bắt buộc `branchId` (UUID). `branchName` tùy chọn.
- `GET /` lọc theo `branchId` nếu có. `findOne` không lọc chi nhánh, chỉ theo `id` và `is_deleted = false`.

## 4. Endpoint (`/api/v2/garage-procurement-requests`)

Cùng bộ endpoint với họ thường: `POST /`, `GET /`, `GET /:id`, `GET /:id/approval-events`, `GET /:id/po-draft`, `PATCH /:id/lines`, `POST /:id/submit|recall|approve|reject|cancel|close`.

Quyền resource: `garage_procurement_requests`. Seed từ `garage_purchase_orders` (read/create/update/delete).

## 5. Liên kết với PO Garage

- Cổng `GARAGE_PROCUREMENT_REQUEST_LINK` (Symbol) do `GarageProcurementRequestLinkAdapter` (module `garage-procurement-orders`) cài đặt, trỏ vào `GarageProcurementRequestOrderingService` của module này.
- PO Garage chỉ nhận đề nghị Garage. Đề nghị họ thường không dùng được cho PO Garage, và ngược lại.

## 6. Tests

`procurement-request.controller.spec.ts` (RBAC, có test `approvalEvents`/`poDraft` READ), `procurement-requests.service.spec.ts` (facade).

## Liên quan

- PO Garage: [`garage-procurement-orders`](../garage-procurement-orders/SKILL.md)
- Họ thường: [`erp-procurement-requests`](../erp-procurement-requests/SKILL.md)

## 8. Cập nhật 2026-11-05: sửa đầu đề nháp

- `PATCH /api/v2/garage-procurement-requests/:id`: sửa `requestDate`, `neededDate`, `title`, `remarks` khi còn DRAFT (lõi `updateHeader`, khóa header, `assertLinesEditable`). Chi nhánh không nằm trong patch, vì PO đã liên kết có thể dùng chi nhánh cũ.
- DTO: `UpdateProcurementRequestHeaderDto`. Spec: `core/procurement-requests/services/abstract-purchase-request-header.spec.ts`.
- `GET /:id/po-draft` trả phần còn lại chưa đặt (`qtyRemaining`) để điền sẵn PO. Web dùng khi "Tạo PO từ PR".
