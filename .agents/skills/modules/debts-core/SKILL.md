---
name: debts-core
description: Lõi công nợ dùng chung v2 (src/v2/core/debts-core) - hợp đồng, entity base sổ nợ và phân bổ, engine tính số dư và tuổi nợ, khung query abstract, cổng DebtSettlementPort cho orchestrator. Đọc trước khi dựng module công nợ mới hoặc sửa cách tính số dư.
---

# debts-core (lõi: contract, entity base, engine, khung query; không controller)

Vị trí: `src/v2/core/debts-core`. Không phụ thuộc garage; module công nợ (hiện là `debts-garage`) kế thừa.

## 1. Thành phần
- `contracts/`: `debt-account`, `debt-allocation`, `debt-summary`, `debt-settlement.port` (cổng cho orchestrator: apply, reverse, recalculate), `debt-list.contract` (`DebtListQuery`, `DebtListResult`).
- `entities/` (abstract, KHÔNG `@Entity`, module con đặt tên bảng): `BaseDebtEntity` (một dòng cho mỗi `(source_type, source_id, direction, party_type)`; `original_amount`, `settled_amount`, `balance_amount` `numeric(18,2)`; `status` OPEN/SETTLED/VOID; `origin` SYNC/MANUAL/LEGACY; `version` bằng `@VersionColumn`; xóa mềm `is_deleted`), `BaseDebtAllocationEntity` (bất biến: chỉ đảo qua `reversed_at` và `reversal_of_id`; `source_type` theo `DebtAllocationSource`; `payer_type` KH/BH; `idempotency_key`; `origin` NATIVE/LEGACY). Index/unique tổ hợp và FK khai báo ở entity con.
- `engines/` (thuần, không DB): `DebtBalanceEngine` (số dư = phát sinh - đã thu, làm tròn, clamp >= 0; tiền là số nguyên `toMoney`), `DebtAgingEngine` (bucket 0-30 / 31-60 / 61-90 / >90 ngày).
- `services/abstract-debt-flow.service.ts`, `services/abstract-debt-query.service.ts`: khung list có phân trang, `findPage`, `findColumnOptions`, `fetchRawPage`, `resolvePaging` (pageSize tối đa 200).

## 2. Quy tắc
- Một đường tính công nợ duy nhất (thay hai đường cũ ở V1). Module con không tự cộng số dư.
- Ghi (thu, chi, allocation) KHÔNG nằm ở đây; plan orchestration sau sẽ dùng `DebtSettlementPort` và phải khóa `pessimistic_write` trên bản ghi vụ việc.
- File < 180 dòng, có spec cạnh file.

## 3. Bảng và module con
- `debts-garage` kế thừa: `DebtGarage` (`debts_garage`), `DebtAllocationGarage` (`debt_allocations_garage`, FK `debt_id` RESTRICT, unique `idempotency_key`). Không FK `case_id` về V1 để lõi không gắn bảng `kgara_*`.
- Migration `1794900000000-GarageCashflowDebtsV2Tables` đã chạy trên `erp_greenway_staging` ngày 2026-11-17 (ba bảng rỗng, chưa backfill). Production CHƯA chạy.
- Phiếu thu chi dùng lõi riêng `cashflow-vouchers-core` (`BaseCashflowVoucherEntity`), bảng `cashflow_vouchers_garage`.
- Plan: `.agents/plans/garage-cashflow-debts-ledger-v2` (cha) và `garage-ledger-phase1-db`.

## 4. Việc còn mở
`AbstractDebtSettlementService` (cài `DebtSettlementPort`), cổng `DebtOriginPort`, backfill và đối soát: Phase 2 và 3 của plan cha. Chưa có service ghi nào dùng hai bảng này.
