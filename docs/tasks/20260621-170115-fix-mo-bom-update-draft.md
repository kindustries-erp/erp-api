# Fix MO BOM selection and updateDraft overwrite bug

## Scope
- Fix `updateDraft` in `ProductionCoreService` to respect the chosen `bomId` (`dto.bomId`) when updating a Manufacturing Order.
- Ensure the `outputMetadata.bomId` field is preserved and updated when saving a draft.
- Prevent the silent fallback to the latest ACTIVE BOM that causes quantity validation errors during `confirmOrder`.

## Implementation
- Modify `production-core.service.ts`

## Verification
- Code builds: `bun build`
- Linter passes: `bun lint`
- Types check: `bun lint:check`
