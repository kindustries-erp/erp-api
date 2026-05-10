# Task — Partner Ledger open_amount required cache fix

## Request Input
- Type: FIX
- Mục tiêu: Sửa lỗi tạo Phải thu/Phải trả qua `/api/v1/partner-ledger-items` vẫn báo `Validation failed for field "open_amount". Value is required.` dù client không nhập `open_amount`.
- Bối cảnh/ngữ cảnh: User cung cấp curl tạo `PAYABLE` không có `open_amount`; API trả 400. Cần đảm bảo cả `RECEIVABLE` và `PAYABLE` tạo được, `open_amount` do DB/Directus layer tự tính/giữ invariant.

## Goal
Tạo khoản công nợ phải thu/phải trả không yêu cầu client gửi `open_amount`, `settled_amount`, `status`; hệ thống tự set `settled_amount=0`, `status=OPEN`, `open_amount=original_amount - settled_amount`.

## Scope
- In-scope:
  - Gate 0 DB/Directus precheck cho `partner_ledger_items.open_amount`, `settled_amount`, `status`.
  - Fix Directus runtime/schema validation nếu metadata DB đã đúng nhưng cache/runtime còn bắt required.
  - Smoke tạo `PAYABLE` và `RECEIVABLE` không có `open_amount` qua ERP API, cleanup test data sau verify.
  - Document evidence/handoff.
- Out-of-scope:
  - Thay đổi nghiệp vụ settlement hoặc UI layout.
  - Xóa/reset dữ liệu thật.

## Relevant Files
- `src/partner-ledger-items/partner-ledger-items.service.ts` - endpoint create forward payload sang Directus.
- `src/partner-ledger-items/dto/create-partner-ledger-item.dto.ts` - DTO không khai báo `open_amount`, lỗi đến từ Directus validation.
- `/opt/docs/deployment/liouni-erp.md` - deployment/ops evidence nếu có thay đổi runtime Directus/API.

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `partner_ledger_items.open_amount`: Directus API field metadata hiện báo `required=false`, `readonly=true`; DB column `NOT NULL`, chưa có client input.
  - `partner_ledger_items.settled_amount`: DB default `0`; field readonly nhưng metadata runtime đang `required=true` nên cần tránh validation tương tự.
  - `partner_ledger_items.status`: DB default `OPEN`; field readonly nhưng metadata runtime đang `required=true` nên cần tránh validation tương tự.
  - `partner_ledger_items.original_amount`: bắt buộc input, dùng để compute `open_amount`.
- Data nền cần có:
  - Có business partner/account hợp lệ để smoke tạo AR/AP.
- Constraint/index/default cần có:
  - DB-side trigger/default cho `open_amount = original_amount - settled_amount`.
  - Directus field metadata/cache phải không bắt required với computed/readonly fields.
- Kết quả: `DB_GAP_FOUND`
- Nếu `DB_GAP_FOUND`: Fix trực tiếp Directus field metadata/runtime cache cho readonly computed/default fields rồi verify qua API.

## Coordination Impact
- [x] Directus staging schema affected
- [ ] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 DB/Directus fix applied
- [x] 3.0 Backend workflow/API gate done
- [x] 4.0 UI handoff gate done
- [x] 5.0 Validate
  - [x] 5.1 `npm run build` if repo code changes
  - [x] 5.2 Smoke test affected endpoints
- [x] 6.0 Close
  - [x] 6.1 Lessons learned entry updated
  - [x] 6.2 Commit + push code/docs task if repo changed
  - [x] 6.3 Summary with evidence

## Validation Evidence
- DB precheck result:
  - Directus `/fields/partner_ledger_items`: `open_amount.required=false`, but POST still returned `FAILED_VALIDATION` for `open_amount`; root cause was DB `NOT NULL` field without default being validated before PostgreSQL BEFORE INSERT trigger.
  - ERP API smoke before fix: POST without `open_amount` returned HTTP 400 `Validation failed for field "open_amount". Value is required.`
- DB/Directus fix applied:
  - SQL applied: `/opt/backups/directus-staging/20260510233726/partner-ledger-open-amount-default-trigger-fix.sql`
  - `partner_ledger_items.open_amount` now has DB default `0` and trigger `liouni_partner_ledger_items_amounts_biu()` always recomputes `open_amount = original_amount - settled_amount`.
  - `open_amount`, `settled_amount`, `status` Directus metadata: `required=false`, readonly retained.
  - Restarted `directus-staging`; health returned `{ "status": "ok" }`.
- Build:
  - No API/Web code changed; build not required. Runtime API route unchanged.
- Smoke:
  - Directus direct POST without `open_amount`: HTTP 200, returned `open_amount=123456.00`, `settled_amount=0.00`, `status=OPEN`; test row deleted.
  - ERP API POST `PAYABLE` without `open_amount`: HTTP 201, returned `open_amount=123456.00`, `settled_amount=0.00`, `status=OPEN`; test row deleted.
  - ERP API POST `RECEIVABLE` without `open_amount` using account `131`: HTTP 201, returned `open_amount=123456.00`, `settled_amount=0.00`, `status=OPEN`; test row deleted.
  - Public checks: API root HTTP 200, unauthenticated partner ledger route HTTP 401, Directus health OK.

## Lessons Learned
- Link: `docs/lessons-learned/LL-2026-05-002-directus-computed-field-required-default.md`

## Commit/Push Status
- API repo: docs task + lesson committed/pushed in close-out commit
- Web repo (if affected): not affected
- DB/directus staging: apply+verify+document complete; no code push required
