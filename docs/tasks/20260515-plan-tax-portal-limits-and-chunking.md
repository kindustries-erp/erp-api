# Task — ERP API — 20260515 — IN PROGRESS — Chuẩn hóa pageSize/date-range/chunking cho Tax Portal

## Request Input (bạn chỉ cần điền phần này)
- Type: ENHANCE
- Mục tiêu: Chuẩn hóa toàn bộ luồng fetch dữ liệu từ hoadondientu/cổng thuế để pageSize chỉ nhận 15/30/50, khoảng ngày mỗi request không vượt quá 1 tháng, nếu user chọn dài hơn thì backend tự chunk theo tháng và upsert/append an toàn vào DB.
- Bối cảnh/ngữ cảnh: User đã approve thực thi sau pha ERP PLAN mode. Scope bao phủ cả API hiện có và handoff UI để ngăn user gửi input sai hoặc hiểu nhầm behavior.

## Goal
Lập kế hoạch triển khai an toàn, DB-first, cho việc thống nhất enforcement rule của Tax Portal:
1. pageSize chỉ nhận 15/30/50.
2. fromDate/toDate cho mỗi external request không bao giờ vượt quá 1 tháng.
3. Nếu khoảng user chọn dài hơn 1 tháng, hệ thống tự chia chunk theo tháng, fetch tuần tự, có throttling, rồi upsert vào `einvoices`.
4. UI phải phản ánh đúng constraint nhưng không phụ thuộc riêng vào UI; backend vẫn là lớp enforcement cuối cùng.

## Scope
- In-scope:
  - Tax Portal / GDT sync flow trong `src/sinvoice/sinvoice.service.ts`
  - API contract liên quan request sync và local list reload pattern
  - Handoff cho ERP Web về validation/filter/pagination UX của tab Hóa đơn bán ra / Hóa đơn mua vào
  - Evidence checklist cho append/upsert khi sync nhiều chunk
- Out-of-scope:
  - Thay đổi schema DB khi Gate 0 vẫn `DB_READY`
  - Outbound Viettel draft/publish flow
  - Thay đổi behavior inbound Viettel v2 nếu tài liệu active không yêu cầu 15/30/50
  - Thực thi code/DB/deploy trong pha plan này

## In-scope / Out-of-scope boundary
- In-scope nghiệp vụ:
  - Fetch dữ liệu thuế từ Tax Portal theo bộ lọc ngày/search/pageSize
  - Tự động chunk khi user chọn khoảng ngày > 1 tháng
  - Upsert/override record trùng khi sync lại
- Out-of-scope nghiệp vụ:
  - Không áp đặt 15/30/50 cho Viettel v2 inbound nếu doc Viettel không yêu cầu
  - Không thay đổi schema `einvoices`, `tax_portal_configs`, `sinvoice_configs` nếu precheck cho thấy đã đủ
  - Không mở thêm entrypoint UI mới ngoài các tab thuế hiện hữu

## Relevant Files
- `src/sinvoice/sinvoice.service.ts` - logic Tax Portal sync hiện có, local list, aggregate, upsert
- `src/sinvoice/sinvoice.controller.ts` - surface endpoint sync/config/list hiện có (cần verify DTO/controller validation gap)
- `src/viettel-v2/viettel-v2.service.ts` - tham chiếu chunking theo tháng nhưng không nằm trong scope enforce 15/30/50
- `liouni-erp-web/src/**` - sẽ cần locate đúng module/tab Tax Portal khi qua gate UI
- `docs/tasks/20260515-tax-portal-enforce-limits.md` - task cũ cùng chủ đề, chỉ dùng làm historical reference; không dùng làm source of truth vì trạng thái plan/evidence không nhất quán

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `einvoices`: `external_invoice_id`, `invoice_date`, `source`, `direction`, `request_payload`, `response_payload`, `synced_at`, `status`, `tax_status`
  - `tax_portal_configs`: singleton config chứa token/cookie/jwt hoặc dữ liệu cấu hình CQT
  - `sinvoice_configs`: singleton config SInvoice hiện hữu, không phải nguồn chính của Tax Portal nhưng cần biết để tránh lẫn credentials
- Data nền cần có:
  - singleton `tax_portal_configs` đọc được ở API
  - collection `einvoices` đang dùng được cho upsert và local list reload
