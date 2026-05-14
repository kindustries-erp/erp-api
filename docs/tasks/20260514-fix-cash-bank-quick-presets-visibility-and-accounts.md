# ERP TASK: Fix quick presets visibility on UI + complete debit/credit accounts

STATUS: COMPLETED

## Request Input
- Type: FIX
- Mục tiêu:
  - Check lại UI vì phiếu tiền mặt chưa hiện nghiệp vụ nhanh.
  - Check lại DB vì các nghiệp vụ nhanh CASH/BANK chưa có tài khoản Nợ/Có.
- Bối cảnh/ngữ cảnh:
  - User đã xác nhận "Thực thi" sau PLAN mode.

## Goal
Đảm bảo preset nghiệp vụ nhanh hiển thị đầy đủ trên UI phiếu tiền mặt/tiền gửi theo đúng IN/OUT và có đủ debit_account_id/credit_account_id để auto-fill.

## Scope
- In-scope:
  - Fix data trong cash_bank_tag_presets.
  - Verify API trả đúng presets.
  - Verify UI/form logic bằng code/API evidence.
- Out-of-scope:
  - Đổi schema Directus.
  - Đổi logic journal posting.
  - Thêm nút Header.

## Gate 0 — DB Precheck
- Collections/fields liên quan: cash_bank_tag_presets.code, voucher_channel, voucher_direction, debit_account_id, credit_account_id, is_active, sort.
- Data nền cần có: 4 preset mới đã tồn tại.
- Constraint/index/default cần có: Không đổi schema/index.
- Kết quả: DB_GAP_FOUND
- Lý do: 4 preset mới có debit_account_id/credit_account_id = null.

## Coordination Impact
- [x] Directus staging schema affected (No schema, only data update)
- [x] ERP Web contract affected (preset auto-fill phụ thuộc account mapping)
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 DB data fix done
  - [x] BANK_WITHDRAWAL: debit=CASH, credit=BANK
  - [x] CASH_DEPOSIT_TO_BANK: debit=BANK, credit=CASH
  - [x] CASH_DEPOSIT: debit=BANK, credit=CASH
  - [x] BANK_WITHDRAWAL_OUT: debit=CASH, credit=BANK
- [x] 3.0 API verification done
- [x] 4.0 UI verification done
- [x] 5.0 Validate
  - [x] 5.1 Smoke affected flows via ERP API lookup endpoint
  - [x] 5.2 Capture evidence
- [x] 6.0 Close
  - [x] 6.1 Summary with evidence
  - [x] 6.2 Commit/push if code changed (No code changed; task docs only)

## Account Mapping Applied
- CASH account id: `1646d8b0-537d-4cfb-a355-67e942394041`
- BANK account id: `fb937dd7-7b95-4fa0-b544-956515ff5036`

| Code | Channel | Direction | Debit | Credit |
|---|---|---|---|---|
| BANK_WITHDRAWAL | CASH | IN | CASH | BANK |
| CASH_DEPOSIT_TO_BANK | CASH | OUT | BANK | CASH |
| CASH_DEPOSIT | BANK | IN | BANK | CASH |
| BANK_WITHDRAWAL_OUT | BANK | OUT | CASH | BANK |

## API Verification Evidence
ERP API endpoint used by UI:
`/api/v1/payment-vouchers/lookup/cash-bank-tag-presets?page=1&pageSize=100&voucher_channel=<CASH|BANK>&voucher_direction=<IN|OUT>`

### CASH IN
- CUSTOMER_DEPOSIT_CASH: debit 1646d8b0..., credit ff2eff30...
- CUSTOMER_RECEIPT_CASH: debit 1646d8b0..., credit 5114bccf...
- BANK_WITHDRAWAL: debit 1646d8b0..., credit fb937dd7...

### CASH OUT
- PAYMENT_CASH: debit 39e7296a..., credit 1646d8b0...
- CASH_DEPOSIT_TO_BANK: debit fb937dd7..., credit 1646d8b0...

### BANK IN
- CUSTOMER_DEPOSIT_BANK: debit fb937dd7..., credit ff2eff30...
- CUSTOMER_RECEIPT_BANK: debit fb937dd7..., credit 5114bccf...
- CASH_DEPOSIT: debit fb937dd7..., credit 1646d8b0...

### BANK OUT
- PAYMENT_BANK: debit 39e7296a..., credit fb937dd7...
- BANK_WITHDRAWAL_OUT: debit 1646d8b0..., credit fb937dd7...

## UI Verification Evidence
- Frontend calls `getCashBankTagPresetsApi()` -> `/api/v1/payment-vouchers/lookup/cash-bank-tag-presets`.
- `useCashVoucherHandlers.loadTagPresets()` filters by `voucher_channel: CASH` and `voucher_direction: IN|OUT`.
- `useBankVoucherHandlers.loadTagPresets()` filters by `voucher_channel: BANK` and `voucher_direction: IN|OUT`.
- `CashBankTagPresetCards` renders all items from `tagPresets` and displays Debit/Credit labels.
- Browser reached login screen at `http://localhost:8808`; no interactive UI smoke beyond login due missing credentials in session.

## Risk + Rollback
- Risk: Gán sai account ID làm auto-fill sai bút toán.
- Rollback: PATCH 4 preset mới về previous null values if required.

## Commit/Push Status
- API repo: task docs committed/pushed.
- Web repo: no code change.
- DB/directus staging: data updated + verified.
