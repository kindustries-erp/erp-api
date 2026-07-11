# Task: Fix Timezone and Voucher API (2026-06-23)

## Objective
Fix date and time presentation in various inventory views, ensure timestamps are correct across DB, API, and FE.

## Actions Taken
- Altered `created_at` and `updated_at` to `timestamptz` in `erp_goods_receipts` and `erp_goods_issues`.
- Wrote migration script to alter columns after migrating legacy broken timestamps via explicit runner script.
- Fixed `listWarehouseVouchers` in `inventory-core.service.ts` to sort accurately by `createdAt` DESC as a secondary sort key.
- Handled broken legacy migrations (`1782059484340`, `1782109001550`, `1782109911729`) by injecting `IF NOT EXISTS` constructs to prevent crash on `migration:run`.

## Next Steps
- Verify sorting performance over large datasets.
