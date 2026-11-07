/**
 * Quy tắc thuần của DNTT và thực chi (không đụng DB). Tiền tính bằng xu (số nguyên) để tránh sai số float.
 */

export const toCents = (amount: string | number): number =>
  Math.round(Number(amount) * 100);

export const fromCents = (cents: number): string => (cents / 100).toFixed(2);

export interface PayableLine {
  id: string;
  /** Số tiền của dòng DNTT (xu). */
  amountCents: number;
  /** Đã chi cho dòng này trước đó (xu). */
  paidCents: number;
}

export interface LineAllocation {
  lineId: string;
  amountCents: number;
}

/**
 * Chia một khoản chi vào các dòng theo thứ tự truyền vào, mỗi dòng không vượt phần còn lại.
 * Ném lỗi nếu khoản chi lớn hơn tổng còn lại.
 */
export function allocatePaymentToLines(
  lines: PayableLine[],
  amountCents: number,
): LineAllocation[] {
  if (amountCents <= 0) {
    throw new Error('Số tiền chi phải lớn hơn 0');
  }
  const remainingTotal = lines.reduce(
    (sum, l) => sum + Math.max(0, l.amountCents - l.paidCents),
    0,
  );
  if (amountCents > remainingTotal) {
    throw new Error(
      `Số tiền chi vượt phần còn lại của đề nghị (còn ${fromCents(remainingTotal)})`,
    );
  }
  const out: LineAllocation[] = [];
  let left = amountCents;
  for (const line of lines) {
    if (left <= 0) break;
    const room = Math.max(0, line.amountCents - line.paidCents);
    const take = Math.min(room, left);
    if (take > 0) {
      out.push({ lineId: line.id, amountCents: take });
      left -= take;
    }
  }
  return out;
}

/** Trạng thái DNTT sau khi tổng thực chi thay đổi. Chưa duyệt / đã hủy thì giữ nguyên. */
export function paymentRequestStatusAfter(
  totalCents: number,
  paidCents: number,
  currentStatus: string,
): string {
  if (
    currentStatus !== 'APPROVED' &&
    currentStatus !== 'PARTIAL' &&
    currentStatus !== 'PAID'
  ) {
    return currentStatus;
  }
  if (paidCents <= 0) return 'APPROVED';
  if (paidCents < totalCents) return 'PARTIAL';
  return 'PAID';
}

/** payment_status của chứng từ nguồn (PO garage): UNPAID / PARTIAL / PAID. */
export function sourcePaymentStatus(
  capCents: number,
  paidCents: number,
): string {
  if (paidCents <= 0) return 'UNPAID';
  if (paidCents < capCents) return 'PARTIAL';
  return 'PAID';
}

/** Phần còn lại có thể chi của một chứng từ nguồn, trừ các dòng DNTT đang hiệu lực. */
export function remainingCapacityCents(
  capCents: number,
  activeLinesCents: number,
): number {
  return Math.max(0, capCents - activeLinesCents);
}
