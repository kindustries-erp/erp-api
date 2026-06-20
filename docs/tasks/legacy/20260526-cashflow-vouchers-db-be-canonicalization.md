# Cashflow Vouchers DB/BE Canonicalization

## Request Input (bạn chỉ cần điền phần này)
- Type: ENHANCE
- Mục tiêu: triển khai backend theo contract money_source_id canonical và lookup sub-API dưới cashflow-vouchers.
- Bối cảnh/ngữ cảnh: DB/API làm trước; UI làm sau. User chốt xóa luôn `legacy_payment_voucher_id`.

## Goal
Đổi contract backend `cashflow_vouchers` sang `money_source_id` canonical, thêm lookup sub-endpoints dùng `DIRECTUS_ADMIN_TOKEN`, bỏ field legacy khỏi DTO/service/query, convert delete thành soft delete draft-only, và giữ `journal_entry_id` như liên kết DB thật tới `journal_entries`.

## Scope
- In-scope:
  - DTO/controller/service/module `cashflow-vouchers`
  - lookup `GET /cashflow-vouchers/party`
  - lookup `GET /cashflow-vouchers/parties/:id`
  - lookup `GET /cashflow-vouchers/money-sources`
  - soft delete `is_active=false` draft-only
- Out-of-scope:
  - UI implementation
  - decommission `payment_vouchers`

## Relevant Files
- `src/cashflow-vouchers/**` - module chính cần canonicalize
- `src/app.module.ts` - verify module wiring nếu cần

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `cashflow_vouchers`: live còn legacy columns `company_id`, `cash_fund_id`, `bank_account_id`, `deleted_at`, `deleted_by`, `legacy_payment_voucher_id`
  - `cash_funds`: live chưa có `channel`
- Data nền cần có:
  - `cash_funds.id`, `branch_id`, `accounting_account_id`, `channel`
- Constraint/index/default cần có:
  - `money_source_id` FK -> `cash_funds.id`
  - `is_active DEFAULT true NOT NULL`
- Kết quả: `DB_READY`
- Evidence live DB:
  - `cashflow_vouchers.money_source_id` đã tồn tại, `NOT NULL`, FK -> `cash_funds.id`
  - `cashflow_vouchers.is_active` đã `DEFAULT true NOT NULL`
  - `cashflow_vouchers.journal_entry_id` đã FK thật -> `journal_entries.id`
  - `cash_funds.channel` đã tồn tại (`CASH`/`BANK`)
  - `company_bank_accounts` được giữ riêng; phase này unify ở lookup/API compatibility layer, không đổi FK voucher trực tiếp sang bảng này

## Coordination Impact
- [x] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
  - [x] 2.1 Route `/money-source` đổi thành `/money-sources` (plural)
  - [x] 2.2 Thêm endpoint `GET /cashflow-vouchers/parties/:id`
  - [x] 2.3 Fix field map `business_partners`: `partner_code/partner_name/tax_id` -> `code/display_name/tax_code`
  - [x] 2.4 Xóa `counterparty_tax_code_snapshot` khỏi LOCKED set, DTO, service snapshot
  - [x] 2.5 Build PASS (`bun run build`)
- [ ] 3.0 UI handoff gate done
- [ ] 4.0 Validate
  - [ ] 4.1 Deploy API (`docker compose build --no-cache && up -d`)
  - [ ] 4.2 Smoke test affected endpoints
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: `DB_GAP_FOUND`
- Build:
- Smoke:

## Lessons Learned
- Link: "No issue"

## Commit/Push Status
- API repo:
- Web repo (if affected): pending UI lane
- DB/directus staging: apply+verify+document (no code push required)
