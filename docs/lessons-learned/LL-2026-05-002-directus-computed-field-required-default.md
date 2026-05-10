# Lessons Learned — Directus Required Validation for Computed Ledger Fields

- ID: LL-2026-05-002
- Date: 2026-05-10
- Task Link: docs/tasks/task-03-partner-ledger-open-amount-required-cache-fix.md
- Owner: Hermes Agent

## Context
ERP FIX for creating `partner_ledger_items` through Directus/ERP API without client-supplied `open_amount`.

## Issue / Symptom
`POST /api/v1/partner-ledger-items` for both `PAYABLE` and `RECEIVABLE` returned:

```text
Validation failed for field "open_amount". Value is required.
```

This still happened after Directus field metadata showed `open_amount.required=false` and a DB BEFORE trigger existed to compute `open_amount`.

## Root Cause
Directus validates required fields before PostgreSQL BEFORE INSERT triggers run. A `NOT NULL` field with no DB default can still be treated as required by Directus schema validation even when `directus_fields.required=false`. The first fix changed metadata and trigger behavior, but `partner_ledger_items.open_amount` still had no DB default, so Directus rejected inserts before the trigger could compute the value. Directus also needed a restart after DB schema/default changes to reload its schema validation cache.

## Fix Applied
- Patched Directus metadata so readonly/default fields are not required: `open_amount`, `settled_amount`, `status`.
- Added DB default `partner_ledger_items.open_amount DEFAULT 0` to satisfy Directus pre-insert validation.
- Updated trigger `liouni_partner_ledger_items_amounts_biu()` to always recompute `open_amount = original_amount - settled_amount`, so the temporary/default value cannot break the accounting invariant.
- Restarted `directus-staging` to reload schema validation cache.
- Verified direct Directus insert and ERP API inserts for both `PAYABLE` and `RECEIVABLE` without `open_amount`.

## Preventive Action
For computed readonly Directus fields that are DB `NOT NULL`, use all three layers together:
1. `directus_fields.required=false` for readonly/default/computed fields.
2. A DB default that satisfies Directus pre-insert validation.
3. A DB trigger or generated expression that recomputes the real invariant value.

After changing DB defaults or field metadata behind Directus, restart Directus or otherwise force schema cache reload before public API smoke tests.
