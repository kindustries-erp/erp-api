import {
  resolveReceiptPayerType,
  type ReceiptPayerType,
} from './kgara-receipt-payer-resolver.helper';

/**
 * Lập kế hoạch gắn payer_type cho các khoản thu (RECEIPT) cũ của một phiếu dịch vụ.
 * Chỉ đổi khoản đang là KH sang BH khi số tiền khớp phần BH còn thiếu (cùng quy tắc writer).
 * Phiếu có phần BH nhưng không khoản nào khớp được xếp vào "mơ hồ", không đổi gì.
 */

export interface BackfillReceipt {
  id: string;
  amount: number;
  payerType: string | null;
}

export interface BackfillPlan {
  /** Khoản đổi từ KH sang BH. */
  changes: Array<{ id: string; from: string | null; to: ReceiptPayerType }>;
  /** Phiếu có phần BH, đã có thu nhưng không khoản nào gắn được BH. */
  ambiguous: boolean;
}

export function planReceiptPayerBackfill(
  receipts: BackfillReceipt[],
  dueBH: number,
): BackfillPlan {
  if (!(dueBH > 0) || receipts.length === 0) {
    return { changes: [], ambiguous: false };
  }
  let paidBH = receipts
    .filter((r) => r.payerType === 'BH')
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const changes: BackfillPlan['changes'] = [];
  for (const r of receipts) {
    if (r.payerType !== 'KH') continue;
    const amount = Number(r.amount) || 0;
    const to = resolveReceiptPayerType({ amount, dueBH, paidBH });
    if (to === 'BH') {
      changes.push({ id: r.id, from: r.payerType, to });
      paidBH += amount;
    }
  }
  const hasBH = paidBH > 0;
  return { changes, ambiguous: !hasBH };
}
