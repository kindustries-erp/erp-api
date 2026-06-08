# Purchase Order core compatibility fix

## Scope
Fix ERP core purchase-order create/update flow so current FE purchase UI can work against core DB Neon.

## Problem
Current FE purchase flow (`OperationalFormDrawer` / `OperationalListPage`, variant `purchase`) posts legacy operational payload fields to `/api/v1/purchase-orders`, but BE core DTO only accepts core payload (`poNo`, `supplierId`, `orderDate`, `expectedDate`, `lines[].qtyOrdered`, etc.). Result: create PO fails at validation.

## Planned API changes
- Add compatibility transform/acceptance for FE purchase payload aliases:
  - `purchase_no` -> `poNo`
  - `supplier_id` -> `supplierId`
  - `document_date` -> `orderDate`
  - `expected_receipt_date` or `due_date` -> `expectedDate`
  - `notes` -> `remarks`
- Add line field mapping:
  - `inventory_item_id`/`item_id` -> `itemId`
  - `item_name` -> `description` fallback
  - `qty` -> `qtyOrdered`
  - `unit_price` -> `unitPrice`
- Ignore unsupported legacy fields safely instead of 400 when possible.
- Preserve core DB write shape in `erp_purchase_orders` / `erp_purchase_order_lines`.

## Verification target
- POST purchase order from FE purchase screen succeeds
- PATCH purchase order from FE purchase screen succeeds
- GET list/detail still works for GR and other core pages
- DB rows exist in `erp_purchase_orders` and `erp_purchase_order_lines`
