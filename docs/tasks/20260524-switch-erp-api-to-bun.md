# Task — Chuẩn hóa ERP API sang Bun

## Request Input (bạn chỉ cần điền phần này)
- Type: ENHANCE
- Mục tiêu: Thay hoàn toàn npm/pnpm bằng Bun cho repo ERP API.
- Bối cảnh/ngữ cảnh: Đã chuẩn hóa ERP Web sang Bun; cần làm tương tự cho API, giữ nguyên workflow Gitea nếu không gọi package manager trực tiếp.

## Goal
Chuẩn hóa tooling/build/package manager của `liouni-erp-api` sang Bun, giữ deploy staging ổn định, verify build/test/docker/runtime health theo flow ERP.

## Scope
- In-scope:
  - lockfile/package manager cleanup
  - `package.json` scripts liên quan npm/npx
  - `.husky/pre-commit`
  - `Dockerfile`
  - `README.md`
  - QC build/test/docker/runtime
- Out-of-scope:
  - DB schema/data
  - business logic API
  - ERP Web UI
  - đổi tên workflow Gitea

## Relevant Files
- `package.json` - scripts và package manager flow
- `.husky/pre-commit` - commit hook runtime
- `Dockerfile` - build/runtime image
- `README.md` - docs run/build/deploy
- `.gitea/workflows/deploy-staging.yml` - verify có cần đổi runtime hay không
- `docs/tasks/20260524-switch-erp-api-to-bun.md` - task evidence

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan: N/A (tooling-only migration)
- Data nền cần có: N/A
- Constraint/index/default cần có: N/A
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): N/A

## Coordination Impact
- [ ] Directus staging schema affected
- [ ] ERP Web contract affected
- [x] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [ ] 2.0 Backend workflow/API gate done
- [ ] 3.0 UI handoff gate done — N/A (API tooling-only)
- [ ] 4.0 Validate
  - [ ] 4.1 `bun run build`
  - [ ] 4.2 `bunx jest --forceExit`
  - [ ] 4.3 Docker build PASS
  - [ ] 4.4 Staging health protected route trả `401`
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: `DB_READY` vì task chỉ đổi tooling/package manager.
- Build: pending
- Smoke: pending

## Lessons Learned
- Link: No issue

## Commit/Push Status
- API repo:
- Web repo (if affected): N/A
- DB/directus staging: N/A
