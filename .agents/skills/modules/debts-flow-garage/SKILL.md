---
name: debts-flow-garage
description: Orchestrator thu chi + công nợ garage v2 - ghi phiếu và phân bổ trong một transaction, mirror sang bảng V1 cùng UUID, projector chiếu thay đổi V1 sang sổ nợ v2. Đọc trước khi sửa luồng ghi thu chi, phân bổ, mirror hoặc hook V1.
---

# debts-flow-garage (src/v2/modules/debts-flow-garage)

Mẫu `procurement-flow-garage`. Đăng ký ở `app.module.ts`. Plan: `.agents/plans/garage-cashflow-debts-ledger-v2`.

## 1. Route ghi
- `POST/PATCH api/v2/cashflow-vouchers-garage`, `PATCH :id/status`, `DELETE :id/cancel` (quyền DELETE).
- `POST api/v2/debts-garage/allocations`, `POST allocations/:id/reverse`. Bắt buộc header `Idempotency-Key`.

## 2. Luồng
- `GarageDebtsFlowService` (`recordVoucher`, `updateVoucher`, `changeVoucherStatus`) và `GarageDebtAllocationFlowService` (`allocate`, `reverseAllocation`): mỗi lệnh một transaction (`runInTransaction`); sự kiện (hub V1 `handleCaseReceiptChanged`) chỉ chạy sau commit.
- `GarageVoucherAllocationService.syncForVoucher`: quy tắc V1 `voucherSettlesDebt` (thu trừ nợ trừ EXPECTED/CANCELLED; chi chỉ PAID và không opex/hoa hồng). Phiếu thu không chỉ định bên trả: BH nếu còn nợ INSURER, không thì KH. Phân bổ theo phiếu cho phép thu dư; phân bổ thủ công 409 khi vượt.
- Đổi số tiền/vụ việc = đảo phân bổ cũ rồi áp lại.

## 3. Cầu nối V1 (`legacy/`)
- `LegacyKgaraMirrorService` (v2 → V1, cùng transaction, cùng UUID): phiếu `kgara_cashflow_vouchers`, settlement, opex qua hub, `tien_da_thanh_toan`/`tien_con_phai_thanh_toan` của vụ việc (công thức giống `_recalculateCaseDebt`, gỡ khi báo cáo chuyển v2). Phân bổ thủ công → settlement `OFF_SYSTEM_MANUAL`.
- `LegacyProjectorService` + `LegacyAllocationSyncService` (V1 → v2, transaction riêng, idempotent) cài `GarageLedgerProjectorPort`, token `GARAGE_LEDGER_PROJECTOR` (`kgara-api-core/hub/ledger-projector.port.ts`). Settlement V1 → phân bổ `origin=LEGACY` (khóa `legacy:<settlementId>:<debtId>:<amount>:<n>`); không đụng phân bổ NATIVE. Chi nhánh lấy từ vụ việc (`branch_external_id` và `branch_id` ERP qua `cases_garage`), phiếu không vụ việc dùng env `GARAGE_DEFAULT_BRANCH_EXTERNAL_ID` (thiếu thì lỗi, chỉ log). Controller nhận header `x-erp-branch-id` (id `branches_management`, decorator `@ErpBranchId()` ở `@/v2/core/branches-core`) KHÔNG bắt buộc: không gửi = mọi chi nhánh; gửi thì lọc `branch_id` (helper `applyBranchScope`/`branchWhere`); sai UUID = 400; phiếu thu chi ghi `branch_id` của vụ việc, không có vụ việc thì chi nhánh đang gửi hoặc NULL. Hạn chế: đổi vụ việc của phiếu không cập nhật lại `branch_id`.
- Hook V1 (gọi sau commit, lỗi chỉ log): `garage-cashflow-transaction.service.ts`, `kgara-case-financial.controller.ts`, `sync-case.service.ts`.

## 4. Kiểm thử và giới hạn
- Integration spec dùng DB giả (`testing/in-memory-ledger.testing.ts`): kiểm rollback, idempotent, parity V1; KHÔNG kiểm khóa dòng/đồng thời thật (cần smoke Phase 3.1.3).
- Chưa có test riêng cho hook `sync-case`.
