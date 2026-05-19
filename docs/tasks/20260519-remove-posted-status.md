# Task: Remove POSTED Status from Payment Vouchers

- Type: ENHANCE
- Mục tiêu: Xóa trạng thái POSTED khỏi luồng phiếu thu chi. Dùng `journal_entry_id != null` làm cờ đánh dấu đã hạch toán thay vì trạng thái riêng. Cho phép ghi đè bút toán (xóa cũ, tạo mới).
- Bối cảnh: POSTED gây dư thừa — khi đã có `journal_entry_id` là biết phiếu đã hạch toán rồi. Ngoài ra UI bị khóa cứng khi POSTED khiến kế toán không thể sửa bút toán.

## Goal
- Sau khi hạch toán, phiếu vẫn ở trạng thái `APPROVED`.
- `journal_entry_id` là source of truth để biết phiếu đã hạch toán hay chưa.
- Cho phép gọi lại `postToJournal` nếu đã có bút toán cũ → xóa bút toán cũ + tạo mới.
- Khi hủy phiếu đã hạch toán, xóa bút toán liên quan.

## Scope
- In-scope: `payment-vouchers.service.ts`, `payment-vouchers.controller.ts` (nếu cần)
- Out-of-scope: Migration data (anh sẽ tạo phiếu mới để test)

## Relevant Files
- `src/payment-vouchers/payment-vouchers.service.ts` - logic chính

## Gate 0 — DB Precheck
- Collections: `payment_vouchers`, `journal_entries`, `journal_entry_lines`
- Không cần migrate data

## Checklist
- [x] Xóa `POSTED` khỏi `STATUS_TRANSITIONS`
- [x] Cập nhật `postToJournal`: bỏ check block khi đã có `journal_entry_id`, thay bằng xóa bút toán cũ trước khi tạo mới
- [x] Cập nhật `postToJournal`: bỏ dòng set `status: 'POSTED'`
- [x] Cập nhật `cancel`: xóa bút toán liên quan nếu có `journal_entry_id`
- [x] Build & verify
