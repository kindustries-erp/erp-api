# Task: Soften MO draft inventory-balance validation

> **Created:** 2026-06-20
> **Lane:** erp-master
> **Repo:** `liouni-erp-api`
> **Status:** DONE

## Scope
- Keep strict inventory validation for `CONFIRMED` production orders.
- Allow `DRAFT` production orders to be created even when a material has no inventory balance row yet.
- Preserve item existence validation and explicit erroring for bad item ids.

## Result
- `DRAFT` path no longer blocks solely because `erp_inventory_balances` row is missing.
- `CONFIRMED` path still blocks when balance row is absent or available quantity is insufficient.
- Related API error labels were also improved to show `sku — itemName` instead of raw UUID when item metadata is available.

## Evidence target
- DRAFT MO no longer fails solely because a material lacks `erp_inventory_balances`.
- CONFIRMED path remains guarded.

## Verification
- PASS: `bun test src/production-core/production-core.service.spec.ts`
- PASS: `bun run build`
