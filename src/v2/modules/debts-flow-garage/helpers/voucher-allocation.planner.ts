import { toMoney } from '@/v2/core/debts-core';

/** Khoản nợ ứng viên của vụ việc (đã loại VOID). */
export interface AllocationCandidate {
  id: string;
  direction: 'RECEIVABLE' | 'PAYABLE';
  partyType: string;
  balance: number;
}

export interface PlannedAllocation {
  debtId: string;
  amount: number;
  /** Phần thu/chi dư so với số dư: tiền đã thực nhận nên vẫn ghi, đánh dấu để cổng cho phép vượt. */
  allowOverpay: boolean;
}

const PAYER_PARTY: Record<string, string> = { KH: 'CUSTOMER', BH: 'INSURER' };

/**
 * Chia số tiền của một phiếu PAID cho các khoản nợ của vụ việc (thuần, không DB):
 * - Phiếu thu: dòng của bên trả (KH → CUSTOMER, BH → INSURER) trước, dòng còn lại sau.
 * - Phiếu chi: dòng phải trả (SUPPLIER).
 * - Mỗi dòng nhận tối đa số dư còn lại; phần dư cuối cùng dồn vào dòng đầu tiên với `allowOverpay`.
 * Không có khoản nợ nào thì trả mảng rỗng (phiếu vẫn ghi, chưa có nợ để phân bổ).
 */
export function planVoucherAllocation(input: {
  voucherType: 'RECEIPT' | 'PAYMENT';
  payerType: string;
  amount: number;
  candidates: AllocationCandidate[];
}): PlannedAllocation[] {
  const direction = input.voucherType === 'RECEIPT' ? 'RECEIVABLE' : 'PAYABLE';
  const pool = input.candidates.filter((c) => c.direction === direction);
  if (pool.length === 0) return [];

  const primary = PAYER_PARTY[input.payerType] ?? 'CUSTOMER';
  const ordered = [...pool].sort(
    (a, b) => Number(b.partyType === primary) - Number(a.partyType === primary),
  );

  const plan: PlannedAllocation[] = [];
  let remaining = toMoney(input.amount);
  for (const debt of ordered) {
    const take = Math.min(remaining, Math.max(0, debt.balance));
    if (take > 0) {
      plan.push({
        debtId: debt.id,
        amount: toMoney(take),
        allowOverpay: false,
      });
      remaining = toMoney(remaining - take);
    }
  }
  if (remaining > 0) {
    const first = plan.find((p) => p.debtId === ordered[0].id);
    if (first) {
      first.amount = toMoney(first.amount + remaining);
      first.allowOverpay = true;
    } else {
      plan.push({
        debtId: ordered[0].id,
        amount: remaining,
        allowOverpay: true,
      });
    }
  }
  return plan;
}
