---
name: garage-procurement-requests
description: Module tri thức Đề nghị mua (Purchase Request) họ Garage trong erp-api. Chứa bảng proc_requests_garage / proc_request_lines_garage (có branch_id, branch_name), vòng đời duyệt giống họ thường, tiền tố số GDNM, quyền garage_procurement_requests, endpoint và cổng liên kết PO Garage.
---

# Module Tri Thức: Đề nghị mua (Garage)

Module `src/v2/modules/procurement-requests-garage`. Dùng chung lõi `src/v2/core/procurement-requests-core` với họ thường. Khác biệt chỉ nằm ở bảng, quyền, tiền tố số, chi nhánh và route.

## 1. Database

- Bảng `proc_requests_garage` (header) và `proc_request_lines_garage` (dòng, FK `request_id` ON DELETE CASCADE).
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

- `POST`: `branchId` (UUID) **tùy chọn**, có thể bỏ trống (`null`/không gửi). `branchName` tùy chọn.
- Chi nhánh là một giá trị (không mảng). Cột `branch_id` nullable từ đầu, không cần migration khi đổi sang tùy chọn.
- `GET /` lọc theo `branchId` nếu có. `findOne` không lọc chi nhánh, chỉ theo `id` và `is_deleted = false`.

## 4. Endpoint (`/api/v2/procurement-requests-garage`)

Cùng bộ endpoint với họ thường: `POST /`, `GET /`, `GET /:id`, `GET /:id/approval-events`, `GET /:id/po-draft`, `PATCH /:id/lines`, `POST /:id/submit|recall|approve|reject|cancel|close`.

**Response & nhật ký (cập nhật 2026-11-07)**:
- Khối duyệt thống nhất `approval` (xem mục "Response duyệt" cuối file). Không còn key phẳng `approverEmail`/`approvedBy`/`rejectReason`... Response trả cả `createdBy` (id người tạo, để nhận diện người tạo khi duyệt) và `createdByEmail` (để hiển thị).
- `ApprovalEventResponseDto` (`GET /:id/approval-events`) có thêm `actorName` (họ tên nhân viên) và `actorEmail`, resolve bởi `ApprovalActorService`. Không có `id` nội bộ của nhật ký.
- `TABLE_COLUMNS` (`procurement-request-table.constants.ts`): `createdBy`/`created_by` và `approver` lọc, sắp xếp và liệt kê option theo email (subselect `core_users.email`), không theo UUID.
- Module đăng ký `CoreUser` trong `TypeOrmModule.forFeature` để `ApprovalActorService` inject được (xem `approval-actor-wiring.spec.ts`).

Quyền resource: `garage_procurement_requests`. Seed từ `garage_purchase_orders` (read/create/update/delete; quyền cũ đã gỡ ở migration `20261106100000`).

## 5. Liên kết với PO Garage

- Cổng `GARAGE_PROCUREMENT_REQUEST_LINK` (Symbol) do `GarageProcurementRequestLinkAdapter` (module `garage-procurement-orders`) cài đặt, trỏ vào `GarageProcurementRequestOrderingService` của module này.
- PO Garage chỉ nhận đề nghị Garage. Đề nghị họ thường không dùng được cho PO Garage, và ngược lại.

## 6. Tests

`procurement-request.controller.spec.ts` (RBAC, có test `approvalEvents`/`poDraft` READ), `procurement-requests.service.spec.ts` (facade).

## Liên quan

- PO Garage: [`garage-procurement-orders`](../garage-procurement-orders/SKILL.md)
- Họ thường: [`erp-procurement-requests`](../erp-procurement-requests/SKILL.md)

## 8. Cập nhật 2026-11-05: sửa đầu đề nháp

