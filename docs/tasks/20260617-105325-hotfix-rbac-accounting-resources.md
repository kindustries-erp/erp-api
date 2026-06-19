# Task: Hotfix RBAC resources for accounting pages

- Scope: expose `journal_entries` và `accounting_configs` trong `rbac-core/collections` để `erp-permissions-core` có thể cấp quyền cho 2 page kế toán mới
- Order: DB -> API -> UI -> QC
- Gate 0 DB: N/A

## Status: DONE — verified via deploy/run on 2026-06-17

## Problem
- Controller kế toán đã check quyền:
  - `journal_entries`
  - `accounting_configs`
- Nhưng `rbac-core/rbac-core.service.ts#getAvailableResources()` là static list hardcoded và thiếu 2 resource trên
- Kết quả: `erp-permissions-core` UI không render row tương ứng, nên không có cách cấp quyền dù backend đã enforce permission

## Fix
Thêm vào `getAvailableResources()`:
- `journal_entries`
- `accounting_configs`

## Evidence
- Build: `bun run build` PASS
- Tests: Jest PASS (`5 suites`, `18 tests`)
- Commit: `2d4e2f9` — `feat(rbac): add journal_entries and accounting_configs to available resources`

## Lesson learned
- Với lane ERP core hiện tại, module permission mới không đủ chỉ có `@RequirePermissions(...)`; còn phải sync resource list trong `rbac-core.service.ts`
- Khi user báo 403 cho page mới, phải kiểm tra song song:
  1. FE path
  2. BE controller path
  3. RBAC resource list
  4. role assignment thực tế
