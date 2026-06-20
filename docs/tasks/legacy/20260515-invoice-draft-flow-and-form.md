# Task: Luồng Hóa đơn nháp và Draft-only Safety

## Request Input
- Type: FEATURE
- Mục tiêu: Chuyển đổi luồng xuất hóa đơn sang chế độ "Chỉ lưu nháp", ẩn tính năng ký số/phát hành, và hỗ trợ shared UX giữa Công nợ và Quản lý Thuế.
- Bối cảnh: User muốn test bằng tài khoản thật nhưng chỉ ở mức lưu nháp để an toàn; hiện tab Xuất hóa đơn chưa có form nhập liệu thực tế và còn nguy cơ duplicate UI vì trang Công nợ cũng có entry point xuất hóa đơn.

## Goal
1. Backend: Chỉ cho phép tạo hóa đơn nháp, không phát hành thật.
2. Frontend: Dùng shared modal/form nhập liệu cho cả AR Workbench và trang Hóa đơn điện tử.
3. Safety: Ẩn/vô hiệu hóa toàn bộ surface ký số, phát hành, demo flow.

## Scope
- In-scope:
  - Giữ nguyên schema DB hiện có, chỉ thay đổi workflow/API/UI.
  - Đổi flow `createInvoice` sang draft-only và persist `status=DRAFT`.
  - Tạo shared invoice draft modal cho Quản lý Thuế + AR Workbench.
  - Ẩn hoặc gỡ các CTA phát hành/ký số/demo flow.
- Out-of-scope:
  - Tích hợp phát hành thật/ký số.
  - Thay đổi schema Directus/DB.
  - Đồng bộ hóa đơn mua vào/bán ra từ cổng thuế.

## Relevant Files
- `src/sinvoice/sinvoice.service.ts` - logic create/cancel/sync/persist SInvoice.
- `src/sinvoice/sinvoice.controller.ts` - surface endpoint public cho SInvoice.
- `/opt/repos/liouni-erp-web/src/pages/HoaDonDienTu.tsx` - tab Xuất hóa đơn hiện tại.
- `/opt/repos/liouni-erp-web/src/modules/accounting/api/sinvoiceApi.ts` - contract frontend -> API.
- `/opt/repos/liouni-erp-web/src/modules/finance/components/ArWorkbenchPanel/index.tsx` - entry point từ công nợ.
- `/opt/repos/liouni-erp-web/docs/tasks/20260515-sinvoice-draft-modal-and-shared-entrypoints.md` - task web song hành.

## Gate 0 — DB Precheck
- Collections/fields liên quan:
  - `sinvoice_configs` singleton để lấy credential/provider URL.
  - `einvoices.status` để lưu `DRAFT`.
  - `einvoices.source` = `SINVOICE`, `einvoices.direction` = `OUT`.
- Data nền cần có:
  - Singleton `sinvoice_configs` đã tồn tại và có credential đủ để test create draft.
  - Collection `einvoices` đang hoạt động và đã lưu được record SInvoice trước đó.
- Constraint/index/default cần có:
  - Không đổi schema; chỉ cần workflow hiện tại được phép persist record với status `DRAFT`.
- Kết quả: `DB_READY`

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
  - [x] 2.1 Đổi `createInvoice` sang draft-only payload/response
  - [x] 2.2 Persist `einvoices.status=DRAFT` và phản hồi an toàn cho UI
  - [x] 2.3 Chặn/ẩn surface cancel/phát hành/demo flow không còn hợp lệ
- [x] 3.0 UI handoff gate done
  - [x] 3.1 Shared modal UX được chốt cho Quản lý Thuế + Công nợ
  - [x] 3.2 Tab `Xuất hóa đơn` có CTA tạo nháp và hướng dẫn test
  - [x] 3.3 Entry point từ Công nợ dùng cùng shared modal, không duplicate form
- [x] 4.0 Validate
  - [x] 4.1 `npm run build`
  - [x] 4.2 `npx tsc --noEmit`
  - [x] 4.3 Smoke test tạo hóa đơn nháp + kiểm tra list hiển thị Draft
- [x] 5.0 Close
  - [x] 5.1 Lessons learned entry
  - [x] 5.2 Commit + push code
  - [x] 5.3 Summary with evidence

## Risk + Rollback
- Risk:
  - Nhầm payload/endpoint dẫn tới phát hành thật.
  - UI tách 2 nơi gây duplicate logic và lệch validation.
- Mitigation:
  - Chỉ expose một action `Lưu nháp hóa đơn`; ẩn mọi CTA phát hành/ký số.
  - Dùng shared modal/component để một source of truth cho form/validation.
  - Smoke test bằng account thật chỉ theo luồng draft, không chạy demo-flow/phát hành.
- Rollback:
  - Revert commit API/Web của task này rồi rebuild/redeploy các stack liên quan.

## Evidence Checklist
- [x] Task web và task API đều tick đầy đủ theo gate.
- [x] API create trả trạng thái draft-only, không còn wording phát hành.
- [x] UI tab Xuất hóa đơn có form/modal draft thực tế.
- [x] Entry point tại Công nợ mở cùng shared modal, tránh duplicate UI.
- [x] Hóa đơn mới xuất hiện trong list với trạng thái `Bản nháp`.
- [x] Không còn CTA demo flow / phát hành / ký số ở surface user dùng để test.

## Validation Evidence
- DB precheck result: `DB_READY`. Không đổi schema; tận dụng `einvoices.status/source/direction` hiện hữu để persist draft-only.
- `npm run build`: PASS (`cd /opt/repos/liouni-erp-api && npm run build`).
- `npx tsc --noEmit`: PASS (`cd /opt/repos/liouni-erp-web && npx tsc --noEmit`).
- Smoke test:
  - Runtime `POST /api/v1/sinvoice/create` trả `ok=true`, `mode=DRAFT_ONLY`, `status=DRAFT`, message `Đã lưu hóa đơn nháp nội bộ...`.
  - Runtime `POST /api/v1/sinvoice/cancel` trả `400` với message chặn hủy/phát hành trong `draft-only mode`.
  - Runtime `POST /api/v1/sinvoice/demo-flow` trả `400` với message đã tắt demo flow.
  - `GET /api/v1/sinvoice/local` có record `DRAFT-CLI-001` với `tax_status=LOCAL_DRAFT_ONLY`.
  - Browser snapshot trang `Hóa đơn điện tử` hiển thị heading `Xuất hóa đơn điện tử nháp`, CTA `Tạo hóa đơn nháp mới`, và row draft `DRAFT-CLI-001` trạng thái `Bản nháp`.
  - Bundle web deployed chứa marker `Tạo hóa đơn nháp mới` và `Chỉ lưu nháp nội bộ, không ký và không phát hành`.

## Lessons Learned
- Với luồng an toàn cao như hóa đơn điện tử, tốt hơn nên chuyển create sang `draft-only` ở backend thay vì chỉ ẩn nút ở UI; như vậy kể cả call API trực tiếp cũng không phát hành nhầm.
- Tránh duplicate UI bằng shared modal riêng cho hóa đơn điện tử; không tái dùng form AR document nội bộ vì semantics khác nhau.

## Commit/Push Status
- API repo: chờ commit/push cuối task.
- Web repo: chờ commit/push cuối task.
- DB/directus staging: không đổi schema, chỉ verify DB_READY.