- Constraint/index/default cần có:
  - ưu tiên có `external_invoice_id` để idempotent upsert
  - không cần migration mới nếu `request_payload`, `response_payload`, `synced_at` đã tồn tại và local list đang chạy
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): chưa cần; precheck hiện tại nghiêng về reuse schema hiện có
- Evidence Gate 0 read-only:
  - `src/sinvoice/sinvoice.service.ts` đã đọc/ghi `tax_portal_configs`
  - `src/sinvoice/sinvoice.service.ts` đang query aggregate/local list trên `einvoices`
  - `src/sinvoice/sinvoice.service.ts` đang upsert dựa trên `external_invoice_id`

## Coordination Impact
- [ ] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [ ] 2.0 Backend workflow/API gate done
  - [ ] 2.1 Verify tất cả endpoint Tax Portal đang nhận param gì (`pageSize`, `size`, `startDate`, `endDate`, `search`, `direction`)
  - [ ] 2.2 Khóa validation ở DTO/controller/service để pageSize chỉ nhận 15/30/50; fallback 15 nếu input sai
  - [ ] 2.3 Chuẩn hóa guard date-range: mỗi external request không vượt quá 1 tháng
  - [ ] 2.4 Chuẩn hóa auto-chunking theo tháng khi input > 1 tháng
  - [ ] 2.5 Giữ response sync dạng summary nhẹ (`ok`, `direction`, `count`, `synced_at`, vài `invoice_nos`), UI reload local list từ DB
  - [ ] 2.6 Chuẩn hóa idempotent upsert/override cho record trùng
  - [ ] 2.7 Thêm logging/debug evidence phù hợp cho request chunk và response status (mask secret)
- [ ] 3.0 UI handoff gate done
  - [ ] 3.1 Xác định đúng module/trang web đang gọi Tax Portal sync
  - [ ] 3.2 Ràng buộc dropdown pageSize chỉ 15/30/50
  - [ ] 3.3 Date picker cho phép chọn dài nhưng UX phải báo rõ sẽ auto chia theo tháng khi sync
  - [ ] 3.4 Tách state filter/pagination riêng cho tab IN và OUT nếu chưa tách
  - [ ] 3.5 Negative validation: không để UI gửi pageSize ngoài whitelist hoặc gửi range mù mà không có thông điệp UX phù hợp
- [ ] 4.0 Validate
  - [ ] 4.1 Build API
  - [ ] 4.2 Build Web (nếu có đổi UI)
  - [ ] 4.3 Smoke 1 chunk (<= 1 tháng)
  - [ ] 4.4 Smoke multi-chunk (> 1 tháng)
  - [ ] 4.5 Negative smoke pageSize sai -> fallback/validation đúng
  - [ ] 4.6 Verify duplicate invoice được upsert/override, không tạo trùng
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Deploy stack liên quan + smoke runtime
  - [ ] 5.4 Summary with evidence

## Working Plan
### DB
- Giữ `DB_READY` nếu các field/collection hiện có đã đủ cho idempotent sync và audit payload.
- Không đề xuất migration mới ở pass đầu.
- Nếu trong execute phát hiện thiếu unique/index ở `external_invoice_id`, đánh giá workaround upsert ở service trước khi quyết định DB task.

### API
- Inspect toàn bộ surface Tax Portal hiện hữu trong `sinvoice` module:
  - endpoint sync
  - config save/load
  - local list endpoint
- Chuẩn hóa 1 helper normalize params cho Tax Portal:
  - normalize `pageSize`/`size`
  - normalize `startDate`/`endDate`
  - validate/rewrite range thành monthly chunks
- Ràng buộc nghiệp vụ cần đạt:
  - input pageSize ngoài 15/30/50 => fallback 15 hoặc 400 theo quyết định contract thống nhất
  - input range > 1 tháng => không bắn 1 request dài; phải auto chunk
  - sync response không trả payload lớn gây browser timeout
  - upsert phải idempotent qua `external_invoice_id`
- Gate validation API:
  - route tồn tại
  - log có số chunk thực thi
  - DB local list reflect đủ count sau multi-chunk
  - duplicate re-sync không làm tăng count sai

### UI
- Xác định module web thật sự dùng Tax Portal hiện tại trước khi sửa.
- Nếu có selector pageSize, giới hạn options 15/30/50.
- Nếu user chọn date range dài > 1 tháng, UX không chặn cứng việc chọn; thay vào đó hiển thị note rằng hệ thống sẽ tự chia theo tháng khi fetch.
- Giữ pattern source-of-truth: sau sync xong, reload list từ DB nội bộ thay vì dựa vào full payload sync response.
- Negative gate validation:
  - tab IN không ghi đè filter tab OUT và ngược lại
  - không còn đường UI gửi pageSize ngoài whitelist

