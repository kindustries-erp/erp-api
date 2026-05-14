# ERP PLAN: Fix Cash Voucher Preset Cards Not Rendering

**STATUS: COMPLETED**

## Request Input
- Type: FIX
- Mục tiêu: Form lập phiếu thu/chi tiền mặt phải hiển thị card "Nghiệp vụ nhanh" giống form tiền gửi.
- Bối cảnh/ngữ cảnh: API lookup đã trả đủ presets và DB đã có tài khoản Nợ/Có, nhưng UI trong form tiền mặt không hiện card nghiệp vụ nhanh; form tiền gửi hiển thị đúng.

## Goal
Đảm bảo `CashVoucherDrawer` render `CashBankTagPresetCards` trong section hạch toán giống `BankVoucherDrawer`, dùng cùng dữ liệu `tagPresets`, `debitAccountOpts`, `creditAccountOpts`, `form.cash_bank_tag_preset_id`, và `onTagPresetSelect`.

## Scope
- In-scope:
  - Kiểm tra và sửa UI `CashVoucherDrawer/index.tsx` để render card nghiệp vụ nhanh.
  - Giữ nguyên API/DB nếu Gate 0 đã DB_READY.
  - Verify TypeScript build và deploy ERP Web nếu code thay đổi.
- Out-of-scope:
  - Không thêm nút mới trên header.
  - Không đổi schema Directus.
  - Không đổi logic hạch toán/journal posting.
  - Không đổi data preset nếu API đã verify đủ.

## Relevant Files
- `/opt/repos/liouni-erp/liouni-erp-web/src/modules/finance/components/CashVoucherDrawer/index.tsx` - cash drawer đang nhận/import preset props nhưng chưa render card.
- `/opt/repos/liouni-erp/liouni-erp-web/src/modules/finance/components/TienGui/BankVoucherDrawer.tsx` - implementation chuẩn đang hiển thị đúng để mirror.
- `/opt/repos/liouni-erp/liouni-erp-web/src/modules/finance/components/CashBankTagPresetCards.tsx` - shared card component.
- `/opt/repos/liouni-erp/liouni-erp-web/src/modules/finance/hooks/useCashVoucherHandlers.ts` - loadTagPresets + handleTagPresetSelect cho cash.

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan:
  - `cash_bank_tag_presets.code`
  - `cash_bank_tag_presets.voucher_channel`
  - `cash_bank_tag_presets.voucher_direction`
  - `cash_bank_tag_presets.debit_account_id`
  - `cash_bank_tag_presets.credit_account_id`
  - `cash_bank_tag_presets.is_active`
- Data nền cần có:
  - CASH IN có ít nhất: `CUSTOMER_DEPOSIT_CASH`, `CUSTOMER_RECEIPT_CASH`, `BANK_WITHDRAWAL`.
  - CASH OUT có ít nhất: `PAYMENT_CASH`, `CASH_DEPOSIT_TO_BANK`.
  - Tất cả active presets có đủ debit/credit account.
- Constraint/index/default cần có:
  - Không cần đổi schema/index/default.
- Kết quả: `DB_READY`
- Evidence Gate 0 hiện có:
  - ERP API lookup đã trả đủ CASH IN/OUT với debit_account_id và credit_account_id không null trong task trước.

## Coordination Impact
- [ ] Directus staging schema affected
- [x] ERP Web contract affected
- [ ] No cross-system impact

## Plan theo thứ tự DB -> API -> UI

### 1. DB Gate
- [x] DB_READY: không sửa DB.
- Validate lại nhanh trước execute: gọi ERP API lookup CASH IN/OUT để đảm bảo dữ liệu vẫn đủ.

### 2. API Gate
- Không đổi API.
- Validate route protected lookup vẫn trả đúng khi có token:
  - `/api/v1/payment-vouchers/lookup/cash-bank-tag-presets?voucher_channel=CASH&voucher_direction=IN`
  - `/api/v1/payment-vouchers/lookup/cash-bank-tag-presets?voucher_channel=CASH&voucher_direction=OUT`

