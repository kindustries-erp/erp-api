# Task — Unify Cash/Bank forms and remove AR duplicate flows

## Request Input (bạn chỉ cần điền phần này)
- Type: ENHANCE
- Mục tiêu:
  1) Gộp toàn bộ nghiệp vụ Phieu Thu, Dat Coc, Can tru coc vào 1 form cash/bank duy nhất.
  2) Form cash/bank phải link tới chứng từ tạo ở phần công nợ.
  3) Bỏ các mục Phieu thu/Dat coc/Can tru coc trong phân hệ Phải thu.
- Bối cảnh/ngữ cảnh: ERP PLAN mode (plan-only, chưa được sửa code/DB/deploy).

## Goal
Thiết kế lại luồng nghiệp vụ để cash/bank là bề mặt thao tác duy nhất cho thu tiền, đặt cọc, cấn trừ cọc; AR chỉ giữ vai trò nguồn chứng từ và đối soát công nợ, không còn UI thao tác trùng nghiệp vụ.

## Scope
- In-scope:
  - Chuẩn hoá 1 form Cash và 1 form Bank cho các case: thu tiền thường, thu đặt cọc, cấn trừ cọc.
  - Liên kết 1-nhiều giữa chứng từ cash/bank với chứng từ công nợ (AR documents / applications / vouchers liên quan).
  - Loại bỏ entry points tương ứng ở AR Workbench UI (Phiếu thu, Đặt cọc, Cấn trừ cọc).
- Out-of-scope:
  - Thay đổi quy tắc kế toán lõi ngoài phạm vi 3 use-case nêu trên.
  - Thay đổi phân hệ Phải trả (AP) và các luồng thu/chi khác không thuộc cash/bank.

## In-scope / Out-of-scope boundary bắt buộc
- In-scope module thao tác: `TienMat` + `TienGui` (cash/bank).
- Out-of-scope module thao tác tạo chứng từ: `ArWorkbench` (chỉ còn xem/liên kết, không create các flow trùng).

## Relevant Files
- API
  - `src/payment-vouchers/*` - contract tạo/cập nhật cash/bank voucher, link related docs.
  - `src/ar-workbench/*` - khóa/bỏ endpoints create cho phiếu thu/đặt cọc/cấn trừ cọc trên AR nếu đang expose.
- Web
  - `src/pages/TienMat.tsx`, `src/pages/TienGui.tsx` - unified form entry.
  - `src/modules/finance/components/CashVoucherDrawer/*`
  - `src/modules/finance/components/TienGui/BankVoucherDrawer.tsx`
  - `src/modules/finance/components/ArWorkbenchPanel/*` - remove/hide duplicate actions/tabs.
- Directus/DB
  - `payment_vouchers`
  - `cash_bank_related_documents`
  - `ar_documents`
  - `ar_applications`

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - Collections tồn tại: `payment_vouchers`, `cash_bank_tag_presets`, `cash_bank_related_documents`, `ar_documents`, `ar_applications`.
  - Field cần verify khi vào ACT:
    - `payment_vouchers.cash_bank_tag_preset_id`
    - Các field phân loại nghiệp vụ (voucher_type/source_type/reference_type...) đủ để phân biệt thu thường/đặt cọc/cấn trừ cọc.
    - FK/liên kết từ `cash_bank_related_documents.payment_voucher_id` và cặp `related_type/related_id`.
- Data nền cần có:
  - Danh mục account mappings cho preset cash/bank.
  - Dữ liệu AR chứng từ nguồn (invoice/advance/application) để link.
- Constraint/index/default cần có:
  - Index truy vấn theo `payment_voucher_id` và `related_type, related_id`.
  - Ràng buộc tránh duplicate link không mong muốn trong cùng voucher.
- Kết quả: `DB_READY`
- Evidence precheck hiện có:
  - Query read-only xác nhận bảng tồn tại: `ar_applications, ar_documents, cash_bank_related_documents, cash_bank_tag_presets, payment_vouchers`.
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): tạo task riêng ở `directus-staging/ops/tasks/`.

## Coordination Impact
- [ ] Directus staging schema affected (chỉ bật nếu ACT precheck phát hiện thiếu field/index)
- [x] ERP Web contract affected
- [x] ERP API contract affected
- [ ] No cross-system impact

## Plan theo thứ tự DB -> API -> UI

### 1) DB Gate plan
1.1. Re-check schema/field/index chi tiết cho unified flow (read-only).
1.2. Nếu thiếu field/index cho phân biệt nghiệp vụ hoặc link AR chứng từ:
- Tạo DB task riêng + migration SQL.
- Apply trên directus-staging, verify bằng query + Directus metadata.
1.3. Khóa dữ liệu trùng:
- Định nghĩa unique/partial index cho link table nếu cần.
1.4. Evidence DB:
- Output precheck before/after.
- Danh sách field/index cuối cùng.

