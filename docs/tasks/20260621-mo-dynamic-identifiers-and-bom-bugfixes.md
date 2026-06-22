# Task: MO dynamic identifiers + BOM/MO bugfix batch

## Scope
- DB/API/UI coordinated change for MO completion identifiers (VIN/Engine/Serial/Lot policy aware)
- BOM/MO bugfixes from implementation plan `/home/lio/.gemini/antigravity-ide/brain/8ff6f73e-166a-4a7f-bad5-a6c1d0144e74/artifacts/implementation_plan.md`

## DB
- Add tracking policy support to inventory item entity
- Link vehicle/serial records back to production order

## API
- Extend complete-production DTO with identifiers
- Enforce identifier count by tracking policy
- Auto-create vehicle/serial records on completeProduction
- Keep GR line linkage via receiptLineId
- Require warehouseCode when confirming/creating confirmed MO as per current plan

## Verification
- Bun build/check
- Targeted production tests

## Risks
- Tracking policy enforcement can block completion for items with incomplete identifier data
- Entity changes require TypeORM metadata consistency

## Rollback
- Revert repo commit(s) in API repo only