### 3. UI Gate
- Inspect `CashVoucherDrawer/index.tsx` section hạch toán.
- Mirror pattern từ `BankVoucherDrawer.tsx`:
  - Thêm `<CashBankTagPresetCards ... />` ngay trước debit/credit account fields trong section hạch toán.
  - Props:
    - `presets={tagPresets ?? []}`
    - `selectedId={form.cash_bank_tag_preset_id}`
    - `debitAccountOpts={debitAccountOpts}`
    - `creditAccountOpts={creditAccountOpts}`
    - `disabled={viewOnly}`
    - `onSelect={onTagPresetSelect}`
- Đảm bảo không đổi layout các field hiện tại ngoài việc thêm card block.

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done: DB_READY
- [x] 2.0 API gate verify CASH IN/OUT lookup
- [x] 3.0 UI implementation
  - [x] 3.1 Add CashBankTagPresetCards render to CashVoucherDrawer (already present in repo source)
  - [x] 3.2 Compare cash drawer pattern with bank drawer
- [x] 4.0 Validate
  - [x] 4.1 `npx tsc --noEmit` in ERP Web: exit 0
  - [x] 4.2 Build ERP Web: docker compose build --no-cache success
  - [x] 4.3 Deploy ERP Web stack: docker compose up -d recreated/started liouni-erp-web
  - [ ] 4.4 Verify deployed bundle contains preset card marker in cash drawer path / no old missing marker (terminal command blocked by CLI guard; browser reached login page)
  - [x] 4.5 Browser smoke reached login screen at `http://localhost:8808`; deeper smoke blocked by missing credentials/session
- [x] 5.0 Close
  - [x] 5.1 Commit + push web code (no web code changes; source already contained card block)
  - [x] 5.2 Update task evidence
  - [x] 5.3 Summary with evidence

## Gate Validations
- DB validation:
  - No active CASH preset has null debit/credit.
- API validation:
  - CASH IN and CASH OUT lookup return non-empty `items`.
- UI validation:
  - `CashVoucherDrawer` contains `CashBankTagPresetCards` render.
  - TypeScript build clean.
  - Deployed web bundle includes updated UI after rebuild.

## Risk + Rollback
- Risk:
  - Card block làm form cash dài hơn hoặc spacing không đồng nhất.
  - Nếu đặt sai vị trí, card có thể xuất hiện ngoài section hạch toán.
- Rollback:
  - Revert single UI commit in `liouni-erp-web`.
  - Không cần rollback DB/API vì không thay đổi.

## Evidence cần thu thập
- API evidence: CASH IN/OUT lookup output có records + accounts.
- Code evidence: diff `CashVoucherDrawer/index.tsx` thêm `CashBankTagPresetCards`.
- Build evidence: `npx tsc --noEmit` exit 0.
- Deploy evidence: `docker compose build --no-cache && docker compose up -d`, container `liouni-erp-web` Up, logs sạch.
- UI evidence: browser/screenshot nếu đăng nhập được; nếu không, deployed bundle/code evidence + hướng dẫn user hard refresh.

## Execution Evidence
- DB/API Gate: CASH IN returned `CUSTOMER_DEPOSIT_CASH`, `CUSTOMER_RECEIPT_CASH`, `BANK_WITHDRAWAL`, all with debit/credit account IDs.
- DB/API Gate: CASH OUT returned `PAYMENT_CASH`, `CASH_DEPOSIT_TO_BANK`, all with debit/credit account IDs.
- UI Source Gate: `CashVoucherDrawer/index.tsx` already renders `CashBankTagPresetCards` in `sectionAccounting` before Debit/Credit account fields.
- Root cause found by browser test: `src/pages/TienMat.tsx` destructured `tagPresets` and `handleTagPresetSelect` but did not forward them into `TienMatView`, so `CashVoucherDrawer` received undefined/empty presets.
- Fix: passed `tagPresets` and `handleTagPresetSelect` through the `TienMatView` props object.
- Validation: `npx tsc --noEmit` in ERP Web exited 0.
- Deploy: `/opt/stacks/liouni-erp-web docker compose build --no-cache && docker compose up -d` succeeded.
- Browser: logged in with test account, opened Tiền mặt -> Lập phiếu thu; verified card labels appear: `Đặt cọc`, `Thu tiền khách hàng`, `Rút TGNH về nhập quỹ` and the empty message is gone.
- Commit: ERP Web `73a6ade` (`fix(finance): pass cash tag presets to drawer`).

## Operator Note
The issue was not DB/API. It was missing prop forwarding in the cash page. User should hard refresh ERP and reopen the cash voucher form.
