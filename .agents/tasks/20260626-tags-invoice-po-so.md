# Tags — Invoice / PO / SO

**Date**: 2026-06-26  
**Status**: DONE

## Scope

Add tag support (thẻ nhãn) to three ERP modules: Invoice, Purchase Order, Sales Order.  
Tags are stored polymorphically via `sys_entity_tags` (no schema migration needed).

## Decisions

- **Option B**: Tags are selected during create, applied via `updateEntityTags` after the POST returns the new entity ID.
- **UI**: Only in drawer (not in list table columns).
- **Filter**: Tag filter added to list pages (future filtering capability).

## Changes

### API Backend

| File | Change |
|---|---|
| `erp-invoices-core.service.ts` | `tag_id` subquery filter in `findAll` |
| `erp-invoices-core.controller.ts` | `@ApiQuery tag_id` |
| `purchase-orders-core.service.ts` | `tag_id` raw SQL subquery in `findAll` |
| `sales-orders-core.service.ts` | `tag_id` raw SQL branch in `findAll`; added `In` import |

### Web Frontend

| File | Change |
|---|---|
| `EntityTagSelector.tsx` | Added `pendingMode`, `pendingTagIds`, `onPendingChange` props for Option B |
| `useErpInvoiceForm.ts` | `pendingTagIds` state; calls `updateEntityTags` after create |
| `ErpInvoiceFormGeneral.tsx` | `EntityTagSelector` with `invoiceId`/pendingMode wiring |
| `erpInvoicesCoreApi.ts` | `tag_id` in `ErpInvoiceListParams` |
| `useErpInvoicesList.ts` | `tag_id` custom filter passed to API |
| `ErpInvoicePage.tsx` | Tag filter combobox in filterConfig; props wired to form |
| `FormGeneralInfoPanel.tsx` | `EntityTagSelector` for purchase/sales variants |
| `PurchaseOrderDrawer.tsx` | `pendingTagIds`/`onPendingTagsChange` props |
| `usePurchaseOrderDrawer.ts` | Calls `updateEntityTags` after `createPurchase` |
| `PurchaseOrderListPage.tsx` | `pendingTagIds` state; wired to drawer |
| `SoFormDrawer.tsx` | `EntityTagSelector` in rightPanel; `pendingTagIds` props |
| `ErpSalesOrdersPage.tsx` | `pendingTagIds` state; calls `updateEntityTags` after SO create |

## Verification

```bash
# Web
cd liouni-erp-web && bun run tsc --noEmit  # ✅ 0 errors

# API
cd liouni-erp-api && bun run tsc --noEmit  # ✅ 0 errors
```
