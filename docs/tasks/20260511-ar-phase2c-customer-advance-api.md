# Task — AR Phase 2C Customer Advance API

## Request Input (bạn chỉ cần điền phần này)
- Type: FEATURE
- Mục tiêu: Thêm API cho use case #3 Khách đặt cọc trước trong AR Workbench.
- Bối cảnh/ngữ cảnh: User xác nhận execute sau ERP PLAN mode. DB task: `/opt/repos/liouni-erp/directus-staging/ops/tasks/20260511-ar-phase2c-customer-advance.md`.

## Goal
Expose protected AR Workbench endpoints để tạo/post/reverse/list customer advance receipts, dùng `payment_vouchers` với `voucher_type=CUSTOMER_ADVANCE_RECEIPT` và DB guardrails Phase 2C.

## Scope
- In-scope:
  - DTO cho customer advance receipt.
  - Service/controller endpoints under `/api/v1/ar-workbench/customer-advances`.
  - Build + smoke endpoints.
- Out-of-scope:
  - Cấn trừ advance vào invoice (UC #4).
  - Suspense/refund/COD/gateway/FX.

## Relevant Files
- `src/ar-workbench/ar-workbench.service.ts` - AR Workbench business flow.
- `src/ar-workbench/ar-workbench.controller.ts` - protected routes.
- `src/ar-workbench/dto/create-customer-advance.dto.ts` - new request contract.

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `payment_vouchers` exists and now has `ar_advance_original_amount`, `ar_advance_applied_amount`, `ar_advance_remaining_amount`, `ar_advance_status`.
  - `journal_entries`, `journal_entry_lines` exist.
  - `chart_of_accounts` has 111/112/113/131.
- Data nền cần có:
  - At least one customer/business partner for smoke.
  - Accounting accounts for CASH/BANK/EWALLET/AR.
- Constraint/index/default cần có:
  - DB migration `/opt/backups/directus-staging/20260511134113/ar-phase2c-customer-advance.sql` applied.
  - Triggers `trg_payment_voucher_advance_biu`, `trg_payment_voucher_reversal_journal_au` exist.
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): N/A — DB Phase 2C applied before API edit.

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
- [ ] 5.0 Close
  - [x] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [x] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: `DB_READY`
- Build: `npm run build` PASS in `/opt/repos/liouni-erp-api`; Docker image rebuild PASS; container `liouni-erp-api` recreated and started.
- Route/auth smoke: unauthenticated `GET /api/v1/ar-workbench/customer-advances` returned `401`; authenticated returned `200` with paginated response.
- Smoke create/post/reverse:
  - Created voucher `ADV-20260511-MP0UPTAR` (`d6dd4944-dd65-4502-8a25-23ad76435d77`) via `POST /customer-advances` → `201`.
  - Posted via `POST /customer-advances/:id/post` → `201`; DB showed amount/original/remaining `123456.00`, applied `0.00`, status `UNAPPLIED`.
  - Journal entry `reference_type='payment_vouchers'` balanced debit=`123456.00`, credit=`123456.00`.
  - Reversed via `POST /customer-advances/:id/reverse` → `201`; reversal JE `reference_type='payment_vouchers_reversal'` balanced debit=`123456.00`, credit=`123456.00`.
  - Negative DB path in rollback transaction confirmed reverse is blocked when active `ar_applications` exists: `Cannot reverse payment voucher ... because it has active AR applications`.

## Lessons Learned
- Directus required validation still requires API-provided fallbacks before insert; service now auto-generates `voucher_no` and fills required snapshots/description before calling Directus.
- Actual Phase 2C advance status values are `UNAPPLIED`, `PARTIALLY_APPLIED`, `FULLY_APPLIED`, `REVERSED`; Web type and reusable skill reference were corrected.

## Commit/Push Status
- API repo: committed and pushed to `master` (`d40c206`)
- Web repo (if affected): committed and pushed to `master` (`0dd450f`)
- DB/directus staging: apply+verify+document done in Directus task
