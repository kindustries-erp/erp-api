# 2026-05-17 Hotfix deploy verify API 502

## Scope
- Triage lỗi API 502 trên BE SInvoice/Viettel endpoints
- Hotfix code
- Build, commit, push
- Deploy stack `/opt/stacks/liouni-erp-api`
- Verify endpoints sau deploy

## DB precheck (Gate 0)
- Collections: `sinvoice_configs`, `tax_portal_configs`, `einvoices`
- Required fields: `sinvoice_configs.is_active`, credentials (`username`,`password`,`api_url`), `einvoices.external_invoice_id`
- Data nền: có ít nhất 1 `sinvoice_configs` active
- Constraint/index: không thay đổi schema/index trong task này
- Result: `DB_READY` (không cần migration)

## Checklist
- [x] Kiểm tra trạng thái runtime/container + logs lỗi
- [x] Xác định root cause của 502
- [x] Áp dụng hotfix trong service/controller liên quan
- [x] Build pass (`npm run build`)
- [x] Deploy lại container API
- [x] Verify endpoint health + endpoint nghi ngờ 502
- [x] Commit + push

## Notes nhanh
- 502 tái hiện khi endpoint gọi Viettel v2 ném exception do API trả 400/NOT_FOUND_DATA cho trang rỗng; upstream NPM trả 502.
- Hotfix: xử lý fallback empty result với case `NOT_FOUND_DATA`; bổ sung retry nhẹ network call; chuẩn hóa sync draft/issued và local listing.
