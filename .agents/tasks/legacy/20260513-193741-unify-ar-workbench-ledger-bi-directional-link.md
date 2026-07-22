# Task — Unify AR Workbench with Ledger and Enhance Cash/Bank Bi-directional Linking

## Request Input
- Type: FEATURE | ENHANCE
- Mục tiêu:
  1) Gộp AR Workbench và "Sổ công nợ hiện tại" vào 1 flow duy nhất.
  2) Form tạo hóa đơn (AR document) hỗ trợ link với cash/bank voucher và tự tính remaining amount.
  3) Form Cash/Bank khi chọn "đối tượng" chỉ show các chứng từ liên quan của đối tượng đó.
  4) Chế độ auto-link: từ Cash/Bank link sang trang công nợ đối tượng và ngược lại.

## Goal
Hợp nhất trải nghiệm quản lý phải thu, đảm bảo dữ liệu công nợ và thanh toán luôn được liên kết chặt chẽ và dễ dàng truy xuất từ cả hai phía.

## Scope
- In-scope:
  - UI: Hợp nhất tab/page AR Workbench và Partner Ledger.
  - UI: Nâng cấp form tạo AR Document (Invoice) để có field chọn payment vouchers.
  - UI: Nâng cấp RelatedDocumentsEditor trong Cash/Bank để filter theo đối tượng đã chọn.
  - Logic: Tự động tính toán số dư còn lại (remaining amount) sau khi trừ thanh toán trên form UI.
  - Navigation: Thêm các deep-link bi-directional giữa Cash/Bank và Ledger.
- Out-of-scope:
  - Sửa đổi cấu trúc hạch toán kế toán sâu trong core engine (chỉ thay đổi workflow/UI layer).

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `ar_documents`: `settled_amount`, `open_amount`, `total_amount`.
  - `cash_bank_related_documents`: `related_id`, `related_type`.
  - `payment_vouchers`: `counterparty_id`, `amount`.
- Data nền cần có: Các bản ghi AR và Payment hiện hữu.
- Constraint: `cash_bank_related_documents.related_id` là UUID.
- Kết quả: `DB_READY`

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend: API filter ar_documents theo counterparty_id đã có sẵn, không đổi API
- [x] 3.0 UI: Hợp nhất màn hình ArWorkbenchPanel và PartnerLedgerPage
- [x] 3.1 UI: Cash/Bank selector liên quan được filter theo đối tượng; invoice/ledger hiển thị remaining/open amount
- [x] 3.2 UI: Cập nhật RelatedDocumentsEditor filter docs theo counterparty_id trong Cash/Bank
- [x] 3.3 UI: Hợp nhất flow giúp Ledger <-> Cash/Bank link chung qua chứng từ liên quan
- [ ] 4.0 Validate
  - [x] 4.1 `npm run build`
  - [ ] 4.2 Smoke test gộp trang và tính toán số dư
- [ ] 5.0 Close

## Risk + Rollback
- Risk: UI gộp quá nhiều thông tin gây rối. Mitigation: Sử dụng tabs/panels rõ ràng trong Workbench.
- Rollback: Revert các commit UI/API và quay lại các route tách biệt cũ.

## Sẵn sàng thực thi
Kế hoạch đã sẵn sàng. Chờ user xác nhận để chuyển sang ACT mode.
