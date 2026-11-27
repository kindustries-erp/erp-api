import { planVoucherAllocation } from './voucher-allocation.planner';

/** Dòng phải thu của vụ việc, kèm sức chứa còn lại (nợ gốc trừ phần đã có phân bổ NATIVE). */
export interface LegacyReceivableDebt {
  id: string;
  partyType: string;
  /** Số tiền còn nhận được từ settlement V1 (không âm). */
  capacity: number;
}

/** Một settlement RECEIPT của V1 cần chia vào các dòng phải thu. */
export interface LegacyReceipt {
  id: string;
  /** KH hoặc BH, theo `kgara_case_settlements.payer_type`. */
  payerType: string;
  amount: number;
  transDate: string | null;
  createdAt: string | null;
}

export interface PlannedLegacyAllocation {
  settlementId: string;
  debtId: string;
  amount: number;
  allowOverpay: boolean;
}

/** Thứ tự xử lý cố định: không phụ thuộc thứ tự truyền vào, nên đảo input vẫn cho cùng kết quả. */
function compareReceipts(a: LegacyReceipt, b: LegacyReceipt): number {
  const byDate = (a.transDate ?? '9999').localeCompare(b.transDate ?? '9999');
  if (byDate !== 0) return byDate;
  const byCreated = (a.createdAt ?? '9999').localeCompare(
    b.createdAt ?? '9999',
  );
  if (byCreated !== 0) return byCreated;
  return a.id.localeCompare(b.id);
}

/**
 * Chia các settlement RECEIPT của một vụ việc vào các dòng phải thu (thuần, không DB).
 * - Mỗi khoản thu: dòng của bên trả trước (KH → CUSTOMER, BH → INSURER), phần còn lại sang dòng khác.
 * - Sức chứa của dòng giảm theo các khoản đã chia trước đó; khoản thu dư sau khi đủ mọi dòng
 *   được ghi vào dòng đầu với `allowOverpay` (đúng quy tắc thu dư của luồng NATIVE).
 * - Khoản thu không có dòng phải thu nào thì không tạo phân bổ.
 */
export function planLegacyReceipts(input: {
  debts: LegacyReceivableDebt[];
  receipts: LegacyReceipt[];
}): PlannedLegacyAllocation[] {
  const remaining = new Map(
    [...input.debts]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((d) => [d.id, Math.max(0, d.capacity)]),
  );
  const out: PlannedLegacyAllocation[] = [];

  for (const receipt of [...input.receipts].sort(compareReceipts)) {
    if (!(receipt.amount > 0)) continue;
    const candidates = input.debts
      .map((d) => ({
        id: d.id,
        direction: 'RECEIVABLE' as const,
        partyType: d.partyType,
        balance: remaining.get(d.id) ?? 0,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const plan = planVoucherAllocation({
      voucherType: 'RECEIPT',
      payerType: receipt.payerType,
      amount: receipt.amount,
      candidates,
    });
    for (const item of plan) {
      out.push({
        settlementId: receipt.id,
        debtId: item.debtId,
        amount: item.amount,
        allowOverpay: item.allowOverpay,
      });
      remaining.set(
        item.debtId,
        Math.max(0, (remaining.get(item.debtId) ?? 0) - item.amount),
      );
    }
  }
  return out;
}
