# Task Template — ERP API

## Request Input (bạn chỉ cần điền phần này)
- Type: FEATURE | ENHANCE | FIX
- Mục tiêu:
- Bối cảnh/ngữ cảnh:

## Goal
Mục tiêu task.

## Scope
- In-scope:
- Out-of-scope:

## Relevant Files
- `src/...` - lý do liên quan

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
- Data nền cần có:
- Constraint/index/default cần có:
- Kết quả: `DB_READY` | `DB_GAP_FOUND`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging):

## Coordination Impact
- [ ] Directus staging schema affected
- [ ] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [ ] 1.0 Gate 0 DB Precheck done
- [ ] 2.0 Backend workflow/API gate done
- [ ] 3.0 UI handoff gate done
- [ ] 4.0 Validate
  - [ ] 4.1 `npm run build`
  - [ ] 4.2 Smoke test affected endpoints
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result:
- Build:
- Smoke:

## Lessons Learned
- Link: `docs/lessons-learned/<file>.md#<anchor>` or "No issue"

## Commit/Push Status
- API repo:
- Web repo (if affected):
- DB/directus staging: apply+verify+document (no code push required)
