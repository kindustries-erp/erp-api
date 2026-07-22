# ERP Core API Task — Inventory UOM + Item Type Masters

## Scope
- Lane: `erp-core`
- Goal: add Postgres-native master tables for inventory UOM and item type; wire inventory item create/update/list to use these masters while preserving current item payload compatibility.

## Gate 0 DB precheck
- Current item table: `erp_inventory_items`
- Current fields in use: `sku`, `item_name`, `uom`, `item_type`, `status`
- Current gap: `uom` and `item_type` are free-text varchar columns on item rows; no master/config tables exist.
- New additive tables proposed:
  - `erp_uoms`
  - `erp_item_types`
- Initial DB result: `DB_GAP_FOUND`

## DB contract target
- `erp_uoms`: code, name, description, is_active, created_at, updated_at
- `erp_item_types`: code, name, description, is_active, created_at, updated_at
- `erp_inventory_items` keeps compatibility fields `uom` and `item_type` as codes for now; app validates against masters.
- Seed canonical values:
  - UOM: `PCS`, `KG`, `M`, `L`, `BOX`, `SET`
  - Item types: `FG`, `RAW`, `WIP`, `GOODS`, `SERVICE`, `OTHER`

## API contract target
- New endpoints:
  - `GET /api/v1/inventory/uoms`
  - `POST /api/v1/inventory/uoms`
  - `PATCH /api/v1/inventory/uoms/:id`
  - `GET /api/v1/inventory/item-types`
  - `POST /api/v1/inventory/item-types`
  - `PATCH /api/v1/inventory/item-types/:id`
- Inventory item create/update validates provided `uom` and `itemType` against active masters.
- Inventory item list/detail returns existing fields plus optional master detail when useful.

## Acceptance
- Build passes.
- Migration runs on live core DB.
- API endpoints smoke pass.
- Inventory item CRUD still works with master-backed values.

## Risk / rollback
- Additive migration only.
- Rollback: stop using new endpoints; keep existing item columns untouched. Table drop only if explicitly approved later.
