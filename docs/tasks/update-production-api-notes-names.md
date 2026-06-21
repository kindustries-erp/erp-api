# Update Production API Notes and Item Names

## Context
The UI required enabling notes edits for `CONFIRMED` and `IN_PROGRESS` production orders, which threw an error because the backend strictly restricted `PATCH /orders/:id` to `DRAFT` status only. Also, the UI needed the backend to return just the item name instead of `code — name` for `finishedGoodItemName` and `itemName` within materials.

## Implementation Details
1. **Removed SKU prefix**:
   - `src/production-core/production-core.service.ts`: Updated `findOne` to stop concatenating the SKU in `finishedGoodItemName` and material `itemName`/`originalItemName`.
2. **Allowed outputMetadata edits**:
   - `src/production-core/production-core.service.ts`: Updated `updateDraft` (called by `PATCH orders/:id`) to allow modifications to `outputMetadata`, `plannedStartDate`, and `plannedEndDate` even if the order is not in `DRAFT` status. Modifying the BOM quantities/materials is correctly bypassed for non-DRAFT orders.
