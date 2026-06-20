# Task — Fix payment voucher approval log `action_by_name`

## Request Input (bạn chỉ cần điền phần này)
- Type: FIX
- Mục tiêu: Sửa API approval log của payment voucher để `action_by_name` trả tên/email usable thay vì UUID `action_by`.
- Bối cảnh/ngữ cảnh: Trên màn Tiền gửi / approval log, DevTools response cho thấy `action_by_name` đang trả ra id UUID. User yêu cầu fix triệt để tại API.

## Goal
Đảm bảo endpoint approval logs của payment voucher trả `action_by_name` là giá trị hiển thị được cho người dùng (ưu tiên display name / full name / email), không fallback thẳng về UUID trừ khi thật sự không còn thông tin nào khác.

## Scope
- In-scope:
  - Inspect Gate 0 DB/API contract cho `payment_voucher_approval_logs.action_by` và nguồn dữ liệu `directus_users`
  - Patch service `payment-voucher-approval-logs.service.ts`
  - Build + smoke endpoint affected
  - Commit + push + deploy ERP API
- Out-of-scope:
  - Đổi schema Directus/PostgreSQL
  - Đổi UI ERP Web
  - Refactor approval workflow ngoài phần decorate tên người thao tác

## Relevant Files
- `src/payment-voucher-approval-logs/payment-voucher-approval-logs.service.ts` - decorate `action_by_name` từ `directus_users`
- `docs/tasks/2026-05-24-fix-payment-voucher-approval-log-action-by-name.md` - task tracking + evidence

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `payment_voucher_approval_logs.action_by`
  - `directus_users.id`
  - `directus_users.display_name` (nếu có)
  - `directus_users.first_name`
  - `directus_users.last_name`
  - `directus_users.email`
- Data nền cần có:
  - Approval log rows có `action_by`
  - User record tương ứng tồn tại trong `directus_users`
- Constraint/index/default cần có:
  - `action_by` lưu id user hợp lệ để API decorate được
  - Không yêu cầu migration/schema change cho fix này
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): N/A

## Coordination Impact
- [ ] Directus staging schema affected
- [ ] ERP Web contract affected
- [x] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
- [x] 3.0 UI handoff gate done
- [ ] 4.0 Validate
  - [x] 4.1 `npm run build`
  - [ ] 4.2 Smoke test affected endpoints
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: Superseded by decommission decision on 2026-05-24. Live DB/runtime confirmed collection existed before removal, then was hard-removed from Directus staging.
- Build: superseded — final executed path moved to decommission task `2026-05-24-decommission-payment-voucher-approval-log-db-be.md`
- Smoke: superseded — final runtime state is route removed (`404`) and Directus runtime absent (`403 does not exist`) after decommission

## Lessons Learned
- Link: No issue
- Note: Task stopped being a decorate-name fix and was replaced by hard decommission scope after user changed direction.

## Commit/Push Status
- API repo: superseded by decommission commit
- Web repo (if affected): not affected
- DB/directus staging: superseded by decommission task evidence
