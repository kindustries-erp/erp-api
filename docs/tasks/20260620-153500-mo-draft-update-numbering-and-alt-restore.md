# Task: Production order draft update, numbering, and alternative-item restore

> **Created:** 2026-06-20
> **Lane:** erp-master
> **Repo:** `liouni-erp-api`
> **Status:** DONE

## Scope
- Add API update path for draft production orders.
- Change auto-generated production order number to `MO-YYYYMM####`.
- Persist and restore `materialOverrides` for draft reopen flow.

## Result
- Draft MO now supports `PATCH /api/v1/production/orders/:id` while keeping non-draft immutable.
- New MO reference numbering follows `MO-YYYYMM####` when reference is left blank.
- Reopen draft response rehydrates original/effective material mapping from `output_metadata.materialOverrides`.

## Evidence target
- Draft MO can be saved again after edit without changing status from `DRAFT`.
- Newly created MO without manual reference gets `MO-YYYYMM####` format.
- Reopen draft retains alternative material mapping in response payload.

## Verification
- PASS: `bun run build`
- PASS: `bun test src/production-core/production-core.service.spec.ts`
