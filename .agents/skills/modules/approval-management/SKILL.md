---
name: approval-management
description: Module tri thức Duyệt chứng từ V2 trong erp-api gồm lõi base-only src/v2/core/approval-core (engine chuyển trạng thái, gate helper, BaseApprovalFields, BaseApprovalEventEntity, cổng ApprovalEventRecorder) và module src/v2/modules/approval-management (entity erp_approval_events, erp_approval_settings, ApprovalEventService, ApprovalSettingsService, ApprovalActorService, ApproverDirectoryService, factory createApprovalConfigController). Dùng cho PR, PO garage/erp và chứng từ kho.
---

# Module Tri Thức: Approval V2 - Backend (`erp-api`)

## 1. Phạm vi

- Lõi `src/v2/core/approval-core` chỉ là base (không `@Entity`, `@Controller`, Nest module; không import module): `approval.engine.ts` (hàm thuần chuyển trạng thái), `approval-gate.helper.ts` (chế độ LEGACY/REQUIRED/AUTO, đọc khóa qua tên entity `ApprovalSetting`), `BaseApprovalFields` (cột duyệt của chứng từ), `BaseApprovalEventEntity` (cột nhật ký), cổng trừu tượng `ApprovalEventRecorder`, contract `ApprovalActorInfo`/`ApprovalActorResolver`/`ApproverOption`/`ApprovalSettingsLike`, DTO và mapper tóm tắt. Manifest style `v2-core`.
- Module `src/v2/modules/approval-management` (`ApprovalManagementModule`, export `TypeOrmModule` và 4 service): `ApprovalEvent extends BaseApprovalEventEntity` (bảng `erp_approval_events`, index `IDX_erp_approval_events_doc`), `ApprovalSetting` (bảng `erp_approval_settings`), `ApprovalEventService extends ApprovalEventRecorder`, `ApprovalSettingsService`, `ApprovalActorService` (tra tên/email từ `users_management` + `employees_management`), `ApproverDirectoryService` (cần `RbacCoreModule`), `createApprovalConfigController`.
- Refactor 2026-11-22 (plan `approval-core-base-only`): không đổi DB hay route. Lõi chứng từ (`procurement-orders-core`, `procurement-requests-core`, `inventory-movements-core`) inject kiểu `ApprovalEventRecorder`; lớp con ở module truyền `ApprovalEventService` cụ thể.

## 2. Cách dùng trong module chứng từ

- Import `ApprovalManagementModule` (không tự đăng ký lại entity hay service duyệt).
- Controller cấu hình duyệt của từng họ: gọi `createApprovalConfigController({ path, docType, resource, tag })` và đăng ký trong `controllers` của module chứng từ (route `api/v2/approval-config/<họ>/{approvers,setting}`).
- Wiring được khóa bởi `src/v2/modules/approval-actor-wiring.spec.ts`.

## 3. Kiểm thử

`bun test plop-helpers/apiCoreLayout.test.mjs` (lõi không còn trong `LEGACY_CORE_ALLOWLIST`); `bunx jest src/v2/core/approval-core src/v2/modules/approval-management src/v2/modules/approval-actor-wiring.spec.ts --forceExit`; smoke `bun run test:smoke:procurement`.
