# Current Lane Task Entry

## Active entry docs

- `docs/ai/technical-instructions.md`
- `docs/api-current-truth-index.md`
- `docs/README.md`

## High-value current-lane tasks

- `docs/tasks/20260614-213309-erp-core-elite-ci-lane.md`
- `docs/tasks/20260611-093800-inventory-uom-item-type-masters.md`
- `docs/tasks/20260609-0150-so-rollup-after-gi-post.md`
- `docs/tasks/20260608-235600-po-core-strict-and-wave2-flow-verify.md`
- `docs/tasks/20260608-233500-purchase-order-core-compatibility-fix.md`
- `docs/tasks/20260607-165837-erp-core-neon-business-modules-phase1.md`
- `docs/tasks/20260607-erp-core-api-neon-bootstrap.md`

## Recent closed artifacts (2026-06-21 → 2026-06-22)

- `docs/tasks/20260621-mo-dynamic-identifiers-and-bom-bugfixes.md` ← DONE (85e37d8)
- `docs/tasks/20260622-071200-cleanup-root-scripts.md` ← DONE (175c023)
- `docs/tasks/20260622-090500-db-schema-sync-and-root-hygiene-closure.md` ← DONE (e81804d, 175c023)
- `docs/tasks/update-production-api-notes-names.md` ← DONE (per source)
- `docs/tasks/20260620-erp-production-start-complete-auto-warehouse.md` ← DONE (a9e4707)

## Recent closed artifacts (2026-06-22 afternoon)

- `docs/tasks/20260622-r2-company-profile-sys-file-migration.md` ← DONE (`e06188e`)
- `docs/tasks/20260622-143500-production-sorting-debug-artifact-cleanup.md` ← DONE (`52711c9`; lineage includes `1806a1d`, `a702977`, `0e9aae8`)

## Current checkpoint gap (2026-06-22 evening)

- API lane closure artifacts are now reconciled with recent pushed commits through `52711c9`.
- Pending staging QC: full-flow MO → tracking-policy → complete + GR must be verified on staging after CI deploy.
- No open API code hygiene blocker visible from current worktree.

## Current lane lessons

- `rbac-core/rbac-core.service.ts` dùng static list hardcoded trong `getAvailableResources()`. Mỗi lần thêm module mới cần cập nhật đây ngay, nếu không role management UI sẽ không thấy resource để cấp quyền.
- Khi thêm ERP module mới có permission-gated controller, luôn verify cả 3 lớp cùng lúc: `@Controller(path)` trên controller, path trong FE api client, và entry trong `getAvailableResources()`.

## Historical signal
Những task cũ về cashflow / AR / voucher / sinvoice / tax-portal / Directus-first flow phải được xem là historical/reference trừ khi user mở lại scope đó.

