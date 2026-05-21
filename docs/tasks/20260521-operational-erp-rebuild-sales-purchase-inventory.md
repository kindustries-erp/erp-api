# Operational ERP Rebuild — Sales / Purchase / Inventory

- Source contract: `/opt/docs/ai/liouni-erp/tasks/20260521-operational-erp-rebuild-sales-purchase-inventory.md`
- Status: IN_PROGRESS

## Checklist
- [x] Read AGENTS + technical instructions + shared ERP context
- [x] Record Gate 0 DB precheck result from shared task
- [x] Scaffold new backend modules for sales/purchase/expense/inventory/payment-links
- [x] Implement Kgara import adapter
- [x] Implement DMS-compatible adapter contract
- [ ] Implement recurring generation service
- [x] Implement receivable/payable summary APIs
- [x] Preserve legacy e-invoice endpoints/modules
- [x] Build + smoke
- [ ] Commit + push

## Evidence
- Build: `npm run build` exit 0 in `/opt/repos/liouni-erp/liouni-erp-api`.
- Module registered: `OperationalDocumentsModule` in `src/app.module.ts`.
- Added endpoints: `/api/v1/sales-service-orders`, `/api/v1/sales-service-orders/import/kgara`, `/api/v1/sales-service-orders/import/dms`, `/api/v1/purchase-orders`, `/api/v1/operating-expenses`, `/api/v1/operational-receivables`, `/api/v1/operational-payables`, `/api/v1/document-payment-links`.

## Notes
- Legacy AR/AP remains read-only/integration reserve.
- New operational flow is source-of-truth for future UI.
- Recurring generation service remains explicit follow-up; recurrence fields/API payload are present.
