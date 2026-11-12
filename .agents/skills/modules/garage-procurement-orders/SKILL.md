---
name: garage-procurement-orders
description: Module tri thức Đơn mua (Procurement Order, PO) họ Garage trong erp-api. Chứa bảng proc_orders_garage / lines / acceptances (có branch_id, branch_name), vòng đời DRAFT → ISSUED → CLOSED, giao nhận GOODS, nghiệm thu SERVICE, tiền tố GDMH, quyền garage_procurement_orders và cổng liên kết PR Garage.
---

# Module Tri Thức: Đơn mua (Garage)

Module `src/v2/modules/procurement-orders-garage`. Dùng chung lõi `src/v2/core/procurement-orders-core` với họ thường. Khác biệt: bảng, quyền, tiền tố `GDMH`, chi nhánh, route, và cổng liên kết PR Garage.

## 1. Database

- `proc_orders_garage` (header), `proc_order_lines_garage` (dòng, FK `order_id`), `proc_order_acceptances_garage` (nghiệm thu, FK `order_id`, `order_line_id`).
- Migration: `20261105101000-CreateGarageProcurementTables.ts`.
- Cột giống họ thường (xem [`erp-procurement-orders`](../erp-procurement-orders/SKILL.md) mục 1), cộng `branch_id`, `branch_name` trên header.
- CHECK giống họ thường.

## 2. Vòng đời

Giống họ thường: DRAFT, PENDING_APPROVAL, APPROVED, ISSUED, CLOSED, CANCELLED, cộng REJECTED (xem mục 9). Các quy tắc submit, approve (chốt `approved_total`), reject, recall, issue, cancel, close giữ nguyên. `fulfillment_status` suy ra từ dòng.

- `approve`/`reject` cần `APPROVE`/`REJECT`, chặn tự duyệt.
- Nhật ký `erp_approval_events` với `doc_type = GARAGE_PROCUREMENT_ORDER`.
- Số phiếu: tiền tố `GDMH`.

## 3. Giao nhận và nghiệm thu

- GOODS: `POST :id/receipts` (`applyGoodsReceipt`), từ chối SERVICE, PO phải ISSUED.
- SERVICE: `POST :id/acceptances`, hủy bằng `POST :id/acceptances/:acceptanceId/void` (cần lý do, đánh dấu `is_voided`).
- Giống họ thường, `receipts` là endpoint tạm chờ module phiếu nhập kho Garage.

## 4. Chi nhánh

- `POST`: `branchId` **tùy chọn** (bỏ trống được). `GET /` lọc theo `branchId` nếu có.
- Đơn có PR nguồn (`request_id`): chi nhánh đơn phải khớp chi nhánh PR, kể cả cùng trống. Kiểm tra ở `POST` (`assertRequestSameBranch`, so sánh có xử lý null) và ở `PATCH` khi có đổi `branchId`.
- `PATCH /:id` nhận `branchId` (nullable) và `branchName` (nullable) khi còn DRAFT. Gửi `null` để bỏ trống.

## 5. Liên kết PR Garage

- Tạo PO từ đề nghị Garage (`request_id`, `request_line_id`). Đề nghị phải APPROVED, cùng họ Garage, không vượt phần còn lại.
- Cổng `GARAGE_PROCUREMENT_REQUEST_LINK` cài bởi `GarageProcurementRequestLinkAdapter` (`services/garage-procurement-request-link.adapter.ts`), trỏ vào `GarageProcurementRequestOrderingService` của module `garage-procurement-requests`.

## 6. Endpoint (`/api/v2/procurement-orders-garage`)

Cùng bộ endpoint họ thường: `POST /`, `GET /`, `GET /:id`, `GET /:id/approval-events`, `PATCH /:id/lines`, `POST` cho submit, recall, approve, reject, issue, cancel, close, receipts, acceptances, và void.

Quyền resource: `garage_procurement_orders`. Seed từ `garage_purchase_orders` (quyền cũ đã gỡ ở migration `20261106100000`).

## 7. Tests

`procurement-order.controller.spec.ts` (RBAC), `procurement-order.di.spec.ts` (DI cổng `GARAGE_PROCUREMENT_REQUEST_LINK`).

## Liên quan

- Đề nghị Garage: [`garage-procurement-requests`](../garage-procurement-requests/SKILL.md)
- Họ thường: [`erp-procurement-orders`](../erp-procurement-orders/SKILL.md)

