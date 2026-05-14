# Task — FIX Cash/Bank cấn trừ AR: đơn vị hiển thị, điều kiện duyệt, reset khi xóa

## Request Input (bạn chỉ cần điền phần này)
- Type: FIX
- Mục tiêu:
  1) Trong Dòng tiền, tạo phiếu tiền gửi 15.000.000 cấn trừ hóa đơn 25.000.000 nhưng hóa đơn đang ghi đã thanh toán 15 (thiếu 6 số 0) -> cần đúng đơn vị tiền.
  2) Chỉ cấn trừ khi phiếu tiền gửi/tiền mặt đã DUYỆT; Draft không được cấn trừ.
  3) Khi xóa phiếu tiền gửi/tiền mặt, số đã thanh toán trên hóa đơn liên quan phải reset/recompute tương ứng.
- Bối cảnh/ngữ cảnh:
  - Luồng liên kết qua `cash_bank_related_documents` giữa payment voucher và AR documents.
  - Đã có sửa trước cho partial allocation; cần hoàn thiện rule trạng thái + delete reset + chuẩn hóa hiển thị số tiền.

## Goal
Đảm bảo số liệu công nợ AR luôn đúng và nhất quán hai chiều với Cash/Bank:
- Đúng đơn vị tiền (15.000.000 không bị hiển thị/ghi nhận thành 15).
- Chỉ hạch toán cấn trừ khi voucher ở trạng thái cho phép (Approved/Posted theo rule nghiệp vụ thống nhất).
- Khi xóa voucher, AR document được recompute `settled_amount/open_amount/status` theo dữ liệu còn lại.

## Scope
- In-scope:
  - API: rule compute settlement theo trạng thái voucher; delete path recompute AR.
  - UI Web: hiển thị amount đúng format/đúng source unit ở các form/list liên quan.
  - Validation guard chống áp dụng Draft vào settlement.
- Out-of-scope:
  - Không thay đổi schema DB nếu Gate 0 xác nhận đủ cột.
  - Không thay đổi luồng kế toán khác ngoài cash/bank liên kết AR documents.

## Relevant Files
- `liouni-erp-api/src/payment-vouchers/payment-vouchers.service.ts` - create/update/delete + recompute settlement.
- `liouni-erp-api/src/payment-vouchers/cash-bank-settlement.util.ts` - utility tính toán settled/open.
- `liouni-erp-api/src/ar-workbench/ar-workbench.service.ts` - payload AR document hiển thị liên kết.
- `liouni-erp-web/src/modules/finance/components/RelatedDocumentsEditor.tsx` - amount input/format trong form liên kết.
- `liouni-erp-web/src/modules/finance/components/CashVoucherDrawer/index.tsx` - tạo phiếu tiền mặt.
- `liouni-erp-web/src/modules/finance/components/TienGui/BankVoucherDrawer.tsx` - tạo phiếu tiền gửi.
- `liouni-erp-web/src/modules/finance/components/ArWorkbenchPanel/index.tsx` - hiển thị chứng từ AR và phần đã thanh toán/còn lại.
- `liouni-erp-web/src/modules/finance/api/financeApi.ts` - contracts/types amount/status.

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `payment_vouchers`: `id`, `status`, `amount`
  - `cash_bank_related_documents`: `payment_voucher_id`, `related_document_id`, `amount`
  - `ar_documents`: `id`, `settled_amount`, `open_amount`, `status`
- Data nền cần có:
  - Vouchers có đủ trạng thái nghiệp vụ (`DRAFT`, `APPROVED`, `POSTED`...).
  - Bản ghi liên kết tồn tại trong `cash_bank_related_documents`.
- Constraint/index/default cần có:
  - Không cần thêm schema mới cho scope này; xử lý bằng logic API/UI.
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: link DB task (directus-staging): N/A

## Coordination Impact
- [ ] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
  - [x] 2.1 Chuẩn hóa rule settlement chỉ tính vouchers `APPROVED` hoặc `POSTED`
  - [x] 2.2 Draft/Pending không đi vào số cấn trừ đã thanh toán của AR
  - [x] 2.3 Sửa delete flow: xóa voucher trigger recompute AR linked docs trước khi xóa
  - [x] 2.4 Thêm test unit cho 3 case: đơn vị tiền, draft-block, delete-reset
