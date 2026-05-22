# Task — Partners role filter and operational forms API support

## Request Input (bạn chỉ cần điền phần này)
- Type: ENHANCE
- Mục tiêu: Bổ sung filter đối tác theo role để phục vụ màn Khách hàng/Nhà cung cấp; giữ tương thích contract operational create/update cho web forms.
- Bối cảnh/ngữ cảnh: ERP web đang cần tách page Khách hàng/Nhà cung cấp từ master đối tác và làm modal create/update cho bán hàng, mua hàng, chi phí.

## Goal
Cho phép API business-partners filter theo role CUSTOMER/VENDOR để web phân trang đúng ở server-side, đồng thời xác nhận contract create/update operational dùng được cho sales/purchase/expense forms.

## Scope
- In-scope:
  - thêm query filter role cho `GET /business-partners`
  - cập nhật DTO query nếu cần
  - giữ nguyên schema Directus
  - validate build backend
- Out-of-scope:
  - đổi schema Directus
  - thay đổi business logic posting/accounting
  - thay đổi UI

## Relevant Files
- `src/business-partners/business-partners.service.ts` - thêm server-side filter role
- `src/business-partners/business-partners.controller.ts` - dùng query DTO mới nếu cần
- `src/business-partners/dto/*.ts` - khai báo query contract nếu cần

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `business_partners.is_active`
  - `business_partner_roles.partner_id`
  - `business_partner_roles.role`
  - `business_partner_roles.is_active`
- Data nền cần có:
  - partner có role CUSTOMER/VENDOR đã tồn tại trong `business_partner_roles`
- Constraint/index/default cần có:
  - relation `business_partner_roles.partner_id -> business_partners.id`
  - role enum/allowed values đang được app sử dụng: CUSTOMER, VENDOR
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): N/A

## Coordination Impact
- [ ] Directus staging schema affected
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
- DB precheck result: `DB_READY` by code/schema contract inspection; no schema mutation required.
- Build: Pending
- Smoke: Pending

## Lessons Learned
- Link: No issue

## Commit/Push Status
- API repo: Pending
- Web repo (if affected): Pending
- DB/directus staging: apply+verify+document (no code push required)
