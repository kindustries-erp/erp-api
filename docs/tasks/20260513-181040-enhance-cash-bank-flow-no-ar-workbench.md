# ERP Task — Enhance Cash/Bank flow (không tạo ở AR Workbench)

## Request Input (bạn chỉ cần điền phần này)
- Type: ENHANCE
- Mục tiêu:
  1) Luồng nghiệp vụ bank/cash: chỉ tạo tại cash và bank transfer, không tạo tại AR Workbench.
  2) Form tạo/cập nhật cash/bank có tag/card gợi ý (ví dụ: "Đặt cọc", "Thu tiền khách hàng", "Thanh toán"...) để auto-fill tài khoản hạch toán.
  3) Cash/bank có field quan hệ 1-N để gom toàn bộ chứng từ liên quan (voucher, invoice...).
- Bối cảnh/ngữ cảnh: Chuẩn hoá luồng nhập liệu tiền mặt/tiền gửi, giảm thao tác tay account mapping, tăng khả năng truy vết chứng từ liên quan.

## Goal
Định nghĩa kế hoạch triển khai DB-first cho enhancement cash/bank theo đúng guardrails ERP PLAN mode; đảm bảo không phát sinh tạo chứng từ từ AR Workbench và không phá vỡ flow AR hiện có.

## Scope
- In-scope:
  - Gate DB: bổ sung cấu trúc dữ liệu cần thiết cho tag/account mapping và quan hệ chứng từ liên quan 1-N cho cash/bank.
  - Gate API: expose contract tạo/cập nhật cash/bank dùng tag preset + account autofill + related documents.
  - Gate UI: cập nhật form cash/bank để chọn tag/card và hiển thị/ghi quan hệ chứng từ.
  - Chặn/ẩn đường tạo mới tại AR Workbench nếu đang đi sai luồng nghiệp vụ cash/bank.
- Out-of-scope:
  - Không thay đổi nghiệp vụ công nợ cốt lõi AR document posting/reconciliation.
  - Không migrate dữ liệu lịch sử ngoài phạm vi cần thiết cho tương thích schema mới.
  - Không deploy/chạy migration trong PLAN mode.

## Relevant Files
- API
  - `src/cash-funds/cash-funds.service.ts` - logic tạo/cập nhật chứng từ tiền mặt/tiền gửi.
  - `src/payment-vouchers/payment-vouchers.service.ts` - nguồn chứng từ liên quan và account posting.
  - `src/ar-workbench/ar-workbench.controller.ts` - điểm chặn/điều hướng không cho tạo cash/bank tại AR Workbench.
  - `src/ar-workbench/ar-workbench.service.ts` - rà ảnh hưởng write path AR.
- Web
  - `src/pages/TienMat.tsx` - shell trang tiền mặt.
  - `src/pages/TienGui.tsx` - shell trang tiền gửi.
  - `src/modules/finance/components/CashVoucherDrawer/index.tsx` - form cash voucher.
  - `src/modules/finance/components/TienGui/BankVoucherDrawer.tsx` - form bank voucher.
  - `src/modules/finance/components/ArWorkbenchPanel/index.tsx` - vị trí cần giới hạn create action theo yêu cầu.
  - `src/modules/finance/api/financeApi.ts` - contract FE<->API cho fields mới.

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `payment_vouchers` (EXISTS)
  - `chart_of_accounts` (EXISTS)
  - `ar_documents` (EXISTS)
  - `cash_transactions` (NOT_FOUND)
  - `bank_transactions` (NOT_FOUND)
- Data nền cần có:
  - Danh mục tài khoản kế toán hoạt động để map tag -> account (`chart_of_accounts`).
  - Dữ liệu chứng từ nguồn (payment vouchers, ar_documents) để validate quan hệ related-documents.
- Constraint/index/default cần có (dự kiến thiết kế):
  - Bảng/collection preset mapping tag-account (hoặc enum+mapping table) với unique key theo `tag_code`.
  - Quan hệ 1-N giữa chứng từ cash/bank và danh sách chứng từ liên quan (junction table ưu tiên hơn mảng JSON để query/reporting).
  - Index cho lookup `voucher_id`, `reference_type/reference_id`, `tag_code`.
- Kết quả: `DB_GAP_FOUND`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging):
  - `ops/tasks/<to-create>-cash-bank-tag-and-related-doc-schema.md` (sẽ tạo ở bước execution sau khi user xác nhận)

## Coordination Impact
- [x] Directus staging schema affected
- [x] ERP Web contract affected
## ACT progress
- [x] DB schema applied: `cash_bank_tag_presets`, `cash_bank_related_documents`, `payment_vouchers.cash_bank_tag_preset_id`; Directus health OK.
- [x] API implemented: preset lookup endpoint, DTO fields, preset account resolution, related docs sync/load.
- [x] API build pass: `npm run build` in `/opt/repos/liouni-erp/liouni-erp-api`.
- [x] UI implemented: Cash/Bank preset cards + related document editor.
- [x] UI build pass: `npm run build` in `/opt/repos/liouni-erp/liouni-erp-web`.
- [ ] Deploy + smoke verify after commits.

## Sẵn sàng thực thi

