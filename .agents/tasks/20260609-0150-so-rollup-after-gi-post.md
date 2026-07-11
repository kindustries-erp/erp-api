# Task: Fix Sales Order header status rollup after Goods Issue post

## Context
ERP core electric motorbike simulation on 2026-06-09 exposed a business-state bug:
- Goods Issue post updates `sales_order_lines.qtyDelivered`
- line state becomes correct
- but Sales Order header status remains `RESERVED` instead of rolling up to `DELIVERED`

## Scope
- Repo: `liouni-erp-api`
- Module(s): `sales-orders-core`, `goods-issues-core`
- Goal: after GI post, SO header should roll up correctly based on line delivery state

## Acceptance
- Existing SO from simulation (`SO-XMD-0609014108`) becomes `DELIVERED` after re-verify path, or equivalent fix verified with real API output
- `bun run build` passes
- No unrelated scope expansion

## Evidence needed
- code diff
- build output
- GET `/sales-orders/:id` before/after or equivalent live API proof
