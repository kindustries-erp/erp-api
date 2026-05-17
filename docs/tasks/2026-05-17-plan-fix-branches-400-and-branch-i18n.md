# Task — FIX: branches endpoint 400 + branch i18n keys (PLAN ONLY)

## Request Input (bạn chỉ cần điền phần này)
- Type: FIX
- Mục tiêu: Sửa lỗi API `GET /api/v1/branches?page=1&pageSize=100` đang trả 400 và sửa translation cho các field liên quan branch trên UI (ví dụ `fields.branch`).
- Bối cảnh/ngữ cảnh: User yêu cầu ERP PLAN mode, bắt buộc kế hoạch DB -> API -> UI, không sửa code/DB/deploy trong pha này.

## Goal
Khóa plan thực thi theo thứ tự DB -> API -> UI để xử lý triệt để lỗi 400 của endpoint branches và đồng bộ i18n branch fields trên ERP Web, có đầy đủ gate validation/evidence.

## PLAN ONLY status
- Trạng thái: PLAN ONLY (chưa sửa code, chưa đổi DB, chưa deploy).
- Ràng buộc: Chỉ inspect/read-only để xác định nguyên nhân và lập kế hoạch triển khai.

## Scope
- In-scope:
  - Triage nguyên nhân 400 cho endpoint `/api/v1/branches` (validation/query parsing/Directus mapping/permission/filter builder).
  - Fix API contract để nhận `page`, `pageSize` hợp lệ và trả response chuẩn list pagination.
  - Rà soát và sửa i18n key branch trên UI (bao gồm keys dạng `fields.branch*` đang hiển thị sai/thiếu translation).
  - Đồng bộ API/UI contract nếu có thay đổi tên field filter/sort/search.
- Out-of-scope:
  - Thay đổi nghiệp vụ master data khác ngoài branch.
  - Thay đổi schema không liên quan endpoint branch.
  - Refactor lớn ngoài phạm vi lỗi 400 + i18n branch.

## Relevant Files (dự kiến kiểm tra khi execute)
- API
  - `src/modules/**/branches*` hoặc module catalog/master-data chứa branch endpoints.
  - DTO query list branches (`page`, `pageSize`, filter/search DTO).
  - Service gọi Directus/DB cho branches list.
- Web
  - `src/modules/**/api/*branch*` (client API call).
  - Components/forms hiển thị branch field label.
  - `src/i18n/vi.ts`, `src/i18n/en.ts` (namespace keys cho `fields.branch*`).

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - Collection `branches` (hoặc tên canonical đang dùng trong Directus).
  - Các field tối thiểu expected cho list: `id`, `code`, `name`, `is_active` (xác nhận theo schema thực tế).
- Data nền cần có:
  - Có records branch để test phân trang `page=1&pageSize=100`.
- Constraint/index/default cần có:
  - Primary key hợp lệ.
  - Trường sort mặc định (nếu API đang sort theo field cụ thể) phải tồn tại.
- Kết quả: `DB_READY` (dự kiến; sẽ xác nhận bằng precheck read-only khi execute).
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): tạo task DB riêng trước khi qua API.

## Coordination Impact
- [ ] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime khi EXEC)
- [ ] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
  - [ ] 2.1 Reproduce 400 với request thật và log chi tiết lỗi
  - [ ] 2.2 Xác định root cause (DTO validation / query parsing / Directus filter / permission)
  - [ ] 2.3 Fix endpoint list branches và smoke lại trả 200
  - [ ] 2.4 Verify pagination contract (`page,pageSize,total,totalPages,data`)
- [ ] 3.0 UI gate done
  - [ ] 3.1 Rà toàn bộ key branch liên quan (label/table/form/filter/error)
  - [ ] 3.2 Bổ sung/chỉnh i18n `vi` + `en`, loại bỏ key raw hiển thị trên UI
  - [ ] 3.3 Smoke UI route dùng branch fields, xác nhận không còn `fields.branch` raw
- [ ] 4.0 Validate
  - [ ] 4.1 API: `npm run build`
  - [ ] 4.2 Web: `npx tsc --noEmit`
  - [ ] 4.3 Smoke endpoint `/api/v1/branches?page=1&pageSize=100` => 200
  - [ ] 4.4 Smoke UI translation branch pass
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (api/web)
  - [ ] 5.3 Deploy stack liên quan + runtime verify
  - [ ] 5.4 Summary with evidence