## 12. Khóa duyệt và chọn người duyệt (2026-11-06)

- Khóa BE, không có UI, `doc_type = GARAGE_PROCUREMENT_ORDER`, mặc định **tắt** (migration `20261106120000-SetGarageProcurementOrderApprovalOff`). Đọc: `GET /api/v2/approval-config/garage-procurement-orders/setting`. Đổi: `PATCH` cùng path (quyền `admin_users:update`).
- Khóa **tắt**: submit tự duyệt (`AUTO_APPROVED`) và vẫn chốt `approved_total`. Người dùng không chọn người duyệt.
- Khóa **bật**: `POST /:id/submit` nhận `{ approverId }` bắt buộc; chỉ người đó approve/reject (403 nếu khác); lưu `approver_id` trên `proc_orders_garage`. Quy tắc giống đề nghị Garage (mục 11 bên đó).
- Danh sách người duyệt: `GET /api/v2/approval-config/garage-procurement-orders/approvers`.
- Migration bật khóa: `20261106110000-AddApprovalSettingsAndApprover.ts`; đổi mặc định PO: `20261106120000-SetGarageProcurementOrderApprovalOff.ts`.

## 8. Cập nhật 2026-11-05: sửa nháp, xóa, thanh toán, GR

- Migration `20261105103000-AddPaymentFieldsToGarageProcOrders`: `payment_status varchar(50) NOT NULL DEFAULT 'UNPAID'` (có chỉ mục) và `supplier_invoice_no varchar(100) NULL`. Chưa có luồng ghi `payment_status`; chỉ hiển thị.
- Endpoint mới: `PATCH /:id` (sửa đầu đơn khi DRAFT, `UpdateProcurementOrderHeaderDto`), `DELETE /:id` (xóa mềm nháp, trả số lượng đã giữ trên PR), `GET /next-no`, `GET /column-options`.
- `GET /` lọc thêm `status`, `supplierId`, `dateFrom`, `dateTo`, `search` (số đơn hoặc tên NCC).
- Response có `branchId`, `branchName`, `paymentStatus`, `supplierInvoiceNo`, `issuedAt`, `acceptances` (`createdBy` và `createdByEmail` nằm ở lõi PO, dùng chung cho list và detail).
- Quyền duyệt: `approve`/`reject` đã seed cho vai trò có `update` trên `garage_procurement_orders` (migration `20261105104000-SeedGarageProcurementApprovalPermissions`).
- Phiếu nhập kho Garage nối PO: `GarageGoodsReceiptCommandService.post` gọi `applyGoodsReceipt`, `cancel` gọi `revertGoodsReceipt` trong cùng transaction. Xem [`garage-goods-receipts`](../garage-goods-receipts/SKILL.md) mục nối PO.
- Rủi ro còn lại: `POST :id/receipts` vẫn cộng số đã nhận. Dùng song song với phiếu nhập có thể cộng trùng. Chưa chặn.

## 9. Cập nhật 2026-11-05: bỏ nhận hàng trực tiếp trên PO

- Đã gỡ `POST /api/v2/procurement-orders-garage/:id/receipts` và `ReceiveGoodsDto`. Nhận hàng GOODS chỉ qua phiếu nhập kho (GR) `post`; hủy GR đã post hoàn số đã nhận.
- Nghiệm thu dịch vụ (`acceptances`) không đổi.
- `/api/v2/procurement-orders-erp` (luồng thường) vẫn giữ `receipts` vì chưa nối GR.

## 10. Xóa mềm và xóa cứng (2026-11-05)

- `DELETE /api/v2/procurement-orders-garage/:id`: xóa mềm nháp, trả SL giữ về PR nguồn. Quyền `DELETE`.
- `DELETE /api/v2/procurement-orders-garage/:id/permanent`: xóa cứng nháp, trả SL giữ về PR nguồn trước khi xóa. Quyền `PURGE` (chỉ admin). Chặn khi còn phiếu nhập tham chiếu, kể cả phiếu đã hủy (khóa ngoại RESTRICT). Xóa dòng rồi đầu đơn; nghiệm thu đi theo dòng (CASCADE); lịch sử duyệt được giữ.
- Chính sách và điều kiện chung: `.agents/workflows/api-structure.md` mục "Chính sách xóa".

## 11. Lọc cột và gợi ý giá trị (2026-11-05)

