# Task: OUT invoice branch tax-code override and detail display normalization

> **Created:** 2026-08-07  
> **Lane:** api  
> **Repo:** `erp-api`  
> **Status:** IN PROGRESS

## Scope

- Override OUT invoice branch classification by customer tax code for Đào Trí.
- Preserve existing settlementOrder fallback for remaining OUT invoices.
- Normalize detailed export rows for Đào Trí discount/rescue display rules.

## Verification

- Unit tests for branch resolver and detail display helper.
- Focused `bun test` / `bun run build` for touched API slice once implementation is in place.