# Task — ERP API

## Request Input (bạn chỉ cần điền phần này)
- Type: FIX
- Mục tiêu: Vá invalid UUID handling cho các action endpoints ERP core để không còn trả 500 khi FE gửi id sai format.
- Bối cảnh/ngữ cảnh: Wave 2 FE cần wire action thật cho goods receipt / goods issue / sales order. Verify trên instance :10001 cho thấy fake id đang nổ Postgres `invalid input syntax for type uuid` và trả 500.

## Goal
Chuyển invalid UUID từ lỗi DB 500 thành lỗi API chuẩn 400; giữ behavior 404/NotFound cho UUID hợp lệ nhưng record không tồn tại; build pass và smoke thật trên :10001.

## Scope
- In-scope:
  - `goods-receipts/:id/post`
  - `goods-issues/:id/post`
  - `sales-orders/:id/reserve`
  - `sales-orders/:id/unreserve`
  - validate path param `id`
- Out-of-scope:
  - thay đổi payload business logic khác
  - FE wiring
  - production history endpoint

## Relevant Files
- `src/goods-receipts-core/goods-receipts-core.controller.ts` - action endpoint GR post
- `src/goods-issues-core/goods-issues-core.controller.ts` - action endpoint GI post
- `src/sales-orders-core/sales-orders-core.controller.ts` - action endpoints reserve/unreserve
- `src/**/**.spec.ts` - test nếu cần bổ sung

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan: `erp_goods_receipts.id`, `erp_goods_issues.id`, `erp_sales_orders.id` (UUID PK)
- Data nền cần có: chỉ cần existing records để smoke valid-id path
- Constraint/index/default cần có: UUID PK trên các bảng trên
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging):

## Coordination Impact
- [ ] Directus staging schema affected
- [ ] ERP Web contract affected
- [x] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
- [x] 3.0 UI handoff gate done
- [x] 4.0 Validate
  - [x] 4.1 `bun run build`
  - [x] 4.2 Smoke test affected endpoints
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: `DB_READY`
- Build: `bun run build` PASS
- Smoke:
  - `POST /goods-receipts/fake-id/post` -> 400 `Validation failed (uuid is expected)`
  - `POST /goods-issues/fake-id/post` -> 400 `Validation failed (uuid is expected)`
  - `POST /sales-orders/fake-id/reserve` -> 400 `Validation failed (uuid is expected)`
  - `POST /sales-orders/fake-id/unreserve` -> 400 `Validation failed (uuid is expected)`
  - valid existing IDs still keep old business behavior (`400 already posted` for GR/GI; `201` for SO reserve/unreserve on current sample record)

## Lessons Learned
- Link: No issue

## Commit/Push Status
- API repo:
- Web repo (if affected): not affected
- DB/directus staging: apply+verify+document (no code push required)