### 2) API Gate plan
2.1. Chuẩn hóa create/update cash/bank voucher để nhận đủ payload cho 3 use-case.
2.2. Chuẩn hóa service mapping:
- Thu thường
- Thu đặt cọc
- Cấn trừ cọc
(qua `voucher_type` + related docs, không tạo flow AR riêng).
2.3. AR boundary:
- Disable/remove API write paths ở AR Workbench cho 3 nghiệp vụ trùng.
- Giữ read endpoints để AR xem dữ liệu liên kết.
2.4. Validation/API gate:
- Build API.
- Smoke endpoint cash/bank create/update + get detail có related docs.
- Negative gate: gọi endpoint AR create cũ phải bị chặn (404/403/410 theo quyết định thiết kế).

### 3) UI Gate plan
3.1. Cash/Bank forms:
- Một UX thống nhất cho thu thường/đặt cọc/cấn trừ cọc.
- Cho chọn “Loại nghiệp vụ” + auto-fill account từ preset.
- Chọn/link chứng từ công nợ liên quan (invoice/voucher/application).
3.2. AR Workbench:
- Remove/hide các nút/tab tạo Phiếu thu/Đặt cọc/Cấn trừ cọc.
- Giữ màn tra cứu/liên kết/đối soát.
3.3. Negative UI gate:
- Xác nhận user không thể tạo 3 nghiệp vụ trên AR UI nữa.
- Xác nhận vẫn tạo được đầy đủ trên Cash/Bank UI.

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done (PLAN evidence only)
- [ ] 2.0 DB execution gate done (chỉ khi ACT và có gap)
- [ ] 3.0 Backend workflow/API gate done
- [ ] 4.0 UI gate done
- [ ] 5.0 Validate
  - [ ] 5.1 API build + smoke
  - [ ] 5.2 Web tsc/build + smoke
  - [ ] 5.3 Negative gate: AR create path blocked/removed
- [ ] 6.0 Close
  - [ ] 6.1 Lessons learned entry (if issue)
  - [ ] 6.2 Commit + push code (web/api)
  - [ ] 6.3 Deploy stack liên quan + runtime verify
  - [ ] 6.4 Summary with evidence

## Gate validations (bắt buộc)
- DB gate:
  - Schema/field/index đủ cho unified flow.
- API gate:
  - Cash/bank create/update cho cả 3 case thành công.
  - AR duplicate create endpoints bị chặn/loại bỏ.
- UI gate:
  - Chỉ còn 1 điểm tạo ở cash/bank.
  - AR không còn thao tác tạo 3 flow trùng.

## Risk + Rollback
- Risk 1: Mất tương thích dữ liệu lịch sử giữa AR và cash/bank.
  - Mitigation: giữ read model ở AR, migrate mapping rõ ràng theo reference.
  - Rollback: feature-flag để tạm mở lại AR actions nếu phát sinh blocker vận hành.
- Risk 2: Sai mapping account khi chuyển loại nghiệp vụ trong cùng form.
  - Mitigation: preset mapping rõ + validation bắt buộc trước submit.
  - Rollback: revert commit UI/API mapping, giữ schema mới nếu an toàn.
- Risk 3: Người dùng nhầm luồng sau khi bỏ tab/nút ở AR.
  - Mitigation: banner/hint điều hướng sang Cash/Bank trong AR panel.

## Validation Evidence (cần thu thập khi ACT)
- DB:
  - Kết quả precheck chi tiết fields/indexes before/after.
- API:
  - Request/response mẫu cho 3 use-case qua cash/bank.
  - Bằng chứng endpoint AR tạo cũ bị chặn.
- UI:
  - Screenshot/record thao tác tạo 3 use-case ở cash/bank.
  - Screenshot AR đã remove/hide các action trùng.
- Runtime:
  - Build logs, container status, startup logs sau deploy.

## Lessons Learned
- PLAN mode: chưa phát sinh issue triển khai.

## Commit/Push Status
- API repo: PLAN ONLY (chưa thực hiện)
- Web repo: PLAN ONLY (chưa thực hiện)
- DB/directus staging: PLAN ONLY (chưa thực hiện)

## Sẵn sàng thực thi
Kế hoạch đã hoàn tất theo ERP PLAN mode, có Gate 0 DB precheck và phân rã DB -> API -> UI.
Chờ bạn xác nhận để chuyển sang ACT mode và triển khai.

## ACT close-out evidence
- API commit: `122b66e feat: centralize ar cash bank flows`.
- Web commit: `f23e549 feat: unify cash bank ar-linked flows`.
- Docs commit: `/opt/docs` `7ea0eb6 docs: record unified cash bank ar flow`.
- API build: `npm run build` pass.
- Web build: `npm run build` pass.
- Deploy: `/opt/stacks/liouni-erp-api` and `/opt/stacks/liouni-erp-web` rebuilt with no cache and restarted.
- Negative smoke: removed AR POST routes return 404.
- Positive smoke: payment voucher and AR document GET routes return auth guard 401 without token, confirming routes are active behind auth.
- Web smoke: local `/` returns HTTP 200; deployed bundle contains unified AR copy and `Link công nợ` marker.
