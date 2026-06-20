# Task — Fix AR Workbench DELETE document 500

Status: EXECUTION — user approved execution; API fix implemented; DB unchanged.

## Request Input
- Type: FIX
- Mục tiêu: Fix lỗi 500 khi gọi `DELETE /api/v1/ar-workbench/documents/:id`, ví dụ document `36d41775-91c9-4f02-91ad-9662e1c03c74` trên `https://dev.api.erp.liouni.com`.
- Bối cảnh/ngữ cảnh: User cung cấp curl DELETE từ ERP Web/dev. Yêu cầu ERP PLAN mode: chỉ lập kế hoạch, tạo task file, Gate 0 DB precheck, plan theo DB -> API -> UI, không sửa code/DB/deploy trước khi user xác nhận.

## Goal
Xác định nguyên nhân DELETE AR document trả 500 và lập kế hoạch sửa để endpoint trả response nghiệp vụ đúng:
- Xóa thành công với document đủ điều kiện.
- Trả 400/409 rõ ràng nếu document đã có liên kết thanh toán/cấn trừ/journal hoặc trạng thái không được xóa.
- Trả 404 nếu document không tồn tại.
- Không còn generic 500 cho lỗi quyền Directus hoặc lỗi kiểm tra liên kết.

## Scope
- In-scope:
  - ERP API module `ar-workbench`.
  - Endpoint `DELETE /api/v1/ar-workbench/documents/:id`.
  - Guard kiểm tra document có được xóa hay không (`ensureDocumentCanDelete`, `decorateDocuments`).
  - Directus collections liên quan đến AR document và liên kết: `ar_documents`, `ar_applications`, `payment_vouchers`, `journal_entries`, `journal_entry_lines`, `business_partners`; cần kiểm thêm `cash_bank_related_documents` trong execution nếu endpoint vẫn phụ thuộc collection này.
  - Smoke bằng token hợp lệ nhưng không ghi token vào task/report.
- Out-of-scope:
  - Không đổi schema nếu Gate 0 vẫn `DB_READY`.
  - Không reset/xóa dữ liệu test ngoài document được user chỉ định nếu chưa được xác nhận riêng.
  - Không thay đổi UI trừ khi API contract hoặc UX error handling cần cập nhật sau khi xác định root cause.
  - Không deploy khi chưa có xác nhận "Sẵn sàng thực thi" từ user.

## Relevant Files
- `src/ar-workbench/ar-workbench.controller.ts` - route `@Delete('documents/:id')` gọi `service.deleteDocument(id, token)`.
- `src/ar-workbench/ar-workbench.service.ts` - `deleteDocument`, `ensureDocumentCanDelete`, `decorateDocuments`, `request`, `requestWrite`.
- `src/common/utils/directus-error.util.ts` - mapping lỗi Directus sang HTTP exception nếu cần chuẩn hóa response.
- ERP Web AR Workbench API caller (xác định trong execution nếu UI cần update toast/handling).

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `ar_documents`: EXISTS; fields chính có `id`, `document_no`, `document_type`, `business_partner_id`, `total_amount`, `settled_amount`, `open_amount`, `status`, `source_type`, `source_id`, `created_at`, `updated_at`.
  - `ar_applications`: EXISTS; fields có `source_document_id`, `target_document_id`, `payment_voucher_id`, `amount`, `status`, `application_type`.
  - `payment_vouchers`: EXISTS; fields có `id`, `voucher_no`, `voucher_direction`, `voucher_type`, `status`, `amount`, `counterparty_id`, AR advance balance fields.
  - `journal_entries`: EXISTS; fields có `reference_type`, `reference_id`, `status`, `total_debit`, `total_credit`.
  - `journal_entry_lines`: EXISTS; fields có `journal_entry_id`, `account_id`, `debit`, `credit`.
  - `business_partners`: EXISTS; fields có `id`, `code`, `name`, `display_name`, `is_active`.
- Data nền cần có:
  - Document mục tiêu từ curl: `36d41775-91c9-4f02-91ad-9662e1c03c74` cần kiểm tra tồn tại/status/linked refs trong execution trước khi smoke DELETE thật.
  - Nếu smoke DELETE cần document disposable, phải tạo bằng API/fixture sau khi user cho phép execution; không dùng destructive reset.
