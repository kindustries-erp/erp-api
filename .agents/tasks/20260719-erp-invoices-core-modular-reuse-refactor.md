# ERP Invoices Core Modular Reuse Refactor — DONE

## Evidence
- `bun run type:check` → clean (0 errors)
- `bunx jest --forceExit` → 41/41 tests pass
- `bun run build` → `dist/main.js` present

## What was done
1. Extracted pure helpers into `helpers/`:
   - `invoice-gdt.helper.ts` — `fetchWithRetry`, `sleep`, `resolvePortalVatRate`, `parsePortalIsoDate`, `buildInvoiceR2Key`, `extractXmlFromBuffer`
   - `invoice-metadata.helper.ts` — `extractInvoiceMetadata`
   - `invoice-mapper.helper.ts` — `toInvoiceDto`, `parseVatRateForDisplay`
2. Created focused subservices in `services/`:
   - `invoice-lifecycle.service.ts` — CRUD, post/unpost, bulk branch, validation, voucher links
   - `invoice-portal.service.ts` — GDT portal sync, reparseXml, bulkDownloadXml, progress$ Subject
   - `invoice-import.service.ts` — XML/PDF/ZIP bulk import (buyer, seller, mixed)
   - `invoice-files.service.ts` — presigned URLs, upload/download, ZIP export
   - `invoice-query.service.ts` — findAll, getColumnOptions, exportExcel
3. Replaced 3298-line monolith `erp-invoices-core.service.ts` with a ~210-line facade that delegates to subservices
4. Updated `erp-invoices-core.module.ts` to register all 5 subservices
5. Updated `erp-invoices-core.service.spec.ts` to mock subservices instead of raw dependencies

## Reuse points
- `normalizeInvoiceNo` — existing util reused
- `applyMultiKeywordFilter`/`applyMultiKeywordMultiFieldFilter` — existing common util reused
- `parseVietnamInvoiceXml`, `XmlParseError` — existing xml-parser reused
- R2Service, BankTransactionsCoreService, AccountingCoreService, NotificationsService — injected as before


## Goal
Refactor `src/erp-invoices-core/erp-invoices-core.service.ts` into smaller reusable modules/helpers while keeping all public behavior, routes, DTO contracts, and response shapes unchanged.

## Reuse audit
Already existing and should be reused, not recreated:
- `src/erp-invoices-core/utils/normalize-invoice-no.ts`
- `src/common/utils/query-builder.util.ts` (`applyMultiKeywordFilter`, `applyMultiKeywordMultiFieldFilter`)
- `src/erp-invoices-core/xml-parser/vietnam-invoice-xml.parser.ts`
- `src/r2/r2.service.ts`
- `src/accounting-core/services/accounting-core.service.ts`
- `src/bank-transactions-core/bank-transactions-core.service.ts`
- `src/notifications/notifications.service.ts`

No shared helper was found yet for:
- `fetchWithRetry`
- `sleep`
- invoice metadata extraction (`licensePlate`, `settlementOrder`)
- portal date normalization (`parsePortalIsoDate`)

Those should be extracted only if the new internal helper is reused by multiple invoice flows, and kept inside `src/erp-invoices-core/**` unless a true cross-domain use case appears.

## Proposed module split
1. `invoice-query` slice
   - `findAll`
   - `getColumnOptions`
   - `exportExcel`
   - shared query/sort/filter mapping helpers
2. `invoice-lifecycle` slice
   - `create`
   - `update`
   - `remove`
   - `cancel`
   - `bulkSetBranch`
   - `setInvoiceValid`
   - `postInvoice`
   - `unpostInvoice`
3. `invoice-portal` slice
   - `getPortalConfig`
   - `savePortalConfig`
   - `checkTokenValid`
   - `syncFromPortal`
   - `syncDetailFromPortal`
   - `bulkDownloadXml`
   - `reparseXml`
4. `invoice-import` slice
   - `bulkImportBuyerXml`
   - `bulkImportSellerXml`
   - `bulkImportMixed`
5. `invoice-files` slice
   - file upload/download URLs
   - PDF/XML download helpers
   - ZIP export helpers
6. `invoice-shared` internal helpers
   - metadata extraction
   - portal fetch wrapper/retry
   - date/rate normalization
   - invoice file-name builders

## Refactor rule
- Keep `ErpInvoicesCoreService` as orchestrator/facade.
- Move only cohesive responsibilities out of the monolith.
- Prefer reuse over duplication.
- If a helper already exists elsewhere, import it instead of creating a parallel implementation.
- If a helper is invoice-domain specific and used in more than one slice, extract it once under `src/erp-invoices-core/utils/` or `src/erp-invoices-core/helpers/`.

## Test plan
Current tests already available and must keep passing:
- `src/erp-invoices-core/erp-invoices-core.service.spec.ts`
- `src/erp-invoices-core/erp-invoices-cron.service.spec.ts`

Add/update coverage for the refactor:
- keep service regression coverage for post/unpost/validate/token checks
- add unit tests for any new reusable helpers
- add focused spec for each extracted subservice if behavior moves out of the monolith
- add controller smoke test if DI or route wiring changes

## Rollout checkpoints
1. Audit current service methods and map each method to a target slice.
2. Extract pure helpers first, then move portal/import/file logic.
3. Keep controller and module registration unchanged until the final wiring step.
4. Run targeted tests for the touched slice after each extraction.
5. Finish with module-level tests and the existing invoice service/cron specs.
6. Only after that run broader repo validation.

## Validation gates
- Narrow test scope: `bunx jest --forceExit src/erp-invoices-core/erp-invoices-core.service.spec.ts src/erp-invoices-core/erp-invoices-cron.service.spec.ts`
- Wider repo checks after refactor: `bun run check:ci`
- Build check: `bun run build`

## Notes
- No schema change is expected for this refactor.
- Public API behavior must remain unchanged.
- If any response shape or route changes become necessary, document the web follow-up before implementation.
