# Task Template — ERP API

## Request Input (bạn chỉ cần điền phần này)
- Type: FIX
- Mục tiêu: Gỡ toàn bộ flow Đặt cọc/Customer Advance và mọi contract/backend dependency với `CUSTOMER_ADVANCE_RECEIPT`, `customer-advances`, `advance-applications`, `ar_advance_*` khỏi ERP API.
- Bối cảnh/ngữ cảnh: User đổi scope từ drop 4 field sang hard-remove toàn bộ flow Đặt cọc từ DB -> API -> UI -> QC.

## Goal
Đảm bảo ERP API không còn reference/expectation nào tới 4 field `ar_advance_*` sau khi DB cleanup, build pass và deploy staging ổn định.

## Scope
- In-scope:
  - Rà soát source `liouni-erp-api` để xác nhận/gỡ reference nếu có
  - Build/test/smoke các endpoint `payment-vouchers`
  - Deploy stack API staging
- Out-of-scope:
  - Redesign nghiệp vụ customer advance
  - Thay đổi endpoint không liên quan payment vouchers

## Relevant Files
- `src/payment-vouchers/**` - module payment voucher cần verify contract
- `docs/tasks/20260524-065232-remove-payment-voucher-ar-advance-fields.md` - evidence task

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan: `payment_vouchers.ar_advance_*`
- Data nền cần có: DB/runtime đã cleanup xong 4 field
- Constraint/index/default cần có: API không còn đọc/ghi 4 field này
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): `../../directus-staging/ops/tasks/20260524-065232-drop-payment-voucher-ar-advance-fields.md`

## Coordination Impact
- [x] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [ ] 2.0 Backend workflow/API gate done
- [ ] 3.0 UI handoff gate done
- [ ] 4.0 Validate
  - [ ] 4.1 `npm run build`
  - [ ] 4.2 Smoke test affected endpoints
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result:
  - Backup: `/opt/backups/directus-staging/20260524071223-remove-customer-advance/directus-staging-before-change.sql`
  - `payment_vouchers` không còn cột `ar_advance_*`
  - Directus metadata/permission không còn field/permission advance
- Build:
  - `npm run build` PASS tại `/opt/repos/liouni-erp/liouni-erp-api`
- Smoke:
  - `curl https://dev.api.erp.liouni.com/api/v1` => `200`, body `Hello World!`
  - `GET /api/v1/ar-workbench/customer-advances` => `404`
  - `GET /api/v1/ar-workbench/advance-applications` => `404`

## Lessons Learned
- Scope hard-remove flow đặt cọc cần verify endpoint 404 thực tế, không chỉ grep source.

## Commit/Push Status
- API repo: pending commit/push in this task close-out
- Web repo (if affected): tracked in sibling web task
- DB/directus staging: apply+verify+document complete; no schema mutation needed beyond cleanup verification
