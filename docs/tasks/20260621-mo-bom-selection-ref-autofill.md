# Task: MO BOM Selection + Auto-fill ReferenceNo — API

## Plan Source
`/home/lio/.gemini/antigravity-ide/brain/5d1b2c70-a33f-4887-a456-27aed6bcfcb2/implementation_plan.md`

## Scope (API)
1. `dto/execute-production.dto.ts` — add optional `bomId`
2. `production-core.service.ts` — expose `generateProductionReferenceNo` as public, read `dto.bomId` in `execute()` and `updateDraft()`
3. `production-core.controller.ts` — add `GET /orders/next-reference-no` endpoint

## Checklist
- [ ] DTO: add bomId field
- [ ] Service: make generateProductionReferenceNo public
- [ ] Service: execute() — if dto.bomId, findOne by id; fallback to ACTIVE latest
- [ ] Controller: GET orders/next-reference-no
- [ ] bun build — PASS
- [ ] Commit + push

## Commit
- pending
