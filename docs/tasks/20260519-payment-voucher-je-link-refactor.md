# Payment voucher -> journal entry linkage refactor

- [x] Gate: xác nhận DB payment_vouchers đã bỏ debit_account_id/credit_account_id
- [ ] API: bỏ hẳn account khỏi payment voucher contract
- [ ] API: nối luồng hạch toán thủ công qua journal entry + attach payment_voucher_id/journal_entry_id
- [ ] API: build/typecheck pass
- [ ] FE: refactor shared accounting modal cho Cash/Tiền gửi
- [ ] FE: giữ nút Ghi sổ + modal cấu hình hạch toán
- [ ] FE: bank voucher không còn account field trong voucher form/payload
- [ ] FE: build pass
- [ ] QC: DB -> API -> UI
- [ ] Docs/update evidence