- `GET /api/v2/procurement-orders-garage/column-options?column&search&page&pageSize&filters`: trả `{ items, pagination }` (cùng contract với `garage-procurement-requests`). Cột ngoài whitelist trả rỗng. Nguồn cột: `constants/procurement-order-table.constants.ts` (`TABLE_COLUMNS`), khớp `key` của `procurementOrderColumns` phía web.
- `GET /` nhận thêm `sort`, `column_filters`, `column_search`, `column_operators`, `date_ranges` (từ `TableQueryDto`). Sắp xếp mặc định `createdAt DESC`.
- Lỗi đã sửa: endpoint trước đây trả `{ columns }`, khiến web crash `reading 'value'` khi mở popup lọc cột.
- `createdBy` (uuid) được lọc, sắp xếp và gợi ý theo **email** từ `core_users` (subquery trong `TABLE_COLUMNS`). Danh sách và chi tiết đều trả `createdBy` (id) và `createdByEmail` (tra email qua lô id của approval-core). Không đổi schema.

## Response duyệt: khối `approval` (2026-11-08)

- Header PR/PO (list, detail, kết quả transition) trả `approval`: `{ approverId, approverEmail, submit, approve, reject, cancel, close, issue }`. Mỗi bước là `{ by, byEmail, at, reason? }` hoặc `null` khi chưa xảy ra. PR không có `issue`. `reason` chỉ có ở reject/cancel/close.
- Danh sách (`GET /`) trả `{ items, pagination: { page, pageSize, total, totalPages }, summaries }`. `summaries` theo `summary_keys` (helper `applyListSummaries`): với `totalAmount` trả `{ total, pageSubtotal, cumulative }`; key không có trong whitelist trả `null`; không gửi `summary_keys` thì `{}`. Web gửi key từ cột có `summary`, hiển thị ở cột `totalAmount`.
- `approverEmail` = người đã duyệt; chưa duyệt thì người được giao (`approvedBy ?? approverId`).
- Đã bỏ key phẳng (breaking, web đã sửa cùng đợt). PR: `submittedBy, approvedBy, approverId, approverEmail, rejectedBy, rejectReason, cancelReason, closeReason`. PO: `approverId, rejectReason, cancelReason, closeReason`.
- `closed_by` (migration `20261108130000`) ghi người đóng; tự đóng khi đủ hàng giữ `null`.
- Email resolve theo lô qua `resolveApprovalEmails` (approval-core), một lần cho cả trang, không N+1.
- Mapper dùng chung: `toApprovalSummary` (`core/approval-core/helpers/approval-summary.mapper.ts`).

## extraData (JSON tùy biến, 2026-11-08)

- **DB**: cột `extra_data jsonb NOT NULL DEFAULT '{}'` (CHECK: object) trên: `proc_orders_garage`, `proc_order_lines_garage`, `proc_order_acceptances_garage`. Migration `20261108120000-add-extra-data-to-v2-tables.ts`. Dữ liệu cũ là `{}`.
- **DTO**: field `extraData?: Record<string, unknown>` (`@ExtraDataField()`, base-core). Không gửi thì không đổi.
- **Ghi**: tạo mặc định `{}`. Sửa header merge cấp 1 (`null` xóa key). Dòng chứng từ ghi theo payload, không merge.
- **Giới hạn**: 16 KB, sâu 5 cấp, key ≤ 64 ký tự, cấm `__proto__`/`constructor`/`prototype` (400 qua `RejectUnsafeExtraDataPipe` và service).
- **Response**: luôn có `extraData` (object).

## Lọc phiếu đã xóa mềm (`deleted`)

- **Query**: `GET /api/v2/procurement-orders-garage?deleted=only` chỉ trả đơn `isDeleted = true`; thiếu tham số thì giữ `isDeleted = false`. Gợi ý cột (`column-options`) nhận cùng tham số.
- **Xóa cứng**: `hardDeleteDraft` dùng `lockHeader(..., includeDeleted=true)` và chỉ trả số lượng giữ khi đơn chưa xóa mềm, tránh trả trùng với `softDeleteDraft`.

## 9. Cập nhật 2026-11-11: từ chối → REJECTED và nhân bản

