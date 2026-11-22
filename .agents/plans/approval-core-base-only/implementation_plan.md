# approval-core base-only (erp-api)

Track: T2 · Structure: /erp-api-structure (Phần B) · Consistency Check: đạt
Plane: KINDU-1720..1735 (module `approval-core-base-only`, cycle "Phase: approval-core base-only (2027-03-01)")

Mục tiêu: đưa `src/v2/core/approval-core` về base-only; entity, service, controller factory sang module mới `approval-management`. Không đổi DB, route, response.

Thiết kế chốt: core giữ engine, gate helper, `BaseApprovalFields`, `BaseApprovalEventEntity`, cổng `ApprovalEventRecorder`, contract; module có `ApprovalEvent`, `ApprovalSetting`, 4 service, factory controller, `ApprovalManagementModule` (export). 3 họ core (procurement-orders, procurement-requests, inventory-movements) inject `ApprovalEventRecorder`. 7 module chứng từ import `ApprovalManagementModule`. Gỡ `approval-core` khỏi `LEGACY_CORE_ALLOWLIST`.

Lệch nhỏ so với plan: DTO `approval-action.dto` giữ ở core (DTO thuần, không vi phạm layout); chỉ factory controller chuyển sang module. Không thêm vào `app.module` vì các module chứng từ đã import.

## Kết quả (2026-11-22)
- [x] 1.1.1 mốc schema (DB erp_greenway_staging, đọc-only), sau sửa không lệch
- [x] 2.1.1 – 2.4.1 code
- [x] 3.1.1 layout test 4/4, jest scope 62 suite / 320 test PASS, tsc sạch, scanner không báo file approval
- [x] 3.1.2 API start:dev không lỗi metadata/DI, smoke procurement 47/47 PASS, route approval-config đủ
- [x] 3.2.1 skill approval-management mới + cập nhật skill liên quan, sync-agents và validate PASS
- [ ] Commit/push: chờ lệnh của anh

## ⏸️ Session Checkpoint
- Active Task: None
- Git Status: chưa commit
- Hành động tiếp theo: commit/push theo /erp-git-workflow khi có lệnh
