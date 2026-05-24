# Task — Audit Log Phase 1 cho Payment Vouchers

## Request Input (bạn chỉ cần điền phần này)
- Type: FEATURE
- Mục tiêu: Triển khai phase 1 audit log theo backbone mới, ưu tiên payment_vouchers.
- Bối cảnh/ngữ cảnh: Theo plan `/opt/docs/ai/liouni-erp/tasks/2026-05-24-plan-full-api-audit-logging.md`, cần chạy đúng flow DB -> API -> UI -> QC.

## Goal
Tạo audit backbone tối thiểu cho `payment_vouchers`, bắt tất cả mutation/business action trọng yếu đi qua audit layer và expose timeline API sanitized cho UI.

## Scope
- In-scope:
  - Thêm DB backbone `audit_logs`
  - Thêm API service/controller/module cho audit log timeline + search tối thiểu
  - Hook audit vào `payment_vouchers.service.ts`
  - Timeline endpoint cho `payment_vouchers/:id/timeline`
- Out-of-scope:
  - `audit_access_logs`
  - Màn admin audit viewer full-scope
  - Rollout audit cho mọi module ERP khác ngoài payment_vouchers trong phase này

## Relevant Files
- `src/payment-vouchers/payment-vouchers.service.ts` - mutation/business actions nguồn
- `src/payment-vouchers/payment-vouchers.controller.ts` - thêm timeline route hoặc wire controller
- `src/audit-logs/*` - module/service/controller/dto mới
- `src/app.module.ts` - register module

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - Existing: `payment_vouchers`
  - New: `audit_logs`
- Data nền cần có:
  - user identity từ Directus token/runtime
  - voucher records hợp lệ để smoke create/update/approve/cancel
- Constraint/index/default cần có:
  - `payment_vouchers` live OK
  - `audit_logs` chưa tồn tại, cần tạo mới với indexes `(entity_type, entity_id, created_at desc)`, `(module, created_at desc)`, `(actor_id, created_at desc)`, `(action, created_at desc)`, `(event_group, created_at desc)`
- Kết quả: `DB_GAP_FOUND`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): `/opt/docs/ai/liouni-erp/tasks/2026-05-24-plan-full-api-audit-logging.md`

## Coordination Impact
- [x] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
- [x] 3.0 UI handoff gate done
- [ ] 4.0 Validate
  - [ ] 4.1 `npm run build`
  - [ ] 4.2 Smoke test affected endpoints
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: live DB có `payment_vouchers`, chưa có `audit_logs`/`audit_access_logs`; backup `/opt/backups/directus-staging/20260524184156`
- Build: `npm run build` PASS; Docker rebuild API PASS; container `liouni-erp-api` recreated từ image `liouni-erp-api-liouni-erp-api`
- Smoke:
  - login API PASS qua `POST /api/v1/auth/login`
  - list vouchers PASS qua `GET /api/v1/payment-vouchers`
  - timeline endpoint PASS qua `GET /api/v1/payment-vouchers/:id/timeline`
  - sample voucher runtime: `PT-QC-QCSEED-9CB78BAB` status `APPROVED`
  - timeline response shape PASS
  - mutation smoke PASS: PATCH description voucher `PT-QC-QCSEED-9CB78BAB`
  - audit write PASS: timeline_count = `1`, last_action = `UPDATE`, actor = `Hermes`

## Lessons Learned
- Link: `No issue`

## Commit/Push Status
- API repo: pending
- Web repo (if affected): pending
- DB/directus staging: apply+verify+document (no code push required)
