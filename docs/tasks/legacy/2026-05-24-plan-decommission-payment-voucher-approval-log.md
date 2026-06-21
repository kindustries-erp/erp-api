# Task — PLAN ONLY — Decommission payment voucher approval log

## Request Input (bạn chỉ cần điền phần này)
- Type: FIX
- Mục tiêu: Xóa sạch phần approval voucher log khỏi DB + API; UI không gọi contract cũ nữa và thay bằng mock random data để không quên vị trí UI, chờ làm lại flow approval log sau.
- Bối cảnh/ngữ cảnh: Flow approval log hiện tại đang rối ở API decorate user name, không ổn để scale. User yêu cầu decommission toàn bộ phần approval voucher log hiện tại thay vì tiếp tục vá.

## Goal
Lập kế hoạch decommission sạch toàn bộ flow `payment_voucher_approval_logs` hiện tại theo chuỗi DB -> API -> UI -> QC, giữ UI placeholder/mock để về sau còn nhớ vị trí cần rebuild.

## Scope
- In-scope:
  - Audit DB/runtime exposure của `payment_voucher_approval_logs`
  - Xóa contract BE liên quan endpoint/module approval log của payment voucher
  - Gỡ UI dependency vào API approval log, thay bằng mock random data local trong component hiển thị history
  - Chuẩn bị checklist QC negative validation + rollback
- Out-of-scope:
  - Thiết kế lại approval log mới
  - Rebuild workflow approval/payment voucher tổng thể
  - Sửa các approval flow khác ngoài payment voucher

## Relevant Files
- `src/payment-voucher-approval-logs/*` - module approval log BE cần decommission
- `src/app.module.ts` - import module approval log
- `src/payment-vouchers/payment-vouchers.service.ts` - call sites/log creation cần audit và gỡ nếu có
- `../liouni-erp-web/src/modules/finance/api/financeApi.ts` - API contract FE approval log
- `../liouni-erp-web/src/modules/finance/components/ApprovalHistory/index.tsx` - UI approval history
- `../liouni-erp-web/src/modules/finance/components/BankDeposit/BankVoucherDrawer.tsx` - screen sử dụng ApprovalHistory
- `../liouni-erp-web/src/modules/finance/components/CashVoucherDrawer/index.tsx` - screen sử dụng ApprovalHistory

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `payment_voucher_approval_logs`
  - `payment_voucher_approval_logs.action_by`
  - `payment_voucher_approval_logs.payment_voucher_id`
  - metadata Directus liên quan collection trên (`directus_collections`, `directus_fields`, `directus_relations`, `directus_permissions` nếu có)
- Data nền cần có:
  - count live rows đang tồn tại trong `payment_voucher_approval_logs`
  - xác nhận payment voucher runtime hiện có còn query vào collection này không
- Constraint/index/default cần có:
  - backup trước khi drop/hard-remove DB
  - verify collection có thể đang tồn tại ở staging runtime dù repo directus-staging chưa có SQL migration tương ứng
- Kết quả: `DB_READY` cho planning; execution phải recheck để chốt `DB_READY` hoặc `DB_GAP_FOUND`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): sẽ tạo khi execute nếu runtime state không khớp plan

## Coordination Impact
- [x] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

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

## PLAN ONLY — Proposed execution

### DB
1. Backup Directus staging trước mutation.
2. Verify collection `payment_voucher_approval_logs` có tồn tại thật ở runtime DB + Directus metadata không.
3. Nếu tồn tại:
   - snapshot row count
   - drop exposure metadata
   - hard-drop collection/bảng hoặc đánh dấu decommission theo scope user muốn “xóa sạch”
4. Cập nhật `/opt/docs/ai/liouni-erp/erp-database-schema.md` theo pattern decommission lịch sử nếu collection đang được ghi trong canonical schema docs.
5. Verify negative:
   - Directus `/fields/payment_voucher_approval_logs` không còn usable
   - runtime query collection fail đúng kỳ vọng hoặc collection absent

### API
1. Repo-wide search tất cả marker:
   - `payment-voucher-approval-logs`
   - `payment_voucher_approval_logs`
   - `action_by_name`
2. Xóa module/controller/service/dto approval log.
3. Gỡ import khỏi `app.module.ts`.
4. Audit `payment-vouchers.service.ts` và các service liên quan để gỡ mọi create/read side-effect vào approval log.
5. Build backend.
6. Negative QC:
   - route `/api/v1/payment-voucher-approval-logs` phải 404 hoặc không còn wired.

### UI
1. Gỡ API function/type `PaymentVoucherApprovalLog` và `getPaymentVoucherApprovalLogsApi` khỏi `financeApi.ts`.
2. Giữ component `ApprovalHistory` nhưng đổi sang mock local data generator để placeholder UI còn đó.
3. Mock data phải random nhẹ, deterministic theo voucher id nếu có thể, để nhìn vẫn giống history nhưng không phụ thuộc BE.
4. `BankVoucherDrawer` và `CashVoucherDrawer` không còn gọi API approval log.
5. Build web + smoke voucher drawer mở bình thường, approval history hiển thị mock badge/text.
6. Negative QC:
   - Network không còn call `/payment-voucher-approval-logs`

### QC
- PASS:
  - DB không còn collection/metadata active của approval log hiện tại
  - API route removed
  - UI không gọi endpoint cũ
  - Drawer cash/bank vẫn mở, block approval history vẫn hiện mock data
- FAIL:
  - bất kỳ layer nào còn tham chiếu endpoint/collection cũ
  - UI trắng/crash do bỏ approval log
  - docs schema/runtime không cập nhật theo decommission

## Validation Evidence
- DB precheck result: Planning scan cho thấy marker tồn tại ở API/Web; repo directus-staging chưa thấy SQL marker nên cần recheck live DB/runtime lúc execute.
- Build: PLAN ONLY — chưa chạy
- Smoke: PLAN ONLY — chưa chạy

## Lessons Learned
- Link: No issue

## Commit/Push Status
- API repo: PLAN ONLY — chưa thực thi
- Web repo (if affected): PLAN ONLY — chưa thực thi
- DB/directus staging: PLAN ONLY — chưa thực thi
