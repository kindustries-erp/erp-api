---
name: debts-core
description: Lõi công nợ dùng chung v2 (src/v2/core/debts-core) - hợp đồng, engine tính số dư và tuổi nợ, khung query abstract, cổng DebtSettlementPort cho orchestrator. Đọc trước khi dựng module công nợ mới hoặc sửa cách tính số dư.
---

# debts-core (lõi, không entity, không controller)

Vị trí: `src/v2/core/debts-core`. Không phụ thuộc garage; module công nợ (hiện là `debts-garage`) kế thừa.

## 1. Thành phần
- `contracts/`: `debt-account`, `debt-allocation`, `debt-summary`, `debt-settlement.port` (cổng cho orchestrator: apply, reverse, recalculate), `debt-list.contract` (`DebtListQuery`, `DebtListResult`).
- `engines/` (thuần, không DB): `DebtBalanceEngine` (số dư = phát sinh - đã thu, làm tròn, clamp >= 0; tiền là số nguyên `toMoney`), `DebtAgingEngine` (bucket 0-30 / 31-60 / 61-90 / >90 ngày).
- `services/abstract-debt-flow.service.ts`, `services/abstract-debt-query.service.ts`: khung list có phân trang, `findPage`, `findColumnOptions`, `fetchRawPage`, `resolvePaging` (pageSize tối đa 200).

## 2. Quy tắc
- Một đường tính công nợ duy nhất (thay hai đường cũ ở V1). Module con không tự cộng số dư.
- Ghi (thu, chi, allocation) KHÔNG nằm ở đây; plan orchestration sau sẽ dùng `DebtSettlementPort` và phải khóa `pessimistic_write` trên bản ghi vụ việc.
- File < 180 dòng, có spec cạnh file.

## 3. Việc còn mở
Bảng công nợ và bảng allocation riêng thuộc plan orchestration; chưa tồn tại.
