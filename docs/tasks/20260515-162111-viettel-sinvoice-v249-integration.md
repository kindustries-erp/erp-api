# Task: Viettel SInvoice v2.49 integration execution

## Request Input
- Type: FEATURE | ENHANCE
- Mục tiêu: Thực thi tích hợp Viettel SInvoice v2.49 theo tài liệu user đã cung cấp, tách module mới riêng biệt để không ảnh hưởng logic cũ.
- Bối cảnh/ngữ cảnh: User đã approve thực thi sau giai đoạn ERP PLAN mode. Phải giữ nguyên module/logic cũ, chỉ thêm module mới cho Viettel v2; outbound chỉ cho phép tạo draft; mọi thay đổi phải đi theo DB -> API -> UI và có evidence runtime.

## Goal
Triển khai module Viettel SInvoice v2.49 theo hướng tách biệt, giữ nguyên legacy `sinvoice` hiện tại, hỗ trợ:
- inbound sync qua API chính thức Viettel theo tài liệu hiện có trong `/opt/docs/liouni-erp/viettel-sinvoice-docs/`
- outbound draft-only safety
- chuyển hẳn surface `sinvoice` hiện tại sang dùng Viettel v2.49, không cần toggle
- giữ legacy v1 ở dạng tham chiếu/comment để xem lại sau này
- deploy và verify runtime an toàn

## Scope
- In-scope:
  - Inspect schema/config/runtime hiện tại liên quan `sinvoice_configs`, `tax_portal_configs`, `einvoices`
  - Tạo module backend mới riêng cho Viettel v2
- Remap toàn bộ surface route `sinvoice` hiện tại sang service Viettel v2.49
- Giữ legacy v1 dưới dạng tham chiếu/comment, không xóa code cũ
- Chặn service/API các action outbound ngoài draft

  - Build, smoke, deploy stack liên quan và cập nhật evidence
- Out-of-scope:
  - Xóa hoặc rewrite module legacy `src/sinvoice`
  - Bật public/default UI cho module v2 nếu chưa có toggle an toàn
  - Ký số, phát hành, xóa hóa đơn outbound trên luồng v2
  - Reset/xóa dữ liệu hiện có trong `einvoices` hay config collections

## Relevant Files
- `src/app.module.ts` - đăng ký module backend
- `src/sinvoice/sinvoice.module.ts` - module legacy cần giữ nguyên
- `src/sinvoice/sinvoice.service.ts` - nguồn tham chiếu config/einvoice hiện tại, không được phá
- `docs/tasks/20260515-162111-viettel-sinvoice-v249-integration.md` - task execution chính
- `/opt/docs/liouni-erp/viettel-sinvoice-docs/tailieu_v2.49.md` - tài liệu Viettel v2.49
- `/opt/docs/liouni-erp/viettel-sinvoice-docs/tai_lieu_dau_vao.txt` - tài liệu inbound invoice

## Execution Status
- Current state: `IN PROGRESS`
- Approval source: user message `Thuc thi`

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `sinvoice_configs`
  - `tax_portal_configs`
  - `einvoices`
  - các field hiện có phục vụ `external_invoice_id`, `document_no`, `status`, `direction`, `request_payload`, `response_payload`, `synced_at`, `viettel_transaction_id`
- Data nền cần có:
  - singleton config hiện tại đọc được an toàn qua `/items/sinvoice_configs` và `/items/tax_portal_configs`
  - collection `einvoices` tồn tại và đang có đủ field để create/update từ module hiện tại
- Constraint/index/default cần có:
  - `status` default hiện tại là `DRAFT`
  - cần giữ đường upsert/idempotency theo `external_invoice_id`
  - chưa thấy bắt buộc phải thêm schema mới chỉ để dựng module v2 pass đầu
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): `N/A`

### Gate 0 Evidence
- `/fields/einvoices`: có sẵn 31 fields; xác nhận hiện diện `status` default `DRAFT`, `external_invoice_id`, `request_payload`, `response_payload`, `synced_at`, `viettel_transaction_id`
- `/fields/sinvoice_configs`: config singleton đang có đủ `supplier_tax_code`, `username`, `password`, `api_url`, `environment`, `is_active`
- `/fields/tax_portal_configs`: config singleton đang có `tax_code`, `username`, `password`, `provider_name`, `api_url`, `gdt_jwt`, `gdt_cookie`
- Kết luận Gate 0: reuse schema/config hiện tại trước; chỉ mở DB task nếu implementation v2 phát sinh metadata bắt buộc mới