- Từ chối PO chuyển `PENDING_APPROVAL → REJECTED` (trước đây về DRAFT). REJECTED khóa mọi thao tác, chỉ còn xem, lịch sử và nhân bản.
- Nhân bản: `POST /api/v2/procurement-orders-garage/:id/clone` (quyền CREATE) từ phiếu REJECTED hoặc CANCELLED. Tạo nháp mới, giữ `requestId`/`requestLineId` của PR nguồn (`createDraft` giữ lại số lượng PR), gán `cloned_from_id`. Không copy trạng thái duyệt hay lý do. Trạng thái khác → 409. Không tồn tại → 404.
- Reject PO trả số lượng đã giữ về PR nguồn (như cancel).
- Duyệt PO garage đang tắt (`GARAGE_PROCUREMENT_ORDER`): `submit` đi thẳng sang APPROVED. Web dùng nút "Tạo mới"/"Cập nhật" để lưu và gửi trong một bước (xem skill web `garage-procurement-requests`).

## Cập nhật 2026-11-11: thu hồi và nhận hàng

- Thu hồi (`recall`) chỉ người tạo (`created_by`), áp ở lõi `procurement-orders-core`; người duyệt hoặc người khác nhận 403 "Chỉ người tạo mới được thu hồi". Web ẩn nút qua `applyApprovalGate`.
- Nhận hàng (GR post/cancel) đi qua orchestrator `procurement-flow-garage` (xem skill của module đó): tăng/hoàn `qty_fulfilled` và ghi sổ `garage_stock_*` cùng transaction. Người tạo PO nhận thông báo sau commit (đích `PROCUREMENT_ORDER_GARAGE`, web chưa có deep link).

## 13. Cập nhật 2026-11-12: tạo/cập nhật và ghi nhận một bước (save-and-confirm)

- Endpoint mới: `POST /api/v2/procurement-orders-garage/save-and-confirm` (tạo) và `PATCH /api/v2/procurement-orders-garage/:id/save-and-confirm` (sửa nháp, kèm dòng). Body là DTO tạo/sửa + `approverId?`.
- Điều phối qua `GarageProcurementOrderFlowService.saveAndSubmit`: lưu rồi submit trong MỘT transaction. Lỗi submit (vd. thiếu NCC) rollback cả đơn nháp, nên PR nguồn không bị giữ số lượng bởi đơn mồ côi (đây là gốc của lỗi 409 "vượt phần còn lại").
- Khóa duyệt PO tắt: submit ghi nhận luôn (APPROVED). Bật: cần `approverId`.
- Endpoint cũ (`POST /`, `PATCH /:id`, `POST /:id/submit`) giữ nguyên.

## 14. Cập nhật 2026-11-12: requestNo (đề nghị nguồn)

- List và detail đơn mua trả thêm `requestNo` (số đề nghị nguồn). Đơn lập trực tiếp (không có `requestId`) trả `null`.
- Tra cứu bằng `GarageProcurementOrderRequestRefService.requestNos(ids)` (`services/garage-procurement-order-request-ref.service.ts`): một query theo lô, không lọc `isDeleted` nên đề nghị đã xóa mềm vẫn hiện số. Module chỉ đăng ký entity PR (`GarageProcurementRequest`).

## 15. Cập nhật 2026-11-12: lọc, sắp xếp và gợi ý cột Đề nghị mua

- `requestNo` nằm trong `TABLE_COLUMNS` dưới dạng sub-select (`proc_requests_garage.request_no` theo `h.requestId`), nên lọc, sắp xếp và `column-options` dùng chung cơ chế với các cột khác.
- Quan hệ 1-1 (mỗi PO tối đa một đề nghị). Đơn lập trực tiếp có `requestNo` rỗng, nên lọc "trống" bắt được chúng.
- Spec: `services/procurement-order-query.service.spec.ts`.

## Hợp đồng phân trang chuẩn v2 (pagination)

- List trả `{ items, pagination, summaries? }`; `pagination` = `{ page, pageSize, total, totalPages, next, previous }` (`next`/`previous` là số trang hoặc `null`). Không còn key phẳng `total`/`page`/`totalPages` ở cấp gốc.
- Column-options trả `{ items: { label, value }[], pagination }`. Dựng bằng `findTableColumnOptions` hoặc `emptyOptionsPage` (`src/common/utils/table-query`).
- Builder: `buildPagination` / `toPagedList` / `toPaginatedResult` (`src/common/utils/paginated-result.ts`). DTO Swagger: `PaginationMetaDto`, `ColumnOptionsResponseDto`.
- Web phải đọc `res.pagination.*`. Xem web `src/v2/shared/utils/v2FetchOptionsAdapter.ts`.
