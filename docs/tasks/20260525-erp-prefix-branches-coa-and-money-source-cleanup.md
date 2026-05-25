# Task — ERP API: prefix branches/chart_of_accounts and money-source cleanup

## Request Input (bạn chỉ cần điền phần này)
- Type: ENHANCE
- Mục tiêu: đổi binding collection từ `branches`, `chart_of_accounts` sang `erp_branches`, `erp_chart_of_accounts`; bảo đảm API không phụ thuộc legacy bridge columns của `erp_money_sources`.
- Bối cảnh/ngữ cảnh: Directus staging schema rename + money-source bridge cleanup cùng lane ERP.

## Goal
Giữ nguyên public API contract nhưng cập nhật internal Directus collection bindings theo schema mới.

## Scope
- In-scope:
  - `src/branches/**`
  - `src/chart-of-accounts/**`
  - audit các service liên quan branches/chart-of-accounts/money-sources nếu có literal cũ
- Out-of-scope:
  - Không đổi public route path
  - Không refactor business workflow ngoài scope rename/cleanup

## Relevant Files
- `src/branches/branches.service.ts` - collection binding branch
- `src/chart-of-accounts/chart-of-accounts.service.ts` - collection binding chart of accounts
- `src/cashflow-vouchers/cashflow-vouchers.service.ts` - verify no dependency on removed legacy bridge columns
- `src/journal-entries/journal-entries.service.ts` - audit nếu có chart-of-accounts literal

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `erp_money_sources`, `branches`, `chart_of_accounts`
- Data nền cần có:
  - branch/chart-of-account rows tồn tại để smoke list
- Constraint/index/default cần có:
  - renamed collections phải được Directus runtime expose sau DB gate
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): `/opt/docs/ai/liouni-erp/tasks/20260525.1958 - remove-legacy-money-source-bridge-and-prefix-branches-coa.md`

## Coordination Impact
- [x] Directus staging schema affected
- [x] ERP Web contract affected
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
