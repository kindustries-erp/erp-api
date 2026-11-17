---
name: cashflow-vouchers-core
description: Lõi phiếu thu chi dùng chung v2 (src/v2/core/cashflow-vouchers-core) - entity base BaseCashflowVoucherEntity, kiểu loại và trạng thái phiếu. Đọc trước khi dựng module phiếu thu chi (hiện là cashflow-vouchers-garage) hoặc đổi trạng thái, cột pnl_*.
---

# cashflow-vouchers-core (lõi, mới có entity base)

Vị trí: `src/v2/core/cashflow-vouchers-core`. Không phụ thuộc garage; module con kế thừa và đặt tên bảng.

## 1. Thành phần
- `entities/base-cashflow-voucher.entity.ts`: `BaseCashflowVoucherEntity` (abstract, KHÔNG `@Entity`), kế thừa `CoreSoftDeletableEntity` (`id`, `extra_data`, timestamps, `is_deleted`). Kiểu `CashflowVoucherType` (RECEIPT/PAYMENT) và `CashflowVoucherStatus` (EXPECTED/PENDING/PAID/CANCELLED).
- Cột chính: `branch_external_id` (bắt buộc), `voucher_code` (unique), `voucher_type`, `status` (mặc định PENDING), `trans_date`, `amount numeric(18,2)`, `case_id` (không FK), `payer_type` KH/BH, `source` MANUAL/LEGACY, `is_auto_expected`, `is_auto_commission`, `pnl_period_year/month`, `pnl_commission_type/anchor_id` (giữ để báo cáo lãi lỗ đọc được qua mirror).

## 2. Quy tắc
- Hủy phiếu = `status = CANCELLED` (và đảo phân bổ ở orchestrator), không xóa cứng.
- Phiếu cũ không có `branch_external_id`: backfill suy từ vụ việc; phiếu không gắn vụ việc gán chi nhánh duy nhất hiện có (quyết định 2026-11-17).
- Phiếu thu cũ `payment_status = NULL` → `PAID`.
- Phân bổ vào công nợ đi qua orchestrator và `DebtSettlementPort` của `debts-core`, không ghi trực tiếp ở lõi này.

## 3. Hiện trạng
- Bảng con duy nhất: `cashflow_vouchers_garage` (entity `CashflowVoucherGarage` ở `src/v2/modules/cashflow-vouchers-garage/entities`), migration `1794900000000-GarageCashflowDebtsV2Tables` đã chạy trên staging (2026-11-17), bảng rỗng, chưa backfill, production chưa chạy.
- Chưa có abstract command/query, DTO, controller. Thuộc Phase 2 của `.agents/plans/garage-cashflow-debts-ledger-v2`.