- `PATCH /api/v2/procurement-requests-garage/:id`: sửa `requestDate`, `neededDate`, `title`, `remarks` khi còn DRAFT (lõi `updateHeader`, khóa header, `assertLinesEditable`).
- Chi nhánh (`branchId`, `branchName`, đều nullable) sửa được khi DRAFT, gửi `null` để bỏ trống. Override `updateHeader` trong `procurement-request-command.service.ts`: nếu chi nhánh thực sự đổi và đề nghị đã có đơn mua tham chiếu (kể cả đơn đã xóa mềm) thì trả `409 Conflict`. Không đổi thì không kiểm tra.
- DTO: `UpdateProcurementRequestHeaderDto`. Spec: `core/procurement-requests/services/abstract-purchase-request-header.spec.ts`.
- `GET /:id/po-draft` trả phần còn lại chưa đặt (`qtyRemaining`) để điền sẵn PO. Web dùng khi "Tạo PO từ PR".

## 9. Cập nhật 2026-11-05: PR không tự đóng

- Đặt đủ số lượng chỉ ghi `orderingStatus = FULL`; PR giữ `status = APPROVED`. Không còn tự chuyển `CLOSED`, không còn tự mở lại khi trả số lượng.
- `CLOSED` chỉ do người dùng bấm Đóng (bắt buộc lý do). Hủy hoặc xóa nháp PO trả số lượng: `orderingStatus` về `PARTIAL`/`NONE`, `status` không đổi.
- Web: ẩn "Tạo PO" khi `APPROVED` và `FULL`; nút Đóng vẫn có. Migration `20261105105000` đưa các PR tự đóng cũ về `APPROVED`.

## 10. Xóa mềm và xóa cứng (2026-11-05)

- `DELETE /api/v2/procurement-requests-garage/:id`: xóa mềm nháp. Quyền `DELETE`. Chặn khi không phải `DRAFT` hoặc còn số lượng đang được đơn mua giữ.
- `DELETE /api/v2/procurement-requests-garage/:id/permanent`: xóa cứng nháp. Quyền `PURGE` (chỉ admin). Chặn khi còn đơn mua tham chiếu, kể cả đơn đã xóa mềm (khóa ngoại RESTRICT). Xóa dòng rồi đầu đề; lịch sử duyệt được giữ.
- Chính sách và điều kiện chung: `.agents/workflows/api-structure.md` mục "Chính sách xóa".

## 11. Khóa duyệt và chọn người duyệt (2026-11-06)

- Khóa bật/tắt nằm ở BE, không có UI: bảng `erp_approval_settings`, `doc_type = GARAGE_PROCUREMENT_REQUEST`, mặc định **bật**. Đọc: `GET /api/v2/approval-config/garage-procurement-requests/setting` (đăng nhập là đọc được). Đổi: `PATCH` cùng path (quyền `admin_users:update`).
- Khóa **bật**: `POST /:id/submit` nhận body `{ approverId }` (bắt buộc). Người duyệt phải ACTIVE, có `APPROVE` và `REJECT` trên `garage_procurement_requests`, khác người gửi. Lưu `approver_id` (cột mới trên `proc_requests_garage`). Chỉ đúng người đó approve/reject được, người khác nhận 403. Recall/reject về DRAFT xóa `approver_id`.
- Khóa **tắt**: submit tự duyệt trong cùng transaction, ghi event `AUTO_APPROVED`, không cần người duyệt.
- Danh sách người duyệt: `GET /api/v2/approval-config/garage-procurement-requests/approvers` (loại người đang gọi).
- Logic dùng chung ở `src/v2/core/approval-core` (`approval-gate.helper.ts`, `approval-settings.service.ts`, `approver-directory.service.ts`); module chỉ khai báo `docType` và resource.
- Migration: `20261106110000-AddApprovalSettingsAndApprover.ts`.
- Thông báo (2026-11-09): `services/procurement-request-notifier.service.ts` gọi sau transition thành công (facade `procurement-requests-garage.service.ts`). Gửi duyệt có người duyệt → báo `approverId` (`target.action = APPROVE`). Duyệt / từ chối → báo người tạo (`target.action = VIEW`, từ chối kèm lý do). Khóa tắt (AUTO), không có người duyệt, hoặc người thao tác trùng người nhận → không gửi. Đích: `PROCUREMENT_REQUEST_GARAGE`. Lỗi gửi chỉ log, không làm hỏng transition.