User đã xác nhận `thuc thi`; ACT mode đang triển khai.

### 1) DB Gate (ưu tiên đầu tiên)
- Thiết kế schema cho tag/account mapping:
  - Option A (khuyến nghị): collection `cash_bank_tag_presets` (code, label, debit_account_id, credit_account_id, direction, active).
  - Option B: hardcode enum ở code (không khuyến nghị vì khó vận hành).
- Thiết kế schema quan hệ chứng từ liên quan 1-N:
  - Tạo collection junction kiểu `cash_bank_related_documents` với FK tới voucher cash/bank + `related_type` + `related_id` + metadata.
- Xác nhận permission Directus + field aliases cần thiết cho API query.
- Chuẩn bị migration/script + verify query (chỉ soạn plan, chưa chạy trong PLAN mode).

Gate validation DB:
- Verify tồn tại collections/fields qua Directus `/fields/*`.
- Verify indexes/constraints bằng SQL inspect.
- Verify không phá dữ liệu cũ và có strategy default/fallback.

### 2) API Gate
- Cập nhật DTO create/update cash/bank:
  - nhận `tag_code` (hoặc preset id),
  - nhận `related_documents[]`.
- Bổ sung service mapping:
  - resolve tag preset -> auto-fill accounting account (debit/credit theo direction).
  - fallback manual account khi preset không áp dụng (quy tắc rõ ràng, validate chặt).
- Ràng buộc nghiệp vụ:
  - cash/bank flow không được tạo qua AR Workbench endpoint.
  - AR Workbench chỉ tham chiếu/chọn chứng từ, không phát sinh create mới cho flow này.
- Expose API lookup presets + related documents retrieval.

Gate validation API:
- `npm run build` pass.
- Smoke endpoint create/update cash + bank với preset và related docs.
- Negative smoke: create qua AR Workbench path bị chặn đúng thông báo.

### 3) UI Gate
- Cash/Bank drawer form:
  - thêm tag/card preset (UI quick-pick) như "Đặt cọc", "Thu tiền khách hàng", "Thanh toán".
  - khi click preset => auto-fill account fields ngay.
  - thêm section chọn nhiều chứng từ liên quan (1-N).
- AR Workbench:
  - gỡ/ẩn action tạo cash-bank trái yêu cầu; giữ action điều hướng sang đúng màn hình cash/bank.
- Giữ consistency component theo chuẩn hiện tại (Combobox/DatePicker/Checkbox mandate nếu có).

Gate validation UI:
- `npx tsc --noEmit` pass.
- Smoke: tạo mới cash/bank bằng preset -> account tự điền.
- Smoke: update cash/bank giữ được related docs.
- Smoke: AR Workbench không còn create path sai phạm vi.

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [ ] 2.0 Backend workflow/API gate done
- [ ] 3.0 UI handoff gate done
- [ ] 4.0 Validate
  - [ ] 4.1 `npm run build`
  - [ ] 4.2 Smoke test affected endpoints
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Summary with evidence

## Risk + Rollback
- Risk 1: Mapping preset sai tài khoản gây bút toán sai.
  - Mitigation: whitelist preset + account active; validate direction/debit-credit.
  - Rollback: feature flag tắt preset autofill, fallback manual account selection.
- Risk 2: Quan hệ related docs làm chậm query list voucher.
  - Mitigation: dùng junction table + index đúng cột truy vấn.
  - Rollback: tạm ẩn phần hiển thị related docs ở list, giữ ở detail.
- Risk 3: Chặn create ở AR Workbench có thể ảnh hưởng thao tác quen thuộc.
  - Mitigation: thay bằng CTA điều hướng rõ ràng sang cash/bank form.
  - Rollback: restore CTA cũ qua config toggle nếu có incident.

## Evidence cần thu thập khi thực thi
- Gate 0:
  - Kết quả precheck collections/fields trước và sau migration.
  - SQL/Directus evidence cho constraints + indexes.
- API:
  - Payload + response mẫu create/update cash,bank với `tag_code` và `related_documents`.
  - Negative test response khi gọi create từ AR Workbench path.
- UI:
  - Trình tự thao tác: click preset -> account auto-fill.
  - Trình tự thao tác: attach nhiều related docs và lưu thành công.
  - Xác nhận AR Workbench không còn tạo trực tiếp flow cash/bank.
- Quality:
  - `npm run build` (API) + `npx tsc --noEmit` (Web) output.

## Validation Evidence
- DB precheck result: `DB_GAP_FOUND` (cash_transactions/bank_transactions chưa có; cần chốt model đích và schema mapping)
- Build: pending execution
- Smoke: pending execution

## Lessons Learned
- No issue (PLAN mode)

## Commit/Push Status
- API repo: chưa thực hiện (PLAN mode)
- Web repo (if affected): chưa thực hiện (PLAN mode)
- DB/directus staging: chưa apply (PLAN mode)

## Sẵn sàng thực thi
Đã hoàn tất PLAN mode và Gate 0 precheck. Nếu bạn xác nhận, bước tiếp theo sẽ là tạo DB task ở directus-staging và thực thi tuần tự DB -> API -> UI theo kế hoạch trên, tuyệt đối không tạo mới tại AR Workbench.