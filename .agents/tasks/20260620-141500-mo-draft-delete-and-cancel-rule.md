# Task: Enforce draft-delete and posted-cancel rule for production orders

> **Created:** 2026-06-20
> **Lane:** erp-master
> **Repo:** `liouni-erp-api`
> **Status:** DONE

## Scope
- Add delete endpoint for draft production orders.
- Prevent `cancel` action from being used on `DRAFT` production orders.
- Keep cancel flow for non-draft production orders.

## Result
- Added `DELETE /api/v1/production/orders/:id` for soft-delete of draft MO.
- API now rejects `cancel` on `DRAFT` and instructs client to use delete.
- Non-draft MO can still use cancel flow.

## Evidence target
- Draft MO can be deleted via dedicated endpoint.
- Draft MO cannot be canceled via old cancel endpoint.
- Build and focused service test pass.

## Verification
- PASS: `bun run build`
- PASS: `bun test src/production-core/production-core.service.spec.ts`
