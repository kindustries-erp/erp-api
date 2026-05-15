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
- [ ] 1.0 Gate 0 DB Precheck done
- [ ] 2.0 Backend workflow/API gate done
  - [ ] 2.1 Đổi `createInvoice` sang draft-only payload/response
  - [ ] 2.2 Persist `einvoices.status=DRAFT` và phản hồi an toàn cho UI
  - [ ] 2.3 Chặn/ẩn surface cancel/phát hành/demo flow không còn hợp lệ
- [ ] 3.0 UI handoff gate done
  - [ ] 3.1 Shared modal UX được chốt cho Quản lý Thuế + Công nợ
  - [ ] 3.2 Tab `Xuất hóa đơn` có CTA tạo nháp và hướng dẫn test
  - [ ] 3.3 Entry point từ Công nợ prefill dữ liệu, không duplicate form
- [ ] 4.0 Validate
  - [ ] 4.1 `npm run build`
  - [ ] 4.2 `npx tsc --noEmit`
  - [ ] 4.3 Smoke test tạo hóa đơn nháp + kiểm tra list hiển thị Draft
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry
  - [ ] 5.2 Commit + push code
  - [ ] 5.3 Summary with evidence

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
- [ ] Task web và task API đều tick đầy đủ theo gate.
- [ ] API create trả trạng thái draft-only, không còn wording phát hành.
- [ ] UI tab Xuất hóa đơn có form/modal draft thực tế.
- [ ] Entry point tại Công nợ mở cùng shared modal với prefill.
- [ ] Hóa đơn mới xuất hiện trong list với trạng thái `Bản nháp`.
- [ ] Không còn CTA demo flow / phát hành / ký số ở surface user dùng để test.

## Validation Evidence
- DB precheck result:
- `npm run build`:
- `npx tsc --noEmit`:
- Smoke test:

## Lessons Learned
- Chưa có issue (sẽ cập nhật nếu phát sinh trong lúc execute).

## Commit/Push Status
- API repo:
- Web repo:
- DB/directus staging: không đổi schema, chỉ verify DB_READY.
