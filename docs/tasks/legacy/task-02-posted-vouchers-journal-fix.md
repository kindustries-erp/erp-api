# Task — ERP API FIX: Posted vouchers journal integration

## Request Input (bạn chỉ cần điền phần này)
- Type: FIX
- Mục tiêu:
  1. Sửa lỗi tạo phải thu/phải trả báo `Validation failed for field "open_amount". Value is required.`
  2. Journal Entry không có trạng thái Draft; chỉ phát sinh/post journal entry khi voucher được post.
  3. Backend và DB đảm bảo mọi voucher posted có tài khoản hạch toán đều được ghi vào journal entry.
- Bối cảnh/ngữ cảnh:
  - Ưu tiên xác định root cause ở DB trước API/UI.
  - Bắt buộc Gate 0 DB precheck trước code.
  - Nếu DB_GAP_FOUND thì làm DB trước, sau đó API/UI.

## Goal
Đảm bảo các nghiệp vụ AR/AP và voucher posting tạo dữ liệu công nợ/journal đúng schema Directus staging, không lỗi required field, và journal entry phản ánh các chứng từ đã post.

## Scope
- In-scope:
  - Gate 0 DB precheck cho `partner_ledger_items`, `journal_entries`, `journal_entry_lines`, voucher collections, account fields và status/default/required fields.
  - Root cause lỗi `open_amount` khi tạo AR/AP.
  - API workflow để voucher posted có account phát sinh journal entry posted.
  - Điều chỉnh journal entry status nếu DB/API đang cho Draft không đúng nghiệp vụ.
  - UI handoff nếu contract/status changed.
- Out-of-scope:
  - Thiết kế kế toán đầy đủ cho mọi loại chứng từ chưa có tài khoản hạch toán trong DB.
  - Xoá dữ liệu runtime hiện có.

## Relevant Files
- `src/partner-ledger-items/**` - tạo/sửa khoản phải thu/phải trả.
- `src/payment-vouchers/**` - voucher workflow/status posting.
- `src/journal-entries/**` - journal entry list/post/reverse workflow.
- `src/app.module.ts` - module wiring nếu cần service integration.
- Directus staging collections - schema/source of truth.

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `partner_ledger_items.open_amount`: Directus `required=true`, `readonly=true`; PostgreSQL `NOT NULL`, không có default.
  - `partner_ledger_items.settled_amount/status`: readonly nhưng DB có default (`0`, `OPEN`).
  - `journal_entries.status`: Directus `required=true`; PostgreSQL default đang là `'draft'`; data hiện có `draft=1`, `posted=1`, `reversed=1`.
  - `payment_vouchers`: có `debit_account_id`, `credit_account_id`, `amount`, `status`, `posted_at`; API post hiện chỉ đổi status sang `POSTED`, chưa tạo journal entry.
  - `journal_entry_lines.account_id`: FK/account required, debit/credit default `0`.
- Data nền cần có:
  - `chart_of_accounts` có account UUID để voucher/ledger line hạch toán.
  - `accounting_periods` có kỳ `open` theo posting date để auto-link period nếu có.
- Constraint/index/default cần có:
  - `partner_ledger_items.open_amount` cần DB-side default/trigger theo `original_amount - settled_amount` và Directus không được bắt required input cho readonly field.
  - `journal_entries.status` không được mặc định/cho phép `draft`; status chỉ nên là `posted` hoặc `reversed` cho journal hiện tại.
  - Cần idempotency cho journal entry theo `reference_type/reference_id` để post voucher không tạo trùng.
- Kết quả: `DB_GAP_FOUND`
- Nếu `DB_GAP_FOUND`: DB apply evidence sẽ ghi trong phần Validation Evidence và docs deployment.

## Coordination Impact
- [x] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 DB gate done if DB_GAP_FOUND
- [x] 3.0 Backend workflow/API gate done
- [x] 4.0 UI handoff gate done
- [x] 5.0 Validate
  - [x] 5.1 `npm run build`
  - [x] 5.2 Smoke test affected endpoints
- [x] 6.0 Close
  - [x] 6.1 Lessons learned entry (if issue)
  - [x] 6.2 Commit + push code (web/api)
  - [x] 6.3 DB apply+verify+document handoff
  - [x] 6.4 Summary with evidence

## Validation Evidence
- DB precheck result: `DB_GAP_FOUND`.
- DB apply:
  - Backup: `/opt/backups/directus-staging/20260510225928/directus-staging-before-journal-voucher-fix.sql`
  - SQL applied: `/opt/backups/directus-staging/20260510225928/erp-journal-voucher-fix.sql`
  - SQL applied: `/opt/backups/directus-staging/20260510225928/erp-payment-voucher-journal-trigger.sql`
  - SQL applied: `/opt/backups/directus-staging/20260510225928/erp-payment-voucher-journal-trigger-fix.sql`
- DB verify:
  - `partner_ledger_items.open_amount` Directus `required=false`; DB trigger computes `open_amount = original_amount - settled_amount`.
  - `journal_entries.status` default is `posted`; check constraint allows only `posted`, `reversed`; existing `draft` row migrated to `posted`.
  - Unique indexes exist for `payment_vouchers` and `partner_ledger_items` references.
  - `trg_payment_voucher_posted_journal_aiu` exists/enabled on `payment_vouchers`.
  - Smoke transaction: insert AR/AP ledger without `open_amount` returned `open_amount=12345.00`, `settled_amount=0.00`, `status=OPEN`.
  - Smoke transaction: insert `payment_vouchers.status=POSTED` created one `journal_entries.status=posted` and two balanced `journal_entry_lines`.
  - Smoke transaction: inserting `journal_entries.status=draft` rejected by check constraint.
- Build:
  - API `npm run build`: PASS.
  - Web `npm run build`: PASS.
- Smoke: DB smoke PASS; API/Web runtime smoke PASS after Compose redeploy.

## Lessons Learned
- Link: `docs/lessons-learned/LL-2026-05-001-voucher-journal-trigger-fields.md`

## Commit/Push Status
- API repo: pushed `7911859 fix: post vouchers to journal entries`; close evidence follow-up pending in current edit.
- Web repo: pushed `7d14676 fix: remove journal entry draft workflow`.
- DB/directus staging: applied+verified live; documented in `/opt/docs/deployment/liouni-erp.md`.
