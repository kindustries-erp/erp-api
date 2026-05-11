# Task — ERP API AR Workbench

## Request Input (bạn chỉ cần điền phần này)
- Type: ENHANCE
- Mục tiêu: Implement API foundation for Accounts Receivable production workbench while preserving existing partner ledger/payment/journal flows.
- Bối cảnh/ngữ cảnh: User approved execution of AR use case coverage plan. Must follow DB -> API -> UI; API only after DB gate evidence. New flow must not break existing `/phai-thu`, `/phai-tra`, cash/bank voucher and journal data.

## Goal
Expose AR workbench endpoints for unified AR documents, allocations/applications, collection activities, summary and use-case coverage evidence.

## Scope
- In-scope:
  - New Nest module for AR workbench.
  - Read/list/create/update soft-state APIs for AR documents/applications/collection activities.
  - Summary and coverage endpoints.
  - Backward compatible: do not change existing partner-ledger/payment-voucher/journal endpoint contracts.
- Out-of-scope:
  - No removal/rename of existing endpoints.
  - No destructive data migration.

## Relevant Files
- `src/ar-workbench/*` - new API module.
- `src/app.module.ts` - register module.
- `docs/tasks/20260511-ar-workbench-api.md` - task tracking.

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan: `ar_documents`, `ar_document_lines`, `ar_applications`, `ar_collection_activities`, existing `business_partners`, `chart_of_accounts`, `payment_vouchers`, `journal_entries`, `partner_ledger_items`, `partner_ledger_settlements`.
- Data nền cần có: chart of accounts/customer/cash-bank/payment voucher data remains existing; no seed data required.
- Constraint/index/default cần có: DB migration must create idempotent source refs, amount checks, status/type checks, non-destructive references, Directus metadata and cloned permissions.
- Kết quả: `DB_GAP_FOUND` until Directus migration applied and verified.
- Nếu `DB_GAP_FOUND`: link DB task: `/opt/repos/liouni-erp/directus-staging/ops/tasks/20260511-ar-use-case-coverage-plan.md`

## Coordination Impact
- [x] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
  - [x] 2.1 Implement module/controller/service/DTOs
  - [x] 2.2 Preserve existing endpoint contracts: added `/api/v1/ar-workbench/*`; no changes to partner-ledger/payment-voucher/journal routes
- [x] 3.0 UI handoff gate done
- [x] 4.0 Validate
  - [x] 4.1 `npm run build`: passed (`nest build`)
  - [x] 4.2 Smoke test affected endpoints
- [x] 5.0 Close
  - [x] 5.1 Lessons learned entry (if issue)
  - [x] 5.2 Commit + push code (web/api)
  - [x] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: `DB_READY` after Directus phase 1 migration created additive `ar_*` collections and transaction+rollback smoke passed.
- Build:
  - Repo build: `npm run build` passed before commit.
  - Runtime image build: `/opt/stacks/liouni-erp-api docker compose build` passed after commit `da06319`.
- Deploy:
  - `/opt/stacks/liouni-erp-api docker compose up -d` recreated and started container `liouni-erp-api`.
- Smoke:
  - API startup logs mapped `/api/v1/ar-workbench/coverage`, `/summary`, `/documents`, `/applications`, `/collection-activities` routes.
  - Public unauthenticated `GET https://dev.api.erp.liouni.com/api/v1/ar-workbench/coverage` returned HTTP 401 `Không tìm thấy access token`, confirming route exists and auth guard is active (not 404).

## Lessons Learned
- Link: DB lesson only: `/opt/repos/liouni-erp/directus-staging/ops/lessons-learned/20260511-directus-permission-json-distinct.md`

## Commit/Push Status
- API repo: committed and pushed `da06319` (`Add AR workbench API foundation`)
- Web repo (if affected): tracked in web task
- DB/directus staging: apply+verify+document in DB task
