# table-preferences-core và admin-dashboard-core base-only (erp-api)

Track: T2 · Structure: /erp-api-structure (Phần B) · Consistency Check: đạt
Plane: KINDU-1736..1750 (module `table-preferences-admin-core-base-only`, cycle "Phase: table-preferences + admin-dashboard core base-only (2027-03-08)")

Mục tiêu: gỡ `table-preferences-core` và `admin-dashboard-core` khỏi `LEGACY_CORE_ALLOWLIST` (còn `business-partners-core`, `rbac-core`). Không đổi DB, route, response.

Thiết kế chốt:
- table-preferences: lõi giữ `BaseTablePreferenceEntity`, types, helper LIKE; module `table-preferences` nhận entity cụ thể, `query`/`command` service, `TablePreferencesService` gọi trực tiếp (bỏ facade và Nest module lõi).
- admin-dashboard: xóa lõi; module mới `admin-dashboard` (controller, service, DTO, spec, `AdminDashboardModule` import `DashboardCoreModule` v1). Nợ ghi nhận: phụ thuộc v1.

## Kết quả (2026-11-22)
- [x] 1.1.1 mốc schema `table_preferences` (DB erp_greenway_staging, đọc-only); sau sửa không lệch
- [x] 2.1.1 – 2.5.1 code
- [x] 3.1.1 `bun test plop-helpers` 134/134 (layout 4/4), jest scope 12 suite / 51 test, tsc sạch, scanner không báo file mới, eslint/prettier sạch
- [x] 3.1.2 API start:dev không lỗi; route `/api/v2/table-preferences` (GET, PATCH) và `/api/v2/admin/dashboard/summary` được map; gọi trực tiếp bằng tài khoản `ai-test-*` đều 200; dòng test đã xóa
- [x] 3.2.1 skill app-config, erp-users, admin-dashboard-core, v2-module; sync-agents và validate PASS
- [ ] Commit/push: chờ lệnh của anh

## ⏸️ Session Checkpoint
- Active Task: None
- Git Status: chưa commit
- Hành động tiếp theo: commit/push theo /erp-git-workflow khi có lệnh
