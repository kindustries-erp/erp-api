# Purchase Order strict core contract + wave 2 flow verify

## Scope
- Remove purchase-order compatibility layer in erp-core BE
- Enforce strict DTO contract for `/api/v1/purchase-orders`
- Verify full core flow: PO -> GR -> Post GR -> Production -> Execute

## Contract target
Purchase-order API only accepts core fields:
- `poNo`
- `supplierId`
- `orderDate`
- `expectedDate`
- `status`
- `remarks`
- `lines[].itemId`
- `lines[].description`
- `lines[].qtyOrdered`
- `lines[].unitPrice`
- `lines[].amount`

Legacy aliases must be rejected by validation.

## Verification target
- legacy payload returns validation error
- core payload returns 201
- goods receipt create works from created PO
- post goods receipt updates inventory + PO receipt status
- production execute works against available balances/BOM