## Gate validations
- Gate DB:
  - Chứng minh schema hiện có đã đủ: `tax_portal_configs` singleton đọc được; `einvoices` đang support aggregate/list/upsert
- Gate API:
  - Có helper/rule enforcement tập trung thay vì validate rải rác
  - Multi-chunk path và single-chunk path cùng dùng chung upsert summary pattern
- Gate UI:
  - Filter inputs phản ánh rule nhưng không thay thế enforcement backend
  - Tabs IN/OUT giữ state độc lập
- Negative gates:
  - pageSize=20 không đi nguyên vẹn xuống external API
  - range 90 ngày không đi nguyên vẹn thành 1 external request
  - sync lại cùng khoảng ngày không tạo duplicate record mới

## Risks + Rollback
- Risk 1: đổi contract pageSize quá cứng làm UI cũ lỗi
  - Rollback: giữ fallback 15 ở backend, sau đó mới nâng dần validation UI
- Risk 2: chunking đúng logic nhưng summary response khác kỳ vọng frontend
  - Rollback: giữ shape response cũ tối thiểu tương thích, chỉ rút payload lớn
- Risk 3: duplicate detection dựa mỗi `external_invoice_id` không đủ cho vài record thiếu key
  - Rollback: dùng fallback composite key tạm thời ở service sau khi inspect dữ liệu thật
- Risk 4: state filter IN/OUT dùng chung ở web làm user tưởng sync sai dữ liệu
  - Rollback: tách state theo tab trước khi bật behavior mới

## Validation Evidence
- DB precheck result:
  - `DB_READY` (execute-phase re-verified)
  - `src/sinvoice/sinvoice.service.ts` đang đọc singleton `tax_portal_configs`, query/list/aggregate `einvoices`, và upsert theo `external_invoice_id`
  - `src/sinvoice/sinvoice.controller.ts` hiện chưa có DTO cho `tax-portal/sync` (`@Query() query: any`), xác nhận có execution gap ở API validation chứ không phải DB gap
- Build:
  - API: `npm run build` -> PASS
  - Web: `npm run build` -> PASS
- Smoke:
  - Local API: `GET http://127.0.0.1:10000/api/v1/sinvoice/tax-portal/sync?pageSize=17` -> `200`, response normalize `pageSize: 15`, `chunk_count: 2`
  - Public API: `GET https://dev.api.erp.liouni.com/api/v1/sinvoice/tax-portal/sync?pageSize=17` -> `200`, response normalize `pageSize: 15`, `chunk_count: 2`
  - Local Web: `GET http://127.0.0.1:8808/` -> `200`
  - Public Web: `GET https://dev.erp.liouni.com/` -> `200`

## Evidence cần thu thập khi execute
- API:
  - `pageSize=17` -> normalized xuống `15` ở cả local/public runtime
  - default range hiện tại được normalize thành khoảng 30 ngày gần nhất và được auto-chunk thành 2 request tháng khi vắt qua 2 tháng lịch
  - response summary nhẹ gồm `ok`, `direction`, `pageSize`, `requested_range`, `chunk_count`, `chunks[]`, `count`, `synced_at`
- DB:
  - không đổi schema; tiếp tục reuse đường upsert hiện hữu theo `external_invoice_id`
  - kiểm chứng gián tiếp qua sync response `fetched/upserted` và không phát sinh lỗi duplicate path trong smoke hiện tại
- UI:
  - page size selector giới hạn 15/30/50
  - có UX warning khi range > 1 tháng
  - reset filter trả về default range 30 ngày + pageSize 15
- Runtime:
  - API container `liouni-erp-api` Up sau recreate
  - Web container `liouni-erp-web` Up sau recreate
  - API startup logs đã map route `/api/v1/sinvoice/tax-portal/sync`
  - Web bundle mới được verify trong container assets

## Lessons Learned
- Link: No issue

## Commit/Push Status
- API repo: committed and pushed `fba1ee0` — `Enforce tax portal sync limits and chunking`
- Web repo: committed and pushed `ecbf25e` — `Align tax portal UI with chunked sync limits`
- DB/directus staging: read-only precheck; không đổi schema/data

## Execution status
- User đã approve thực thi
- Execute hoàn tất theo thứ tự DB -> API -> UI
- Deploy hoàn tất cho cả `liouni-erp-api` và `liouni-erp-web`
- Runtime smoke pass local và public
- FE bundle verify pass: container đang serve asset mới chứa marker `Khoảng ngày đang lớn hơn 1 tháng` và `Page size Tax Portal`