## Kế hoạch thực thi chi tiết (DB -> API -> UI)

### Gate 1 — DB / Directus precheck (read-only)
1) Xác định collection branch canonical đang dùng bởi API (ví dụ `branches`).
2) Verify schema fields qua Directus/DB read-only:
   - tồn tại fields list/sort/search mà endpoint cần.
3) Verify dataset tối thiểu:
   - có dữ liệu để test page/pageSize.
4) Chốt trạng thái:
   - `DB_READY` nếu schema + data đủ.
   - `DB_GAP_FOUND` nếu thiếu field/collection/index bắt buộc (dừng API fix, mở DB task trước).

### Gate 2 — API fix endpoint 400
1) Reproduce lỗi bằng đúng URL user cung cấp.
2) Bật log/trace để lấy raw error từ layer validate/service/upstream Directus.
3) Khoanh vùng root cause, ưu tiên các điểm thường gây 400:
   - DTO parse số cho `page`, `pageSize`.
   - Guard giá trị `pageSize` (nếu đang reject > threshold hoặc parse NaN).
   - Query builder filter/sort truyền sai format cho Directus.
   - Route prefix hoặc params mapping sai.
4) Sửa tối thiểu, không đổi scope:
   - giữ contract endpoint hiện tại.
   - normalize query params trước khi gọi service/upstream.
5) Smoke sau fix:
   - URL user cung cấp trả 200.
   - test thêm biên: thiếu query params, page/pageSize string, pageSize lớn.

### Gate 3 — UI i18n cho branch fields
1) Rà key branch liên quan bằng grep usage:
   - keys `fields.branch`, `fields.branch_*`, labels branch trong form/list/filter.
2) Chuẩn hóa dictionary:
   - thêm/chỉnh key tương ứng trong `vi.ts` và `en.ts`.
   - đảm bảo gọi `t("...")` đúng contract, không fallback arg thứ 2.
3) Smoke UI:
   - màn có branch selector/table/form hiển thị đúng ngôn ngữ.
   - không còn raw key kiểu `fields.branch` trên giao diện.

## Gate validations (pass criteria)
- DB gate pass:
  - Có evidence collection+field tồn tại và dữ liệu test đủ.
- API gate pass:
  - `GET /api/v1/branches?page=1&pageSize=100` trả 200.
  - Response pagination đúng contract dùng bởi UI.
- UI gate pass:
  - Không còn key thô branch trên UI.
  - Build/typecheck pass.

## Risk & Rollback
- Risk 1: Fix DTO/query làm lệch contract endpoint cũ.
  - Mitigation: giữ nguyên shape response, chỉ sửa parse/validation.
  - Rollback: revert commit API.
- Risk 2: Sửa i18n thiếu namespace gây key not found chỗ khác.
  - Mitigation: grep usage toàn repo web cho branch keys trước/sau.
  - Rollback: revert commit i18n.
- Risk 3: Root cause 400 nằm ở permission/schema staging.
  - Mitigation: Gate 0 bắt buộc xác nhận DB/permission trước khi code.

## Evidence cần thu thập khi EXEC
- DB precheck output:
  - collection/field check + sample count.
- API evidence:
  - trước fix: response 400 + message.
  - sau fix: response 200 cho URL user cung cấp.
  - build output pass.
- UI evidence:
  - grep keys branch trước/sau.
  - typecheck pass.
  - ảnh/chuỗi thao tác xác nhận không còn raw key `fields.branch`.
- Deploy/runtime:
  - build + up stack liên quan.
  - `docker ps` + `docker logs --tail 10` container liên quan.

## Lessons Learned
- Link: `docs/lessons-learned/<file>.md#<anchor>` or "No issue"

## Commit/Push Status
- API repo: PLAN ONLY (chưa thực hiện)
- Web repo (if affected): PLAN ONLY (chưa thực hiện)
- DB/directus staging: PLAN ONLY (chưa thực hiện)

## Sẵn sàng thực thi
Plan đã chốt theo DB -> API -> UI và giữ trạng thái PLAN ONLY. Chờ user duyệt để chuyển EXEC mode.