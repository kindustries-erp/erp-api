# API Contract Change Template

## Khi dùng
Dùng khi đổi:
- request DTO
- response shape
- route path / query params
- auth/permission ảnh hưởng Web/QC

## Required note trong task
- Old contract:
- New contract:
- Breaking hay additive:
- Web affected files/pages:
- Smoke plan:

## Decision rules
- **Additive trước** nếu có thể
- Nếu breaking: ghi rõ migration/handoff path
- Không đổi field name chỉ vì sở thích nếu chưa có lý do business hoặc compatibility benefit

## Checklist
1. Xác nhận DB prerequisite
2. Update DTO / validation
3. Update service/controller contract
4. Update tests gần nhất
5. Ghi Web handoff:
   - endpoint
   - method
   - payload/response delta
   - permission delta
6. Smoke endpoint affected

## Evidence block mẫu
```md
- Old contract: `GET /api/v1/example -> { items: LegacyItem[] }`
- New contract: `GET /api/v1/example -> { data: ExampleDto[], total: number }`
- Compatibility: additive / breaking
- Web follow-up: update `src/modules/example/api/exampleApi.ts`
- Smoke: PASS/FAIL
```
