# Task: FIX — Cấn trừ phiếu tiền mặt/tiền gửi với hóa đơn cập nhật sai số dư và thiếu hiển thị chứng từ đã cấn trừ (PLAN ONLY)

## Request Input (bạn chỉ cần điền phần này)
- Type: FIX
- Mục tiêu: Sửa lỗi khi tạo phiếu tiền mặt/tiền gửi (ví dụ 15tr) link vào hóa đơn 25tr thì hóa đơn đang bị cập nhật paid hết/remaining=0; đúng phải còn 10tr. Đồng thời trong form tạo hóa đơn/chứng từ khác phải hiển thị các phiếu tiền mặt, tiền gửi đã cấn trừ tương ứng.
- Bối cảnh/ngữ cảnh: Luồng AR + Cash/Bank đã có liên kết related_documents và settlement; hiện sai phần recompute persisted paid/open và thiếu dữ liệu hiển thị hai chiều.

## Goal
Khôi phục đúng nghiệp vụ cấn trừ một phần giữa payment voucher và AR document theo persisted state (không chỉ UI), đảm bảo:
1) Hóa đơn nhận partial allocation thì `settled/paid` tăng đúng bằng số cấn trừ và `open/remaining` giảm đúng phần tương ứng.
2) Form tạo hóa đơn/chứng từ khác hiển thị danh sách phiếu tiền mặt/tiền gửi đã cấn trừ tương ứng theo counterparty + document context.

## Scope
- In-scope:
  - Kiểm tra và sửa logic persist/recompute settlement giữa `payment_vouchers` và `ar_documents` khi tạo/cập nhật liên kết related document.
  - Bổ sung/chuẩn hóa API payload phục vụ UI hiển thị chứng từ đã cấn trừ trong form tạo hóa đơn/chứng từ khác.
  - Cập nhật ERP Web để hiển thị đúng các phiếu tiền mặt/tiền gửi đã cấn trừ tương ứng (read model hai chiều).
  - Validation âm (negative): ngăn over-allocation vượt open amount hoặc vượt available amount của voucher.
- Out-of-scope:
  - Thiết kế lại toàn bộ flow AR/Cash-Bank.
  - Thay đổi nghiệp vụ đảo bút toán đã bị gỡ trước đó.
  - Data reset/destructive cleanup production.

## Relevant Files
- `/opt/repos/liouni-erp/liouni-erp-api/src/modules/payment-vouchers/**` - dịch vụ tạo/post voucher, xử lý related documents.
- `/opt/repos/liouni-erp/liouni-erp-api/src/modules/ar-workbench/**` - recompute AR document open/settled/status và read model AR.
- `/opt/repos/liouni-erp/liouni-erp-api/src/modules/**/controllers/*.ts` liên quan lookup/list/detail settlement.
- `/opt/repos/liouni-erp/liouni-erp-web/src/modules/cash-management/**` - form phiếu tiền mặt/tiền gửi + liên kết chứng từ.
- `/opt/repos/liouni-erp/liouni-erp-web/src/modules/ar-workbench/**` - form tạo hóa đơn/chứng từ khác + hiển thị chứng từ đã cấn trừ.

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `payment_vouchers`: `id`, `voucher_type`, `status`, amount fields, counterparty fields.
  - `ar_documents`: `id`, `document_no`, `total_amount`, `settled_amount`/`paid_amount`, `open_amount`/`remaining_amount`, `status`.
  - `ar_applications` (hoặc bảng liên kết allocation hiện hành): `payment_voucher_id`, `target_document_id`, `applied_amount`, `application_type`, `status`.
- Data nền cần có:
  - Tối thiểu 1 hóa đơn AR open > 0 và 1 phiếu tiền mặt/tiền gửi posted có số tiền nhỏ hơn hóa đơn để test partial allocation.
- Constraint/index/default cần có:
  - FK giữa allocation -> voucher/document còn hiệu lực.
  - Check amount > 0, guard không over-allocation.
  - Cơ chế idempotent/recompute persisted cho `settled/open`.
- Kết quả: `DB_READY` (không yêu cầu đổi schema ở bước plan; ưu tiên fix logic service/API/UI. Nếu lúc execute phát hiện thiếu guard DB sẽ tách DB patch trước API/UI theo gate).
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): `TBD khi execute nếu phát hiện thiếu CHECK/FK/trigger`.

## Coordination Impact
- [ ] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Plan theo thứ tự DB -> API -> UI

### 1) DB Gate (read-only verify trước, chỉ tạo DB patch nếu phát hiện gap)
- [ ] 1.1 Inspect schema/constraint/index hiện tại cho `payment_vouchers`, `ar_documents`, `ar_applications`.
- [ ] 1.2 Dò dữ liệu thực tế 1 case lỗi (voucher 15tr + invoice 25tr) để xác định điểm sai persisted values.
- [ ] 1.3 Xác nhận recompute source-of-truth (allocation rows) và quy tắc status transition document.
- [ ] 1.4 Nếu phát hiện thiếu guard DB: tạo DB subtask riêng (directus-staging) và apply trước gate API.

