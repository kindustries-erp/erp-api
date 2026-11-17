import type { DebtAllocation } from '../contracts/debt-allocation.contract';
import type { BaseDebtAllocationEntity } from '../entities/base-debt-allocation.entity';
import { toMoney } from '../engines/debt-balance.engine';

/** Map entity phân bổ sang contract (số tiền là number, không lộ entity ra ngoài). */
export function toDebtAllocation(
  row: BaseDebtAllocationEntity,
): DebtAllocation {
  return {
    id: row.id,
    debtId: row.debtId,
    sourceType: row.sourceType,
    sourceId: row.sourceId ?? null,
    amount: toMoney(row.amount),
    idempotencyKey: row.idempotencyKey,
    allocatedAt: row.createdAt,
    reversedAt: row.reversedAt ?? null,
  };
}

/** `status` của dòng nợ: VOID giữ nguyên, còn lại SETTLED khi hết dư, ngược lại OPEN. */
export function nextDebtStatus(current: string, balance: number): string {
  if (current === 'VOID') return current;
  return balance === 0 ? 'SETTLED' : 'OPEN';
}