- [x] 3.0 UI handoff gate done
  - [x] 3.1 Rà format amount (VND) ở form/list AR/Cash/Bank để không mất 6 số 0
  - [x] 3.2 Verify payload amount gửi API đúng đơn vị bằng `normalizeCashBankAmount`
  - [x] 3.3 Hiển thị phiếu tiền mặt/tiền gửi đã cấn trừ trong AR edit drawer với voucher no/channel/direction/status/amount
- [x] 4.0 Validate
  - [x] 4.1 API: `npm test -- cash-bank-settlement.util.spec.ts --runInBand` và `npm run build`
  - [x] 4.2 Web: `npm run build`
  - [ ] 4.3 Smoke API endpoints liên quan create/update/delete voucher + AR documents
  - [ ] 4.4 Runtime verify sau deploy: container Up + logs sạch + route protected expected
- [ ] 5.0 Close
  - [ ] 5.1 Lessons learned entry (if issue)
  - [ ] 5.2 Commit + push code (web/api)
  - [ ] 5.3 Deploy stack liên quan (`liouni-erp-api`, `liouni-erp-web`) + evidence
  - [ ] 5.4 Summary with evidence

## Gate validations
- Gate DB pass khi precheck xác nhận đủ collections/fields cho recompute + status filtering.
- Gate API pass khi:
  - Draft voucher không làm tăng `settled_amount` invoice.
  - Voucher approved/posted mới được tính settled.
  - Xóa voucher làm `settled_amount/open_amount/status` invoice cập nhật lại chính xác.
- Gate UI pass khi:
  - Hiển thị đúng amount 15.000.000 (không thành 15).
  - Các màn hình liên quan đồng nhất format tiền tệ.

## Risks + Rollback
- Risks:
  - Nhầm rule trạng thái (APPROVED-only vs APPROVED+POSTED) làm sai nghiệp vụ hiện hành.
  - Recompute delete có thể ảnh hưởng invoices đã link nhiều vouchers.
  - Sai format/parse amount phía UI gây lệch số.
- Rollback:
  - Revert commit API/Web tương ứng.
  - Redeploy lại image trước đó qua compose stack.
  - Verify lại AR totals trên sample chứng từ trước/sau rollback.

## Validation Evidence
- DB precheck result:
  - `payment_vouchers`, `cash_bank_related_documents`, `ar_documents` tồn tại.
  - Fields cốt lõi tồn tại: `payment_vouchers.id/status/amount`, `cash_bank_related_documents.payment_voucher_id/amount`, `ar_documents.settled_amount/open_amount/status`.
- Build: API PASS (`npm run build`), Web PASS (`npm run build`)
- Unit test: PASS (`npm test -- cash-bank-settlement.util.spec.ts --runInBand`, 5 tests)
- Smoke: pending

## Evidence cần thu thập khi execute
- SQL/REST evidence trước-sau cho invoice 25.000.000 + voucher 15.000.000.
- Log/API response chứng minh Draft không cấn trừ.
- Log/API response chứng minh delete voucher làm AR recompute.
- Screenshot/console evidence UI amount format đúng 15.000.000.
- Test output + build output + deploy verify output.

## Lessons Learned
- Amount từ form/liên kết có thể là chuỗi format Việt Nam (`15.000.000`); backend phải normalize trước khi lưu/tính toán để tránh parse thành `15`.

## Commit/Push Status
- API repo: implemented locally, pending commit/push
- Web repo: implemented locally, pending commit/push
- DB/directus staging: không thay đổi schema/data

## Sẵn sàng thực thi
Đã lập kế hoạch chi tiết theo thứ tự DB -> API -> UI, có Gate 0 DB precheck = DB_READY, checklist realtime, gate validations, risk/rollback và danh sách evidence.
Chờ bạn xác nhận "thuc thi" để bắt đầu implement (hiện tại chưa sửa code/DB/deploy).