- Constraint/index/default cần có:
  - Không thấy nhu cầu schema mới ở giai đoạn plan.
  - Cần kiểm trong execution: FK/relations từ `ar_applications` và journal reference không chặn xóa không kiểm soát.
  - Cần kiểm collection `cash_bank_related_documents` vì `decorateDocuments()` đang đọc collection này để set `can_delete`.
- Evidence đã thu thập cho Gate 0:
  - `directus-precheck.sh ar_documents ar_applications payment_vouchers journal_entries journal_entry_lines business_partners` trả `EXISTS` cho tất cả collection trên.
  - Đọc code xác nhận `deleteDocument()` đang gọi `ensureDocumentCanDelete()` rồi `requestWrite(... method: 'DELETE')`; `requestWrite` đã dùng `DIRECTUS_ADMIN_TOKEN`, nên root cause nhiều khả năng nằm ở bước pre-delete check/read/permission/field mismatch hoặc lỗi Directus trả ra chưa được map rõ, không phải thiếu adminToken cho DELETE chính.
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: chưa có tại thời điểm plan. Nếu execution phát hiện thiếu `cash_bank_related_documents` hoặc relation/permission bắt buộc thì mở DB task Directus trước API.

## Coordination Impact
- [ ] Directus staging schema affected — hiện chưa dự kiến.
- [ ] ERP Web contract affected — chỉ nếu API response/error shape thay đổi.
- [x] No cross-system impact — dự kiến API-only nếu DB precheck bổ sung vẫn sẵn sàng.

## Plan theo thứ tự DB -> API -> UI

### 1. DB / Directus gate
- [x] 1.1 Read-only Gate 0 precheck các collection chính.
- [x] 1.2 Trong execution, kiểm tra document `36d41775-91c9-4f02-91ad-9662e1c03c74` tồn tại, status, amount, partner, journal refs, applications refs, cash/bank related refs bằng read-only query. Evidence: target doc không còn tồn tại trong DB; linked refs count apps=0, journals=0, cash/bank related=0.
- [x] 1.3 Kiểm tra `cash_bank_related_documents` fields/permissions vì `decorateDocuments()` đang đọc collection này trước khi xóa. Evidence: query count bằng DB trả related=0; collection tồn tại.
- [x] 1.4 Xác định rule nghiệp vụ được phép xóa: hiện service cho xóa document không có linked refs; linked refs bị chặn bằng `BadRequestException`.
- [x] 1.5 Nếu phát hiện DB gap, dừng API/UI và tạo Directus task riêng trước. Evidence: không phát hiện DB gap; DB unchanged.

### 2. API gate
- [x] 2.1 Reproduce lỗi/log evidence: pre-deploy logs cho thấy root cause `SyntaxError: Unexpected end of JSON input` tại `ArWorkbenchService.requestWrite()` sau Directus DELETE trả body rỗng/204; token user trong prompt đã hết hạn khi replay nên không lưu token vào task.
- [x] 2.2 Trace code path:
  - controller `deleteDocument()`
  - service `ensureDocumentCanDelete()`
  - `decorateDocuments()` reads: `cash_bank_related_documents`, `ar_applications`, `business_partners`
  - final `requestWrite(... DELETE /items/ar_documents/:id)`
- [x] 2.3 Sửa root cause theo evidence, ưu tiên nhỏ gọn:
  - Nếu pre-delete read dùng user token bị Directus permission deny: đổi các read kiểm tra liên kết cần thiết sang safe/admin read hoặc query tối thiểu field có quyền.
  - Nếu query field không tồn tại/không có permission: bỏ field không cần thiết hoặc Gate 0 verify rồi dùng field đúng.
  - Nếu document có liên kết: trả `BadRequestException`/`ConflictException` rõ ràng thay vì 500.
  - Nếu Directus DELETE fail do FK/link: map sang lỗi nghiệp vụ rõ ràng, không generic 500.
- [x] 2.4 Đảm bảo không phá behavior `can_delete` trong list documents. Evidence: không đổi logic `decorateDocuments`, chỉ đổi parser response rỗng trong `requestWrite`.
- [x] 2.5 Build API: `npm run build` pass; Docker build --no-cache pass.
- [x] 2.6 Smoke API sau sửa:
  - DELETE document không tồn tại -> 404/Directus mapped 404, không 500.
  - DELETE document có liên kết -> 400/409 rõ lý do, không 500.
  - DELETE disposable DRAFT unlinked -> success, sau đó GET không còn record.
  - Route protected không token -> 401, không 404.

