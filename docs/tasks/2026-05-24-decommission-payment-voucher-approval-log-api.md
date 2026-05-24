# Task — Decommission payment voucher approval log API

## Request Input (bạn chỉ cần điền phần này)
- Type: FIX
- Mục tiêu: Gỡ toàn bộ approval log payment voucher khỏi ERP API theo scope DB + BE only.
- Bối cảnh/ngữ cảnh: User đổi hướng từ fix `action_by_name` sang hard-decommission approval log cũ để làm lại sau.

## Goal
Remove route/module/call-sites `payment-voucher-approval-logs` khỏi ERP API, deploy runtime mới, verify endpoint cũ trả `404`.

## Scope
- In-scope:
  - remove `src/payment-voucher-approval-logs/*`
  - remove `PaymentVoucherApprovalLogsModule` from `app.module.ts`
  - remove create/delete side-effects in `payment-vouchers.service.ts`
  - build + deploy ERP API + negative smoke
- Out-of-scope:
  - ERP Web changes
  - New approval log design

## Relevant Files
- `src/app.module.ts`
- `src/payment-vouchers/payment-vouchers.service.ts`
- `src/payment-voucher-approval-logs/*`
- `docs/tasks/2026-05-24-fix-payment-voucher-approval-log-action-by-name.md`

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan: `payment_voucher_approval_logs`
- Data nền cần có: collection đang tồn tại trước khi BE remove route
- Constraint/index/default cần có: DB decommission task đã backup + remove runtime collection
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): `ops/tasks/2026-05-24-decommission-payment-voucher-approval-log-db-be.md`

## Coordination Impact
- [x] Directus staging schema affected
- [ ] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
- [x] 3.0 UI handoff gate done
- [x] 4.0 Validate
  - [x] 4.1 `npm run build`
  - [x] 4.2 Smoke test affected endpoints
- [x] 5.0 Close
  - [x] 5.1 Lessons learned entry (if issue)
  - [x] 5.2 Commit + push code (web/api)
  - [x] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: DB task removed table + metadata; Directus runtime after restart returns `403 ... does not exist`.
- Build: `npm run build` PASS
- Smoke:
  - container `liouni-erp-api` Up after deploy
  - startup logs clean
  - `GET /api/v1/payment-voucher-approval-logs?pageSize=1` => `404`

## Lessons Learned
- Link: No issue
- Note: hard-remove API only after DB/runtime decommission to avoid stale runtime querying dropped collection during rollout.

## Commit/Push Status
- API repo: `47f48c4` (`decommission payment voucher approval log`) pushed to `origin/staging`
- Web repo (if affected): not affected
- DB/directus staging: see DB task evidence
