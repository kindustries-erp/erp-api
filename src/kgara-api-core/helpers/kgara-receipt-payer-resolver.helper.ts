/**
 * Chọn bên thanh toán (KH / BH) cho một khoản thu gắn phiếu dịch vụ.
 * - explicit thắng.
 * - Phiếu không có phần BH: luôn KH.
 * - Số tiền khớp phần BH còn thiếu (sai số cho phép): BH.
 * - Còn lại: KH.
 */

export type ReceiptPayerType = 'KH' | 'BH';

export interface ResolveReceiptPayerInput {
  explicit?: ReceiptPayerType | null;
  amount: number;
  /** Phần BH phải thu của phiếu. */
  dueBH: number;
  /** Tổng các khoản thu đã gắn BH của phiếu (không tính khoản đang xét). */
  paidBH: number;
  tolerance?: number;
}

const DEFAULT_TOLERANCE = 1000;

export function resolveReceiptPayerType(
  input: ResolveReceiptPayerInput,
): ReceiptPayerType {
  if (input.explicit === 'KH' || input.explicit === 'BH') return input.explicit;
  if (!(input.dueBH > 0)) return 'KH';
  const left = input.dueBH - input.paidBH;
  if (left <= 0) return 'KH';
  const tolerance = input.tolerance ?? DEFAULT_TOLERANCE;
  return Math.abs(Number(input.amount) - left) <= tolerance ? 'BH' : 'KH';
}
