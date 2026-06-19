# Current Lane Task Entry

## Active entry docs
- `docs/ai/technical-instructions.md`
- `docs/api-current-truth-index.md`
- `docs/README.md`

## High-value current-lane tasks
- `docs/tasks/20260617-105325-hotfix-rbac-accounting-resources.md`
- `docs/tasks/20260616-172700-erp-invoices-and-po-invoice-field-api.md`
- `docs/tasks/20260614-213309-erp-core-elite-ci-lane.md`
- `docs/tasks/20260611-093800-inventory-uom-item-type-masters.md`
- `docs/tasks/20260609-0150-so-rollup-after-gi-post.md`
- `docs/tasks/20260608-235600-po-core-strict-and-wave2-flow-verify.md`
- `docs/tasks/20260608-233500-purchase-order-core-compatibility-fix.md`
- `docs/tasks/20260607-165837-erp-core-neon-business-modules-phase1.md`
- `docs/tasks/20260607-erp-core-api-neon-bootstrap.md`

## Current lane lessons

- `rbac-core/rbac-core.service.ts` dùng static list hardcoded trong `getAvailableResources()`. Mỗi lần thêm module mới cần cập nhật đây ngay, nếu không role management UI sẽ không thấy resource để cấp quyền.
- Khi thêm ERP module mới có permission-gated controller, luôn verify cả 3 lớp cùng lúc: `@Controller(path)` trên controller, path trong FE api client, và entry trong `getAvailableResources()`.

## Historical signal
Những task cũ về cashflow / AR / voucher / sinvoice / tax-portal / Directus-first flow phải được xem là historical/reference trừ khi user mở lại scope đó.
