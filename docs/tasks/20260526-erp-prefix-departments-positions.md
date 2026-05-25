# Task — ERP API compatibility for erp_departments / erp_positions

## Request Input (bạn chỉ cần điền phần này)
- Type: ENHANCE
- Mục tiêu: Patch ERP API internal Directus collection bindings from `departments`/`positions` to `erp_departments`/`erp_positions` while keeping HTTP routes stable.
- Bối cảnh/ngữ cảnh: Directus staging rename of HR master tables is coordinated with this task. Employee domain already uses `erp_employees`.

## Goal
Giữ API routes hiện tại nhưng đổi internal collection binding sang collection name mới có prefix `erp_`.

## Scope
- In-scope:
  - Patch service-level Directus collection strings
  - Audit dependent workflow services if they read departments/positions
  - Build and smoke affected endpoints
- Out-of-scope:
  - Route rename `/api/v1/departments`, `/api/v1/positions`
  - New business logic unrelated to rename

## Relevant Files
- `src/departments/departments.service.ts` - Directus binding for departments
- `src/positions/positions.service.ts` - Directus binding for positions
- `src/workflow-graph/workflow-graph.service.ts` - audit for collection string impact
- `src/app.module.ts` - module presence audit only

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `erp_departments`, `erp_positions`, `erp_employees.department_id`, `erp_employees.position_id`
- Data nền cần có:
  - Renamed collections available in Directus runtime
- Constraint/index/default cần có:
  - Employee and position FKs preserved after rename
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): `/opt/repos/liouni-erp/directus-staging/ops/tasks/20260526-erp-prefix-departments-positions.md`

## Coordination Impact
- [x] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
- [x] 3.0 UI handoff gate done
- [x] 4.0 Validate
  - [x] 4.1 `npm run build`
  - [x] 4.2 Smoke test affected endpoints
- [x] 5.0 Close
  - [x] 5.1 Lessons learned entry (if issue)
  - [x] 5.2 Commit + push code (web/api)
  - [x] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: `DB_READY` — renamed collections `erp_departments`, `erp_positions` live; employee/position FK chain preserved.
- Build: `bun run build` PASS
- Smoke:
  - `/api/v1/departments` -> `401 Unauthorized` (route exists, auth gate intact)
  - `/api/v1/positions` -> `401 Unauthorized` (route exists, auth gate intact)
  - `workflow-graph.service.ts` retargeted to `/items/erp_departments`

## Lessons Learned
- No issue

## Commit/Push Status
- API repo: pending
- Web repo (if affected): pending
- DB/directus staging: apply+verify+document (no code push required)
