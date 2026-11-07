import type { GarageCashflowPaymentStatus } from '@/kgara-api-core/dto/garage-cashflow.dto';

/** Nhãn trạng thái thanh toán cũ, dạng chuỗi (tránh so sánh enum với chuỗi). */
export type LegacyPaymentStatus = `${GarageCashflowPaymentStatus}`;

export type LegacyVoucherType = 'RECEIPT' | 'PAYMENT';
export type ForecastDirection = 'IN' | 'OUT';
export type PaymentChannel = 'CASH' | 'BANK' | 'POS' | 'OTHER';

/** Loại phiếu cũ -> chiều dự thu/dự chi mới. */
export function directionOf(voucherType: LegacyVoucherType): ForecastDirection {
  return voucherType === 'RECEIPT' ? 'IN' : 'OUT';
}

/** Chiều mới -> loại phiếu cũ. */
export function voucherTypeOf(direction: ForecastDirection): LegacyVoucherType {
  return direction === 'IN' ? 'RECEIPT' : 'PAYMENT';
}

/**
 * Nhãn trạng thái cũ -> trạng thái header mới. Ngược với toLegacyPaymentStatus:
 * PAID -> SETTLED; OUT: PENDING -> DRAFT, APPROVED -> OPEN; IN: EXPECTED -> OPEN; CANCELLED -> CANCELLED.
 */
export function toForecastStatus(
  direction: ForecastDirection,
  legacyStatus: LegacyPaymentStatus,
): string {
  if (legacyStatus === 'CANCELLED') return 'CANCELLED';
  if (legacyStatus === 'PAID') return 'SETTLED';
  if (direction === 'IN') return 'OPEN';
  return legacyStatus === 'APPROVED' ? 'OPEN' : 'DRAFT';
}

/** Phương thức thanh toán cũ (nhãn tiếng Việt) -> kênh thực thu/chi mới. */
export function toPaymentChannel(
  paymentMethod?: string | null,
): PaymentChannel {
  if (paymentMethod === 'Tiền mặt') return 'CASH';
  if (paymentMethod === 'Chuyển khoản') return 'BANK';
  if (paymentMethod === 'Quẹt thẻ' || paymentMethod === 'Thẻ') return 'POS';
  return 'OTHER';
}

/** Mã phiếu tự sinh theo quy ước cũ: PT-GARA-yymmdd-nnn (thu), PC-GARA-... (chi). */
export function buildLegacyVoucherCode(
  voucherType: LegacyVoucherType,
  now: Date,
  random: () => number = Math.random,
): string {
  const prefix = voucherType === 'RECEIPT' ? 'PT-GARA' : 'PC-GARA';
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '').slice(2);
  const seq = Math.floor(random() * 1000)
    .toString()
    .padStart(3, '0');
  return `${prefix}-${datePart}-${seq}`;
}

/** Phiếu đã chi (PAID) cần có thực thu/chi và phân bổ. */
export function needsPayment(legacyStatus: LegacyPaymentStatus): boolean {
  return legacyStatus === 'PAID';
}