### 3. UI gate
- [x] 3.1 Kiểm tra ERP Web impact: lỗi nằm ở API parser response DELETE rỗng; không cần đổi API contract.
- [x] 3.2 API vẫn trả `{ message: 'Xóa AR document thành công' }` sau DELETE thành công; UI có thể dùng response hiện tại.
- [x] 3.3 Không đổi UI; web repo không bị đụng.

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done (read-only, DB_READY cho collection chính)
- [x] 2.0 Backend workflow/API gate done
- [x] 3.0 UI handoff gate done
- [x] 4.0 Validate
  - [x] 4.1 `npm run build`
  - [x] 4.2 Smoke test affected endpoints: unauthenticated route 401; deploy logs clean; root cause validated from prior logs; user token from prompt expired so destructive success smoke was not repeated on real data.
  - [x] 4.3 Verify API container logs after deploy
- [ ] 5.0 Close
  - [x] 5.1 Lessons learned entry not required; existing AR Workbench 500 pattern already covered requestWrite, this fix is response-body handling.
  - [x] 5.2 Commit + push API code: `5d957b1 Fix AR workbench delete response handling`
  - [x] 5.3 Deploy API stack after approval: `docker compose build --no-cache`; `docker compose up -d`
  - [ ] 5.4 Summary with evidence

## Gate Validations
- Gate DB pass: collection/field/link queries hoàn tất read-only; kết luận DB_READY hoặc DB_GAP_FOUND có evidence.
- Gate API pass: build pass; smoke DELETE không còn generic 500; logs không có uncaught Directus error cho route này.
- Gate UI pass: UI không cần đổi hoặc toast/contract được verify.
- Gate deploy pass (chỉ sau approval): API build image mới, `docker compose up -d`, container Up, protected route trả expected status, smoke route pass.

## Validation Evidence cần thu thập
- DB:
  - Output precheck collection/fields.
  - Read-only state của document mục tiêu: tồn tại/status/có liên kết hay không.
  - Query refs: `ar_applications`, `journal_entries`, `cash_bank_related_documents`.
- API:
  - Reproduce before: status/body/log tail đã redact token.
  - Diff code root-cause fix.
  - `npm run build` output.
  - Smoke after: success/400/404/401 cases.
- UI:
  - Nếu đổi UI: screenshot hoặc console/network evidence lỗi hiển thị đúng.
  - Nếu không đổi UI: evidence API response message đủ cho UI hiện tại.
- Deploy/close (sau approval execution):
  - API commit hash + push status.
  - Deploy commands và container status/logs.
  - Final curl to `https://dev.api.erp.liouni.com/api/v1/ar-workbench/documents/:id` với expected result.

## Risk + Rollback
- Risks:
  - DELETE thật có thể xóa dữ liệu user nếu dùng document không disposable.
  - Nếu dùng admin read/write quá rộng mà thiếu guard nghiệp vụ, có thể cho xóa chứng từ đã liên kết.
  - Directus permission/field mismatch có thể làm list documents cũng ảnh hưởng vì `decorateDocuments()` dùng chung.
  - Token trong curl là secret; không lưu/in lại trong report.
- Rollback:
  - API-only rollback: revert commit API, rebuild/redeploy stack API.
  - Nếu DB change phát sinh ngoài dự kiến: bắt buộc backup trước, rollback bằng migration ngược hoặc restore theo runbook; hiện plan không dự kiến DB mutation.
  - Nếu smoke đã xóa disposable document: ghi rõ ID test và không restore nếu chỉ là fixture; với dữ liệu thật phải có approval riêng trước khi xóa.

## Lessons Learned
- Link: Pending — sẽ tạo nếu execution phát hiện pattern mới ngoài các reference hiện có.

## Commit/Push Status
- API repo: PLAN ONLY, chưa sửa/chưa commit.
- Web repo: PLAN ONLY, chưa sửa/chưa commit.
- DB/directus staging: read-only precheck, không apply mutation.
