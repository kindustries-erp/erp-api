/**
 * Phân bổ các khoản thu (settlement RECEIPT) của một phiếu cho KH và BH.
 *
 * Phiếu thu hiện luôn được ghi payer_type = 'KH' (garage-cashflow-transaction.service),
 * kể cả khi tiền do công ty bảo hiểm trả. Hàm này suy ra bên trả khi đọc, không sửa dữ liệu:
 * 1. Khoản đã ghi rõ payer 'BH' giữ nguyên là BH.
 * 2. Trong các khoản còn lại, khoản có số tiền khớp phần BH còn thiếu (sai số cho phép) tính cho BH.
 * 3. Phần còn lại tính cho KH trước, tối đa bằng phần KH phải thu; phần vượt chuyển cho BH.
 * Tổng kh + bh luôn bằng tổng các khoản thu.
 */

export interface ReceiptItem {
  amount: number;
  payerType?: string | null;
}

export interface PayerAllocation {
  kh: number;
  bh: number;
}

const DEFAULT_TOLERANCE = 1000;

export function allocateReceiptsToPayers(
  receipts: ReceiptItem[],
  dueKH: number,
  dueBH: number,
  tolerance: number = DEFAULT_TOLERANCE,
): PayerAllocation {
  const total = receipts.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  if (dueBH <= 0) return { kh: total, bh: 0 };

  let bh = 0;
  const rest: number[] = [];
  for (const r of receipts) {
    const amt = Number(r.amount) || 0;
    if (r.payerType === 'BH') bh += amt;
    else rest.push(amt);
  }

  const bhDueLeft = Math.max(0, dueBH - bh);
  if (bhDueLeft > 0) {
    const idx = rest.findIndex((a) => Math.abs(a - bhDueLeft) <= tolerance);
    if (idx >= 0) {
      bh += rest[idx];
      rest.splice(idx, 1);
    }
  }

  const restTotal = rest.reduce((s, a) => s + a, 0);
  const kh = Math.min(Math.max(0, dueKH), restTotal);
  bh += restTotal - kh;
  return { kh, bh };
}
