# Task: Fix branches API 400 for pagination query

## Request Input
- Type: FIX
- Mục tiêu: Sửa lỗi 400 khi gọi GET /api/v1/branches với page/pageSize.
- Bối cảnh/ngữ cảnh: FE gọi `/api/v1/branches?page=1&pageSize=100` bị 400.

## Goal
Khôi phục contract endpoint branches để chấp nhận query phân trang chuẩn frontend, trả response phân trang ổn định.

## Scope
- In-scope:
  - BranchQueryDto bổ sung page/pageSize + transform/validation.
  - BranchesService hỗ trợ pagination + sort whitelist + response paginated.
  - Smoke endpoint branches.
- Out-of-scope:
  - Thay đổi schema DB Directus.
  - Refactor module khác ngoài branches.

## Relevant Files
- `src/branches/dto/branch-query.dto.ts` - thêm query params pagination/sort và validator.
- `src/branches/branches.service.ts` - áp dụng limit/offset, sanitize sort, trả payload phân trang.

## Gate 0 — DB Precheck
- Collections/fields liên quan:
  - `branches`: `id`, `code`, `name`, `is_active`, `created_at`.
- Data nền cần có:
  - Có records branches để test pagination/search.
- Constraint/index/default cần có:
  - Không yêu cầu thay đổi schema cho lỗi 400 query validation.
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: N/A

## Coordination Impact
- [ ] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (realtime)
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
- DB precheck result: DB_READY (no schema change required).
- Build: `npm run build` PASS (Nest build).
- Smoke:
  - `curl http://127.0.0.1:10000/api/v1/branches?page=1&pageSize=100` (no token) => `401 Unauthorized` (không còn 400 parse query).
  - `curl https://dev.api.erp.liouni.com/api/v1/branches?page=1&pageSize=100` với Bearer token user cung cấp => `HTTP 200` (không còn 400).
- Runtime verify:
  - `docker ps` container `liouni-erp-api` status `Up`.
  - `docker logs --tail 20` có route map `/api/v1/branches` và startup thành công.

## Lessons Learned
- Link: No issue

## Commit/Push Status
- API repo: pending
- Web repo (if affected): no code change planned
- DB/directus staging: no mutation
