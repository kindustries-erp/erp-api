---
name: file-attachments
description: Module backend file đính kèm dùng chung (v2) tại /api/v2/file-attachments-management và /api/v2/invoices/:id/attachments, bảng file_attachments + file_attachment_settings, lưu trên R2. Lõi file-attachments-core chỉ có base. Đọc khi thêm owner mới (Garage PR), sửa upload/xóa/purge hoặc backfill hóa đơn.
---

# 📎 Module Backend Tri Thức: File Attachments (`file-attachments`)

## 1. Tổng quan & phân tầng
- **Lõi** `src/v2/core/file-attachments-core/` (chỉ base, không `@Entity`/`@Controller`/bảng): `BaseFileAttachmentEntity`, `FileOwnerType` (`INVOICE`), `FileCategory` (`HOA_DON`, `BANG_KE`, `HOP_DONG`, `KHAC`), `FileOrigin` (`V2`, `LEGACY`), hợp đồng `StoragePolicyProvider` (token `STORAGE_POLICY_PROVIDER`, `STORAGE_HARD_LIMITS` 20MB/10 file), `FileOwnerPolicyPort`, `FileKeyReferenceSource` (token `FILE_KEY_REFERENCE_SOURCES`), `FileOwnerRegistry`, helper `sanitizeFileName` và `buildStorageKey` (`files/{owner}/{yyyy}/{mm}/{uuid}_{safeName}`).
- **Module** `src/v2/modules/file-attachments-management/`: entity `FileAttachment` (`file_attachments`) và `FileAttachmentSettings` (`file_attachment_settings`, một dòng id=1), `FileStorageGateway` (bọc `R2Service`), command/query/settings/purge service, `FileKeyReferenceChecker`, facade `FileAttachmentsService`, job `FileAttachmentPurgeJob`, controller quản lý, script backfill.
- **Owner Hóa đơn** nằm trong `src/v2/modules/invoices-finance/`: `invoice-file-owner.policy.ts` (đăng ký INVOICE khi khởi tạo, không khóa theo trạng thái) và `invoice-attachments.controller.ts` (controller mỏng).

## 2. Hợp đồng HTTP
Theo owner (RBAC `invoices`: READ/UPDATE), prefix `api/v2/invoices/:id/attachments`:
- `GET /` → `{ items, pagination, extraData: { policy, categories } }`
- `POST /` multipart `files` (+ body `category`) → `{ message, data: items[] }`
- `GET /:attachmentId/download-url?inline=` → `{ data: { url, expiresIn } }` (pre-signed 300s)
- `DELETE /:attachmentId` → xóa mềm. `attachmentId` phải khớp owner, sai trả 404 (chặn IDOR).

Quản lý toàn hệ thống (RBAC `attachments`), prefix `api/v2/file-attachments-management`:
- `GET /` (`deleted=only`, filter bảng chuẩn `column_filters` …), `GET /column-options` (nhận `filters` dạng envelope JSON hoặc `{col:[values]}`, và `deleted`), `GET /:id`, `GET /:id/download-url`
- `DELETE /:id` (DELETE, xóa mềm), `DELETE /:id/permanent` và `POST /purge` body `{ ids }` tối đa 100 (**PURGE**), `GET/PATCH /settings` (READ/UPDATE).
- Mọi query param phải khai báo trong DTO hoặc `@Query('name')` vì `ValidationPipe` bật `forbidNonWhitelisted`.

## 3. Quy tắc nghiệp vụ
- Response không lộ `file_key`. Key do server sinh, tên file sanitize; upload kiểm trần cứng ở interceptor, rồi theo `StoragePolicy` (đuôi, MIME, size); lỗi ghi DB thì xóa object vừa upload.
- **Xóa mềm** chỉ set `is_deleted`; object R2 giữ nguyên.
- **Xóa cứng** (`FileAttachmentPurgeService.purge(ids)`), mỗi file một transaction: khóa dòng (`pessimistic_write`) + `pg_advisory_xact_lock(hashtext(file_key))`; chỉ nhận dòng đã xóa mềm (khác → `skipped` với `NOT_FOUND`/`NOT_SOFT_DELETED`/`STORAGE_ERROR`); `FileKeyReferenceChecker` đếm tham chiếu ngoài dòng đang xóa qua các source (`file_attachments`, `erp_attachments`, `erp_invoices.pdf_file_key|xml_file_key|pdf_files[].key`); 0 tham chiếu → xóa object R2 (`objectDeleted`), >0 → chỉ xóa dòng và giữ object (`objectKept`, `remainingReferences`); lỗi R2 giữ dòng. Có audit mỗi lần.
- **PURGE** chỉ qua action `*` (Super Admin) vì ma trận RBAC chưa có cột purge.
- **Job** `file-attachment-purge` (`ScheduledJob`, cron `0 15 3 * * *` Asia/Ho_Chi_Minh, cần `ENABLE_CRON`): đọc settings mỗi lần; `autoPurgeEnabled=false` (mặc định) thì no-op; tối đa 20 lô × 100.
- Settings: `retentionDays` nguyên 1..3650 (mặc định lưu 30, chỉ có tác dụng khi bật).

## 4. Dữ liệu & backfill
- Migration `20261116100000-create-file-attachments.ts` (có `down()`), unique một phần `(owner_type, owner_id, file_key) WHERE is_deleted=false`.
- Backfill `scripts/backfill-invoice-files.ts`: mặc định dry-run; `--apply --confirm=<tên DB>`; nạp env bằng `load-script-env`; khử trùng theo (hóa đơn, file_key) ưu tiên bản có metadata; idempotent. Dữ liệu legacy có `file_size = 0` (không có metadata). Rollback: `DELETE FROM file_attachments WHERE origin='LEGACY'`.
- Smoke: `bun run test:smoke:file-attachments` (đọc `SEED_ADMIN_*` từ `.env`; `E2E_PASSWORD` là của tài khoản ai-test-*, không đăng nhập admin được).

## 5. Thêm owner mới (ví dụ Garage PR) — không sửa core
1. Thêm giá trị vào `FileOwnerType`.
2. Viết `<owner>-file-owner.policy.ts` implement `FileOwnerPolicyPort` (`assertExists`, `assertCanModify` theo trạng thái, `allowedCategories`) và đăng ký vào `FileOwnerRegistry` khi `onModuleInit`.
3. Viết controller mỏng `api/v2/<owner>/:id/attachments` gọi facade (`listForOwner`, `uploadForOwner`, `downloadUrlForOwner`, `deleteForOwner`) với RBAC resource riêng đã có trong ma trận; import `FileAttachmentsModule`.
4. Nếu owner có bảng giữ khóa file riêng, thêm một `FileKeyReferenceSource` để xóa cứng không phá object dùng chung.
5. Web: dùng `createV2OwnerFilesApi` + `V2AttachmentsPanel` (xem module skill web `file-attachments`).

## 6. Còn mở (plan sau)
Phase 5 cutover V1 (`LegacyFileRegistrar`, web V1 gọi V2, deprecation log) chưa làm; V1 `erp-attachments`, `erp-invoices/:id/pdfs` vẫn là đường ghi song song. Garage PR là owner tiếp theo.