### 2) API Gate
- [ ] 2.1 Trace endpoint tạo/cập nhật liên kết voucher-document; sửa thuật toán cập nhật `paid/open` theo partial allocation.
- [ ] 2.2 Đảm bảo idempotent khi retry/request lặp, không nhân đôi settled amount.
- [ ] 2.3 Bổ sung payload read model cho form tạo hóa đơn/chứng từ khác: danh sách phiếu tiền mặt/tiền gửi đã cấn trừ tương ứng.
- [ ] 2.4 Negative validations: chặn applied_amount > invoice_open hoặc > voucher_available.
- [ ] 2.5 Smoke API: create allocation partial, edit, reverse/cancel (nếu còn), verify persisted balances cả 2 phía.

### 3) UI Gate
- [ ] 3.1 Cash/Bank form: giữ luồng link chứng từ, hiển thị rõ số đã cấn trừ/còn lại theo dữ liệu API mới.
- [ ] 3.2 AR form tạo hóa đơn/chứng từ khác: hiển thị các phiếu tiền mặt/tiền gửi đã cấn trừ tương ứng theo counterparty/document.
- [ ] 3.3 Đồng bộ labels/format số tiền và trạng thái partial/full settled.
- [ ] 3.4 UI negative check: không cho submit cấn trừ vượt số dư.

## Checklist realtime
- [x] 1.0 Gate 0 DB Precheck done (PLAN)
- [ ] 2.0 Backend workflow/API gate done
- [ ] 3.0 UI handoff gate done
- [ ] 4.0 Validate
  - [ ] 4.1 API `npm run build`
  - [ ] 4.2 Web `npm run build`
  - [ ] 4.3 Smoke test affected endpoints + UI flow
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (api/web)
  - [ ] 5.3 Deploy stacks liên quan + runtime verify
  - [ ] 5.4 Summary with evidence

## Gate validations (acceptance)
- [ ] AV-01 Partial allocation đúng số học: Invoice 25tr nhận voucher 15tr => remaining 10tr (persisted DB + API response + UI).
- [ ] AV-02 Không có case invoice bị auto paid hết khi allocation < total.
- [ ] AV-03 Form tạo hóa đơn/chứng từ khác hiển thị đúng danh sách phiếu tiền mặt/tiền gửi đã cấn trừ tương ứng.
- [ ] AV-04 Dữ liệu hai chiều nhất quán: view từ Cash/Bank và từ AR cho cùng allocation.
- [ ] AV-05 Over-allocation bị chặn bằng lỗi nghiệp vụ rõ ràng.

## Risk + Rollback
- Rủi ro:
  - Recompute sai có thể làm lệch dữ liệu lịch sử đã cấn trừ.
  - Sửa read model có thể ảnh hưởng các tab AR/Cash-Bank khác dùng chung endpoint.
- Giảm thiểu:
  - Chạy test với transaction rollback cho ca smoke dữ liệu.
  - So sánh before/after trên cùng document/voucher IDs.
  - Giữ thay đổi nhỏ, tách commit DB/API/UI rõ ràng.
- Rollback:
  - Revert commit API/Web theo từng gate.
  - Nếu có DB patch, chuẩn bị script rollback tương ứng và verify lại balances từ allocation source.

## Evidence cần thu thập
- DB precheck output (collections/fields/constraints) trước execute.
- Bản ghi before/after của invoice và voucher (paid/open, status) cho case 25tr-15tr.
- API request/response logs cho create allocation và lookup hiển thị chứng từ đã cấn trừ.
- Ảnh/chuỗi thao tác UI chứng minh form hóa đơn/chứng từ khác thấy phiếu đã cấn trừ tương ứng.
- Build logs API + Web, deploy verify container status/logs.

## Lessons Learned
- Cần guard cả UI và API: UI chỉ default số cấn trừ theo min(open_amount, voucher.amount), API vẫn chặn tổng dòng AR vượt voucher.amount.

## Commit/Push Status
- API repo: `IMPLEMENTED - pending commit/push`
- Web repo: `IMPLEMENTED - pending commit/push`
- DB/directus staging: `DB_READY - không thay đổi schema/DB`

## Evidence sau thực thi
- API unit test: `npm test -- cash-bank-settlement.util.spec.ts --runInBand` PASS.
- API build: `npm run build` PASS.
- Web build: `npm run build` PASS (chỉ còn cảnh báo chunk/dynamic import hiện hữu của Vite).
- DB schema: không thay đổi schema; Gate 0 DB_READY.

## Sẵn sàng thực thi
User đã xác nhận `thuc thi`; implementation đã hoàn tất phần code và validation local, chưa deploy runtime.