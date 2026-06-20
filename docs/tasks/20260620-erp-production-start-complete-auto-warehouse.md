# Task: Production start/complete flow with auto GI/GR

## Request Input (bạn chỉ cần điền phần này)
- Type: FEATURE
- Mục tiêu: Thay flow xuất/nhập kho thủ công của MO bằng flow Sản xuất / Hoàn thành có tự tạo GI/GR ngầm.
- Bối cảnh/ngữ cảnh: Theo implementation plan `/home/lio/.gemini/antigravity-ide/brain/f2f914ad-a6b2-4f1f-923a-6d523dfd1593/artifacts/implementation_plan.md`, đã reconcile với source hiện tại để tránh regression GI inline / GR prefill cũ.

## Goal
Cho phép user thao tác sản xuất theo từng phần trên MO bằng 2 action nghiệp vụ:
- `Sản xuất`: auto issue NVL + chuyển MO sang `IN_PROGRESS`
- `Hoàn thành`: auto receipt thành phẩm + tăng `qtyProduced`, tự chuyển `COMPLETED` khi đủ số lượng

## Scope
- In-scope:
  - API endpoint `POST /api/v1/production/orders/:id/start`
  - API endpoint `POST /api/v1/production/orders/:id/complete`
  - inventory shortage validation cho số lượng partial
  - auto-create GI/GR records và inventory transactions liên quan
  - cập nhật `qtyIssued` trên MO materials, `qtyProduced` + status trên MO header
- Out-of-scope:
  - đổi schema DB
  - redesign module warehouse độc lập ngoài flow MO
  - deploy runtime

## Relevant Files
- `src/production-core/production-core.controller.ts` - add start/complete endpoints
- `src/production-core/production-core.service.ts` - core business flow start/complete
- `src/production-core/dto/start-production.dto.ts` - DTO mới
- `src/production-core/dto/complete-production.dto.ts` - DTO mới

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `erp_production_orders.qty_to_produce`
  - `erp_production_orders.qty_produced`
  - `erp_production_orders.status`
  - `erp_production_orders.warehouse_code`
  - `erp_production_order_materials.qty_required`
  - `erp_production_order_materials.qty_issued`
  - `erp_goods_issues.production_order_id`
  - `erp_goods_issue_lines.production_order_material_id`
  - `erp_goods_receipts.production_order_id`
  - `erp_goods_receipt_lines.item_id`, `qty_received`
  - `erp_inventory_balances`
  - `erp_inventory_transactions`
- Data nền cần có:
  - MO đã có BOM/material lines
  - inventory item/balance cho NVL và thành phẩm
- Constraint/index/default cần có:
  - không cần field mới; status lifecycle phải support `CONFIRMED` -> `IN_PROGRESS` -> `COMPLETED`
- Kết quả: `DB_READY`

## Coordination Impact
- [ ] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
- [x] 3.0 UI handoff gate done — phía Web repo
- [x] 4.0 Validate
  - [x] 4.1 `bun run lint:check` — PASS (0 warnings)
  - [x] 4.2 `bun run build` — PASS (`nest build` exit 0)
  - [x] 4.3 `bun run check` — PASS (tsc + eslint + prettier)
  - [x] 4.4 pre-commit test — PASS (5 suites / 18 tests)
  - [x] 4.5 Deploy health check — API container up, health OK sau khi xử lý deploy issue
- [x] 5.0 Close
  - [x] 5.1 Lessons learned — TypeORM `.save()` requires `as unknown as T` double-cast; dist-output-path guard sẵn có qua tsconfig.build.json
  - [x] 5.2 Commit + push code
  - [x] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: `DB_READY`
- `bun run lint:check`: PASS (exit 0, 0 warnings)
- Build: `nest build` PASS (exit 0)
- `bun run check` (tsc + eslint + prettier): PASS
- Test: 5 suites / 18 tests PASS (pre-commit)
- Deploy: health check `http://127.0.0.1:10010/api/v1/auth/profile` → 401 (API live) sau deploy issue resolved

## Lessons Learned
- TypeORM 0.3 `.save(entity)` return type bị infer là `T[]` khi dùng `as any` cho entity input → cần double-cast `as unknown as T` cho single-entity save.
- `production-core.service.spec.ts` constructor arity phải cập nhật theo mỗi lần thêm `@InjectRepository()` mới — pattern hiện tại cần update thủ công.

## Commit/Push Status
- API repo: `erp-master` @ `66efe94` → `github-industries` ✅
- Web repo (if affected): `erp-master` @ `90f010a` → `github-industries` ✅
- DB/directus staging: không cần migration