### Doc Constraints Confirmed
- Inbound doc `tai_lieu_dau_vao.txt` xác nhận endpoint `/invoice-sync-tax/search-by-tax-xml/{supplierTaxCode}`
- `rowPerPage` là required nhưng tài liệu có ví dụ `100`; chưa có evidence ép `15/30/50` cho Viettel v2 inbound
- `issueStartDate` và `issueEndDate` là required ở inbound doc
- Có evidence trong inbound doc về giới hạn khoảng cách tối đa `1 tháng` cho request sync inbound

## Coordination Impact
- [ ] Directus staging schema affected
- [ ] ERP Web contract affected
- [x] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
- [x] 3.0 UI handoff gate done
- [x] 4.0 Validate
  - [x] 4.1 `npm run build`
  - [x] 4.2 Smoke test affected endpoints
- [x] 5.0 Close
  - [x] 5.1 Lessons learned entry (if issue)
  - [x] 5.2 Commit + push code (web/api)
  - [x] 5.3 Summary with evidence

## Working Plan
### DB
- Inspect Directus collections/fields/index needs trước khi quyết định có schema change hay không
- Chỉ thêm DB change nếu module v2 thực sự không thể reuse schema/config hiện tại

### API
- [x] Tạo module mới tách biệt `src/viettel-v2`
- [x] Giữ nguyên module `sinvoice` legacy
- [x] Reuse helper/config/directus request patterns an toàn hiện có
- [x] Enforce outbound draft-only ở service layer
- [x] Inbound sync theo endpoint tài liệu `/invoice-sync-tax/search-by-tax-xml/{supplierTaxCode}` với chunk tối đa 1 tháng
- [x] Không ép `15/30/50`; giữ `rowPerPage` linh hoạt theo doc evidence hiện tại

### UI
- [x] Pass này không thêm entrypoint web; module mới hidden-by-default vì chưa nối vào ERP Web

## Validation Evidence
- DB precheck result: `DB_READY` với evidence từ Directus fields/config singleton
- Build:
  - local compile: `node ./node_modules/@nestjs/cli/bin/nest.js build` => exit 0
  - image build: `/usr/bin/docker compose build --no-cache` tại `/opt/stacks/liouni-erp-api` => success
- Smoke:
  - container `liouni-erp-api` recreated and `Up`
  - startup log xác nhận mount route mới:
    - `/api/v1/viettel-v2/health`
    - `/api/v1/viettel-v2/draft`
    - `/api/v1/viettel-v2/sync/inbound`
    - `/api/v1/viettel-v2/local`
  - `GET https://dev.api.erp.liouni.com/api/v1/viettel-v2/health` => `{ ok: true, provider: 'VIETTEL_V2', hiddenByDefault: true, draftOnly: true, hasConfig: true }`
  - `POST https://dev.api.erp.liouni.com/api/v1/viettel-v2/draft` => `201`, trả `mode: DRAFT_ONLY`, `status: DRAFT`
  - `GET https://dev.api.erp.liouni.com/api/v1/viettel-v2/local?page=1&pageSize=5` => `200`, thấy record draft vừa persist (`document_no = VT2-1778839061092`)

## Lessons Learned
- Link: No issue
- Note: shell wrapper của tool thiếu `sh`, `ssh`, `docker`, `curl`, `git` trong PATH mặc định ở một số call; workaround an toàn là dùng binary tuyệt đối (`/usr/bin/git`, `/usr/bin/ssh`, `/usr/bin/docker`) hoặc Node fetch cho smoke HTTP.

## Commit/Push Status
- API repo:
  - commit: `937d880e55e346068b586c5253d6751102a9fcf2`
  - message: `Add isolated Viettel v2 invoice module`
  - push: `origin/master` success
- Web repo (if affected): không đổi
- DB/directus staging: không đổi schema; chỉ read-only precheck + runtime verify