## Response duyệt: khối `approval` (2026-11-08)

- Header PR/PO (list, detail, kết quả transition) trả `approval`: `{ approverId, approverEmail, submit, approve, reject, cancel, close, issue }`. Mỗi bước là `{ by, byEmail, at, reason? }` hoặc `null` khi chưa xảy ra. PR không có `issue`. `reason` chỉ có ở reject/cancel/close.
- Danh sách (`GET /`) trả `{ items, pagination: { page, pageSize, total, totalPages }, summaries }`. `summaries` theo `summary_keys` (helper `applyListSummaries`): `estimatedTotal` trả `{ total, pageSubtotal, cumulative }`; key ngoài whitelist trả `null`; không gửi `summary_keys` thì `{}`. Web hiển thị ở cột `estimatedTotal`. `estimatedTotal` có trong `TABLE_COLUMNS` nên lọc số được.
- `approverEmail` = người đã duyệt; chưa duyệt thì người được giao (`approvedBy ?? approverId`).
- Đã bỏ key phẳng (breaking, web đã sửa cùng đợt). PR: `submittedBy, approvedBy, approverId, approverEmail, rejectedBy, rejectReason, cancelReason, closeReason`. PO: `approverId, rejectReason, cancelReason, closeReason`.
- `closed_by` (migration `20261108130000`) ghi người đóng; tự đóng khi đủ hàng giữ `null`.
- Email resolve theo lô qua `resolveApprovalEmails` (approval-core), một lần cho cả trang, không N+1.
- Mapper dùng chung: `toApprovalSummary` (`core/approval-core/helpers/approval-summary.mapper.ts`).

## extraData (JSON tùy biến, 2026-11-08)

- **DB**: cột `extra_data jsonb NOT NULL DEFAULT '{}'` (CHECK: object) trên: `proc_requests_garage`, `proc_request_lines_garage`. Migration `20261108120000-add-extra-data-to-v2-tables.ts`. Dữ liệu cũ là `{}`.
- **DTO**: field `extraData?: Record<string, unknown>` (`@ExtraDataField()`, base-core). Không gửi thì không đổi.
- **Ghi**: tạo mặc định `{}`. Sửa header merge cấp 1 (`null` xóa key). Dòng chứng từ ghi theo payload, không merge.
- **Giới hạn**: 16 KB, sâu 5 cấp, key ≤ 64 ký tự, cấm `__proto__`/`constructor`/`prototype` (400 qua `RejectUnsafeExtraDataPipe` và service).
- **Response**: luôn có `extraData` (object).

## Lọc phiếu đã xóa mềm (`deleted`)

- **Query**: `GET /api/v2/procurement-requests-garage?deleted=only` chỉ trả phiếu `isDeleted = true`. Thiếu tham số thì giữ `isDeleted = false`. Giá trị khác `only` bị DTO từ chối (`@IsIn(['only'])`).
- **Gợi ý cột**: `GET .../column-options?deleted=only` áp dụng cùng điều kiện. Số liệu `summaries` của list tự khớp vì cùng query builder.
- **Xóa cứng phiếu đã xóa mềm**: `lockHeader(manager, id, includeDeleted=true)` trong `hardDeleteDraft` (cả PR và PO), không còn 404 với phiếu đã xóa mềm. Với PO, không trả lại số lượng giữ lần nữa vì `softDeleteDraft` đã trả (`if (!header.isDeleted) releaseHeldQty`).
- **Quyền**: `deleted=only` chỉ dùng quyền đọc danh sách; xóa cứng vẫn yêu cầu `PURGE` ở controller (`DELETE :id/permanent`).
- **Không có restore**: chưa có endpoint khôi phục phiếu đã xóa mềm.

- **Đã xử lý trước đó (409)**: `approval.engine` `resolveTransition` trả `ConflictException` với body `{ code: 'INVALID_STATUS_TRANSITION', message, action, currentStatus }`. Web dùng `code` và `currentStatus` để hiện modal "đã xử lý" thay vì toast chung. Message giữ nguyên để tương thích ngược.
