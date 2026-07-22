# Refactor Payment Vouchers API

- [x] Update DTOs (remove dropped fields, add notes, journal_entry_id)
- [x] Refactor `payment-vouchers.service.ts` to remove auto JE creation logic
- [x] Remove POSTED status handling
- [x] Refactor AR document DTO/service to drop `accounting_account_id`, add/use `journal_entry_id`
- [x] Build and verify
  - `npm run build` PASS after restoring missing payment voucher snapshot DTO fields still used by service
