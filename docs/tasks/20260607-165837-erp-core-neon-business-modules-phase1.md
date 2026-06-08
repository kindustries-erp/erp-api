# ERP Core Neon Business Modules Phase 1

## Context
- Repo: `/opt/repos/liouni-erp/liouni-erp-api`
- Branch: `erp-core`
- Lane: ERP core Postgres/Neon-native rewrite
- Scope phase 1: scaffold foundation + business modules for:
  - [x] user (existing local auth/core_users baseline kept)
  - [ ] employee
  - [ ] business partner
  - [ ] inventory
  - [ ] BOM
  - [ ] purchase request
  - [ ] purchase order
  - [ ] goods receipt
  - [ ] goods issue
  - [ ] sales order

## Goal
Create clean NestJS + TypeORM module scaffolds and DB entities/migrations for the approved ERP-core business scope, using Neon/Postgres-native persistence and soft-FK only for cross-module references in this phase.

## Phase 2 extension
After scaffold pass, continue with the optimal first executable business lane:
- inventory core
- purchase order
- goods receipt
- receipt posting -> inventory transactions / balances
- receipt posting -> PO line `qty_received` update

## Gate 0
- Source lane reality: current repo still contains many Directus legacy modules.
- Target lane rule for this task: additive Postgres-native modules only.
- DB status: `DB_GAP_FOUND` for new business tables until migrations/entities are created.

## Rules for this task
- [ ] Do not use `@directus/sdk` in new modules.
- [ ] Do not inject `DIRECTUS_CLIENT` in new modules.
- [ ] Do not use DB-level FK for cross-module references in this phase.
- [ ] Keep references as `uuid` columns with naming ready for later FK.
- [ ] Wire modules into `AppModule` only after scaffold compiles.
- [ ] Verify with `bun run build`.

## Deliverables
- [ ] New module folders with controller/service/module/entity/dto
- [ ] New migration(s) for approved tables
- [ ] `AppModule` imports wired for new modules
- [ ] Build passes

## Planned tables
- `core_users` (existing baseline)
- `erp_employees`
- `erp_business_partners`
- `erp_inventory_items`
- `erp_inventory_transactions`
- `erp_inventory_balances`
- `erp_boms`
- `erp_bom_lines`
- `erp_purchase_requests`
- `erp_purchase_request_lines`
- `erp_purchase_orders`
- `erp_purchase_order_lines`
- `erp_goods_receipts`
- `erp_goods_receipt_lines`
- `erp_goods_issues`
- `erp_goods_issue_lines`
- `erp_sales_orders`
- `erp_sales_order_lines`

## Soft-FK policy in this phase
Examples only, not DB-enforced yet:
- `user_id`
- `employee_id`
- `supplier_id`
- `customer_id`
- `item_id`
- `finished_good_item_id`
- `component_item_id`
- `purchase_order_id`
- `sales_order_id`
- `document_id`
- `created_by`
- `updated_by`

## Checklist
- [x] Create task file
- [x] Inspect existing TypeORM/auth baseline
- [x] Implement entity + dto + service + controller + module for employee
- [x] Implement entity + dto + service + controller + module for business partner
- [x] Implement entity + dto + service + controller + module for inventory
- [x] Implement entity + dto + service + controller + module for BOM
- [x] Implement entity + dto + service + controller + module for purchase request
- [x] Implement entity + dto + service + controller + module for purchase order
- [x] Implement entity + dto + service + controller + module for goods receipt
- [x] Implement entity + dto + service + controller + module for goods issue
- [x] Implement entity + dto + service + controller + module for sales order
- [x] Add migration for new phase-1 business tables
- [x] Wire modules into app bootstrap
- [x] Run `bun run build`
- [x] Record follow-up gaps if any

## Risks
- Existing repo still has many Directus legacy modules; avoid touching them unless needed for compile integration.
- Build may expose unrelated stale test/type issues outside this phase; report separately if encountered.

