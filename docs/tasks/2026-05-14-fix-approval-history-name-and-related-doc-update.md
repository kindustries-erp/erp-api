# Task: FIX - Approval logs show actor name and allow related-doc updates on locked vouchers

## Request Input (bạn chỉ cần điền phần này)
- Type: FIX
- Mục tiêu:
  - API trả tên người duyệt trong lịch sử duyệt thay vì chỉ UUID.
  - Cho phép cập nhật riêng `related_documents` cho phiếu tiền mặt/tiền gửi đã APPROVED/POSTED, vẫn khóa field lõi.
- Bối cảnh/ngữ cảnh:
  - Đồng bộ với ERP Web task `2026-05-14-fix-approval-history-name-and-lock-edit-rules.md`.

## Goal
- Giữ rule không edit phiếu đã duyệt/post cho core voucher fields.
- Thêm đường xử lý an toàn cho update chỉ chứa `related_documents` sau duyệt/post.
- Decorate approval logs với actor display name để UI không phải hiển thị id.

## Scope
- In-scope:
  - `payment-voucher-approval-logs` response contract.
  - `payment-vouchers.update()` validation cho partial update `related_documents`.
- Out-of-scope:
  - Không đổi schema.
  - Không mở edit các field lõi sau APPROVED/POSTED.

## Relevant Files
- `src/payment-voucher-approval-logs/payment-voucher-approval-logs.service.ts`
- `src/payment-vouchers/payment-vouchers.service.ts`
- `src/payment-vouchers/dto/update-payment-voucher.dto.ts`

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `payment_vouchers.status`, `payment_vouchers.related_documents` (qua relation table hiện có), `payment_vouchers.approved_by`
  - `payment_voucher_approval_logs.action_by`
  - `directus_users.id`, `directus_users.first_name`, `directus_users.last_name`, `directus_users.email`
- Data nền cần có:
  - Có voucher/log có `action_by` để decorate tên khi smoke.
- Constraint/index/default cần có:
  - Không cần schema change.
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: N/A

## Coordination Impact
- [ ] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
- [x] 3.0 UI handoff gate done
- [x] 4.0 Validate
  - [x] 4.1 `npm run build`
  - [ ] 4.2 Smoke test affected endpoints
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: DB_READY by code inspection + runtime verification pending execution evidence update.
- Build: API `npm run build` PASS; Web `npm run build` PASS (Vite chunk-size warnings only).
- Smoke: pending.

## Lessons Learned
- No issue yet.

## Commit/Push Status
- API repo: pending.
- Web repo (if affected): pending.
- DB/directus staging: no schema change planned.
