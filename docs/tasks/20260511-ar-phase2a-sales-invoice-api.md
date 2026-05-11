# Task — ERP API AR Phase 2A Sales Invoice Posting

## Request Input (bạn chỉ cần điền phần này)
- Type: ENHANCE
- Mục tiêu: Add API workflow for AR sales invoice draft creation and posting to journal entry.
- Bối cảnh/ngữ cảnh: Phase 2A follows DB-first migration in Directus staging. Keep existing AR Workbench/legacy ledger APIs backward-compatible.

## Goal
Expose safe endpoints for create draft sales invoice with lines and post invoice through DB guardrails that generate balanced journal entries.

## Scope
- In-scope:
  - DTOs for sales invoice header/lines.
  - `POST /api/v1/ar-workbench/sales-invoices`.
  - `POST /api/v1/ar-workbench/documents/:id/post`.
  - Default account lookup for 131/511/3331.
- Out-of-scope:
  - Receipt allocation/collection workflow beyond existing Phase 1 endpoints.
  - Credit note/refund/reversal production workflow.

## Relevant Files
- `src/ar-workbench/dto/create-ar-sales-invoice.dto.ts` - sales invoice request contract.
- `src/ar-workbench/ar-workbench.controller.ts` - new endpoints.
- `src/ar-workbench/ar-workbench.service.ts` - create/post workflow.
- `docs/tasks/20260511-ar-phase2a-sales-invoice-api.md` - task tracking.

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan: `ar_documents`, `ar_document_lines`, `journal_entries`, `journal_entry_lines`, `chart_of_accounts`, `business_partners`.
- Data nền cần có: accounts `131`, `511`, `3331` exist; at least one business partner exists for smoke.
- Constraint/index/default cần có: DB migration added line amount/tax recalculation, document total recalculation, partial unique journal index for `reference_type='ar_documents'`, and post trigger for sales invoices.
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: DB task `/opt/repos/liouni-erp/directus-staging/ops/tasks/20260511-ar-phase2a-sales-invoice-posting.md`

## Coordination Impact
- [x] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
  - [x] 2.1 DTO added for sales invoice create request
  - [x] 2.2 Endpoint added: `POST /api/v1/ar-workbench/sales-invoices`
  - [x] 2.3 Endpoint added: `POST /api/v1/ar-workbench/documents/:id/post`
  - [x] 2.4 Endpoint added: `POST /api/v1/ar-workbench/documents/:id/reverse`
- [ ] 3.0 UI handoff gate done
- [x] 4.0 Validate
  - [x] 4.1 `npm run build`
  - [ ] 4.2 Smoke test affected endpoints after deploy
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: `DB_READY` after Directus Phase 2A DB smoke.
- Build: `npm run build` passed.
- Typecheck/scoped lint: `./node_modules/.bin/eslint <changed files> --max-warnings=0 && npm run type:check` passed.
- Repo-wide `npm run lint:check` currently fails on pre-existing unrelated formatting/unused-var issues outside changed files; changed files pass scoped lint.
- Smoke: pending after deploy.

## Lessons Learned
- Link: No issue yet

## Commit/Push Status
- API repo: pending
- Web repo (if affected): pending in web task
- DB/directus staging: apply+verify+document in DB task