## Follow-up gaps
- [x] Soft-FK policy is applied at schema level; DB-level foreign keys are intentionally deferred.
- [x] Auth/profile is still local-core only; employee-user linkage is field-level, not workflow-complete.
- [x] Migration was created but not executed because Neon/Postgres runtime credential was not provided in this turn.
- [x] Purchase order / goods receipt / goods issue / sales order line payloads are now exposed in service flow.
- [x] Receipt posting now writes inventory transactions / balances and updates PO line `qty_received`.
- [x] Goods issue posting now writes outbound inventory transactions, decrements balances, and updates SO line `qty_delivered`.
- [x] Receipt -> PO line matching now supports explicit `purchaseOrderLineId`.
- [x] Goods issue -> SO line matching now supports explicit `salesOrderLineId`.
- [x] Basic moving-average costing is now applied through `erp_inventory_balances.avg_unit_cost` and `inventory_value`.
- [x] Basic reservation flow is now applied through `erp_inventory_balances.qty_reserved`, `erp_sales_order_lines.qty_reserved`, `POST /sales-orders/:id/reserve`, and `POST /sales-orders/:id/unreserve`.
- [x] Existing migration file was amended for `purchase_order_line_id`, `sales_order_id`, `sales_order_line_id`, `avg_unit_cost`, `inventory_value`, `qty_reserved`, and production tables; production tables were applied and schema-verified on Neon.
- [ ] Reservation coverage is still partial: no reservation ledger/history, no expiry, no cross-warehouse allocation strategy, no line-level partial unreserve request payload.
- [ ] Costing policy coverage is still partial: no FIFO layers, no standard cost, no retroactive revaluation, no landed cost allocation.

## Verification
- Build command: `bun run build`
- Status: PASS
- DB migration status: PASS on Neon
- Migration CLI status: PASS via `bun run migration:run` using `src/db/data-source.cli.ts` + repo `.env`
- Smoke test status: PASS on Neon for item -> PO -> GR post -> SO reserve -> GI post
- Production multi-level BOM smoke: PASS on Neon (`/tmp/erp-core-uc5-smoke.json`)
- Production negative smoke: PASS (cycle/insufficient-stock guard paths verified)
- Scoped unit tests: PASS `bunx jest --runInBand src/production-core/production-core.service.spec.ts`
- Optional later: `bun run type:check`

## Current status vs original plan
### Original phase-1 plan
- Scaffold Postgres-native modules/entities/dto/service/controller for approved ERP core scope
- Add migration(s) for approved tables
- Wire modules into app bootstrap
- Make build pass

### Delivered beyond original phase-1 plan
- Ran real migration on Neon and verified tables/critical columns exist
- Fixed TypeORM migration naming blocker in `202606070001-create-core-users.ts` so CLI can run
- Added line payloads and CRUD flow for purchase order, goods receipt, sales order, goods issue
- Added receipt posting flow:
  - create inventory transactions
  - update inventory balances
  - update PO line `qty_received`
  - roll up PO status
- Added issue posting flow:
  - create outbound inventory transactions
  - decrement inventory balances
  - update SO line `qty_delivered`
  - roll up SO status
- Added explicit source links:
  - goods receipt line -> `purchaseOrderLineId`
  - goods issue line -> `salesOrderLineId`
- Added basic moving-average costing via:
  - `erp_inventory_balances.avg_unit_cost`
  - `erp_inventory_balances.inventory_value`
- Added basic reservation/unreserve flow via:
  - `erp_inventory_balances.qty_reserved`
  - `erp_sales_order_lines.qty_reserved`
  - `POST /sales-orders/:id/reserve`
  - `POST /sales-orders/:id/unreserve`
- Ran real end-to-end smoke test on Neon for:
  - item create
  - PO create
  - GR create + post
  - SO create + reserve
  - GI create + post

### Still outside delivered scope
- BOM explosion / multi-level production posting is not implemented
- Manufacturing output with serial/frame/engine/custom produced-item tracking is not implemented
- Reservation ledger/history, expiry, cross-warehouse allocation strategy are not implemented
- Advanced costing (FIFO, standard cost, landed cost, retroactive revaluation) is not implemented
- UI/web flow has not been implemented/verified in this repo
