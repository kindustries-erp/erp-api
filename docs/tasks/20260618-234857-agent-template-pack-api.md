# Task: API template + conventions pack for team-scalable delivery

## Request Input (bạn chỉ cần điền phần này)
- Type: ENHANCE
- Mục tiêu: Tạo bộ template/convention dùng được ngay cho API repo để agent/dev thêm module, đổi contract, refactor và review đồng nhất hơn.
- Bối cảnh/ngữ cảnh: Sau khi harden agent contract, repo cần thêm implementation templates + naming + DoD + ADR-lite ở mức gọn.

## Goal
Bổ sung bộ tài liệu mẫu ngắn, thực dụng, link được từ technical instructions để tăng tính teamwork / modular / scale / maintainability.

## Scope
- In-scope:
  - API module template
  - API contract-change template
  - API naming conventions
  - Shared ADR-lite / DoD matrix / anti-pattern cookbook trong repo API
  - Link lại từ technical instructions
- Out-of-scope:
  - Đổi source runtime
  - Tạo generator code tự động
  - Refactor module business hiện có

## Relevant Files
- `docs/ai/technical-instructions.md` - canonical instructions
- `docs/ai/templates/*` - template pack mới
- `docs/ai/conventions/*` - conventions/DoD/anti-patterns mới

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan: N/A (docs/process task)
- Data nền cần có: N/A
- Constraint/index/default cần có: N/A
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): N/A

## Coordination Impact
- [ ] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
- [x] 3.0 UI handoff gate done
- [x] 4.0 Validate
  - [x] 4.1 `bun run lint:check`
  - [x] 4.2 `bun run build`
  - [x] 4.3 Test scope liên quan (`bunx jest --forceExit` hoặc scope hẹp hơn, ghi rõ evidence)
  - [x] 4.4 Smoke test affected endpoints (nếu đổi contract/runtime flow)
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: `DB_READY`
- `bun run lint:check`: PASS
- Build: `bun run build` PASS
- Test: `bunx jest --forceExit` PASS (`5 suites`, `18 tests`)
- Smoke: N/A (docs/process-only)

## Lessons Learned
- Link: No issue

## Commit/Push Status
- API repo: pending
- Web repo (if affected): coordinated separately
- DB/directus staging: N/A
