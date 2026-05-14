# Task Template

## Request Input (bạn chỉ cần điền phần này)
- Type: ENHANCE
- Mục tiêu: Trong phiếu tiền mặt/tiền gửi, chỉ cho xóa khi DRAFT; sau khi duyệt thì không được xóa nữa, chỉ được hủy. Khi người có quyền bấm duyệt, phiếu tự động POSTED, không cần bước hạch toán riêng.
- Bối cảnh/ngữ cảnh: Execution theo plan web task `/opt/repos/liouni-erp/liouni-erp-web/docs/tasks/2026-05-14-plan-cash-bank-voucher-delete-approval-auto-posted.md`.

## Goal
Chuẩn hóa workflow API cho `payment_vouchers`:
- DELETE chỉ cho `DRAFT`.
- APPROVE chuyển `PENDING_APPROVAL -> POSTED`, set approved/posted timestamps và tạo journal entry idempotent.
- CANCEL cho phép hủy chứng từ đã POSTED theo luồng cancel thay vì xóa.

## Scope
- In-scope:
  - `src/payment-vouchers/payment-vouchers.service.ts`
  - `src/payment-vouchers/payment-vouchers.controller.ts`
- Out-of-scope:
  - Schema migration/seed data.
  - Xóa dữ liệu test/runtime.

## Relevant Files
- `src/payment-vouchers/payment-vouchers.service.ts` - state machine + approve/delete/cancel behavior.
- `src/payment-vouchers/payment-vouchers.controller.ts` - API operation summaries.

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `payment_vouchers`: status + audit fields checked.
  - `journal_entries`: reference fields checked.
  - `cash_bank_related_documents`: exists.
- Data nền cần có: Directus staging running.
- Constraint/index/default cần có: `idx_journal_entries_payment_voucher_ref_unique` exists for idempotent journal posting.
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: N/A

## Checklist (bắt buộc cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
- [ ] 3.0 UI gate done
- [ ] 4.0 Validation
  - [x] 4.1 Chạy `npm run build`
  - [x] 4.2 Smoke test flow liên quan
- [x] 5.0 Close
  - [x] 5.1 Lessons learned entry (if issue)
  - [x] 5.2 Commit + push code (web/api)
  - [x] 5.3 Tổng kết evidence

## Validation Evidence
- DB precheck result: `payment_vouchers|6`, `journal_ref|2`, `cash_bank_related_documents|1`, `idx_journal_entries_payment_voucher_ref_unique` exists.
- `npm run build`: pass.
- Deploy: docker compose build `--no-cache` + up -d pass.
- Runtime smoke: `api_docs:200`, `api_v1_payment_vouchers_unauth:401`; container `liouni-erp-api` Up; startup logs mapped `/api/v1/payment-vouchers/:id/approve`, `/post`, `/cancel`.

## Lessons Learned
- Không có issue mới.

## Commit/Push Status
- API repo: committed/pushed `8ba1847 Enhance cash bank voucher approval workflow`.
- Web repo: committed/pushed `74fd889 Enhance cash bank voucher approval workflow`.
- DB/directus staging: no DB change needed.
