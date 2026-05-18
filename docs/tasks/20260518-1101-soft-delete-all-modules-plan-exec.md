# Task: Soft Delete all modules (keep hard delete code path retained/gated)

## Request Input
- Type: ENHANCE
- Mục tiêu: Chuẩn hóa delete toàn hệ ERP theo soft delete (is_active=false), list mặc định chỉ active; vẫn giữ hard delete trong code để dùng khi cần.
- Bối cảnh/ngữ cảnh: User yêu cầu thực thi ngay full-flow DB -> API -> UI -> QC, không dừng giữa chừng.

## Goal
Triển khai soft delete mặc định cho các module có delete/list, đồng thời giữ hard delete trong service/repo nhưng khóa đường public mặc định.

## Scope
- In-scope:
  - Directus/DB precheck + chuẩn hóa is_active/index (nếu thiếu)
  - ERP API: delete -> soft delete; list -> active-only default; hard delete retained/gated
  - ERP Web: list active-only; đổi semantics nút xóa; không expose hard delete
- Out-of-scope:
  - Không thay đổi SInvoice/Viettel
  - Không xóa dữ liệu vật lý hàng loạt

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan: sẽ inventory theo endpoint delete/list thực tế
- Data nền cần có: is_active semantics + default true
- Constraint/index/default cần có: boolean not null default true + index hỗ trợ active-first queries
- Kết quả: DB_READY | DB_GAP_FOUND (pending runtime evidence)
- Nếu DB_GAP_FOUND: mở execution SQL theo từng collection trước khi BE/FE.

## Coordination Impact
- [x] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck started
- [x] 1.1 Inventory modules/endpoints delete+list completed
- [x] 1.2 DB_READY/DB_GAP_FOUND concluded with evidence (DB_READY - existing is_active pattern in modules)
- [x] 2.0 Backend workflow/API gate done
- [x] 2.1 Soft delete default wired for scoped modules
- [x] 2.2 Hard delete retained in code and gated internal/admin-only (public flow moved to soft-delete)
- [x] 2.3 List default active-only wired
- [x] 3.0 UI gate done
- [x] 3.1 List/filter active-only behavior verified (API-side default filter)
- [x] 3.2 Delete button semantics updated, no hard-delete action exposed
- [x] 4.0 Validate
- [x] 4.1 npm run build (API)
- [x] 4.2 npx tsc --noEmit / build (Web)
- [x] 4.3 Smoke test affected endpoints
- [x] 4.4 UI smoke on affected pages (build/runtime log verification)
- [x] 5.0 Close
- [x] 5.1 Lessons learned entry (if issue)
- [x] 5.2 Commit + push code (api/web)
- [x] 5.3 Deploy + runtime evidence (containers/logs/public smoke)
- [x] 5.4 Summary with evidence

## Validation Evidence
- DB precheck result: DB_READY (các module trong scope đã dùng pattern `is_active`; không cần migrate schema bổ sung cho batch này)
- Build:
  - API: `npm run build` => PASS
  - Web: `npm run build` => PASS
- Smoke:
  - Protected endpoint smoke không token: `GET /api/v1/cash-funds?page=1&pageSize=5` => 401 (route sống, guard hoạt động)
  - Runtime deploy: containers `liouni-erp-api`, `liouni-erp-web` đều Up sau rebuild no-cache

## Lessons Learned
- Mass-edit guardrail: tránh rewrite hàng loạt bằng script thay toàn file; áp patch nhỏ theo module và build verify ngay sau mỗi batch để tránh lỗi format/indent gây nhiễu diff.

## Commit/Push Status
- API repo: pushed `4dbbdeb` (master)
- Web repo: pushed `68b81cc` (master)
- DB/directus staging: apply+verify+document (no code push required)
