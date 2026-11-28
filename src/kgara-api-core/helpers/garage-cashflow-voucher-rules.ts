/**
 * Luật nhập phiếu thu chi garage, dùng chung cho API v1 và v2.
 * Kiểm trên trạng thái sau khi merge; `previous` là trạng thái đang lưu (bỏ trống khi tạo mới).
 * Phiếu hệ thống tự sinh ghi thẳng repository nên không đi qua đây.
 */
import { BadRequestException } from '@nestjs/common';

import {
  GARAGE_FORECAST_RECEIPT_CONTENT,
  GARAGE_PAYMENT_METHODS,
  getGarageContentsForType,
  requiresCase,
} from './garage-cashflow-catalog';
import {
  PAYMENT_CONTENT_CONSUMABLES_LEGACY,
  PAYMENT_CONTENT_DV_COMMISSION_LEGACY,
} from './garage-cashflow-payment-rules';

export interface GarageVoucherRuleState {
  voucherType?: string | null;
  paymentStatus?: string | null;
  amount?: number | string | null;
  paymentMethod?: string | null;
  paymentContent?: string | null;
  caseId?: string | null;
  note?: string | null;
}

/** Nhãn chi cũ: không còn chọn được nhưng phiếu đang lưu vẫn được giữ. */
const LEGACY_PAYMENT_CONTENTS: readonly string[] = [
  PAYMENT_CONTENT_CONSUMABLES_LEGACY,
  PAYMENT_CONTENT_DV_COMMISSION_LEGACY,
];

const text = (value?: string | null): string => value?.trim() ?? '';

/** Phiếu cũ không có trạng thái được hiểu như service đang hiểu, để việc bù trạng thái không tính là đổi. */
function comparable(
  state: GarageVoucherRuleState,
  key: keyof GarageVoucherRuleState,
): string {
  if (key === 'paymentStatus' && !state.paymentStatus) {
    return state.voucherType === 'PAYMENT' ? 'PENDING' : 'PAID';
  }
  return String(state[key] ?? '');
}

function assertContentMatchesType(
  next: GarageVoucherRuleState,
  previous?: GarageVoucherRuleState,
): void {
  const content = text(next.paymentContent);
  if (!content) return;

  const isPayment = next.voucherType === 'PAYMENT';
  if (getGarageContentsForType(next.voucherType ?? '').includes(content)) {
    return;
  }
  if (
    !isPayment &&
    next.paymentStatus === 'EXPECTED' &&
    content === GARAGE_FORECAST_RECEIPT_CONTENT
  ) {
    return;
  }
  if (
    isPayment &&
    previous?.voucherType === 'PAYMENT' &&
    text(previous.paymentContent) === content &&
    LEGACY_PAYMENT_CONTENTS.includes(content)
  ) {
    return;
  }
  throw new BadRequestException(
    `Nội dung thanh toán "${content}" không dùng cho phiếu ${isPayment ? 'chi' : 'thu'}. Hãy chọn lại nội dung.`,
  );
}

export function assertGarageVoucherRules(
  next: GarageVoucherRuleState,
  previous?: GarageVoucherRuleState,
): void {
  if (next.paymentStatus === 'CANCELLED') return;

  const changed = (...keys: (keyof GarageVoucherRuleState)[]): boolean =>
    !previous ||
    keys.some((key) => comparable(next, key) !== comparable(previous, key));

  if (!(Number(next.amount) > 0)) {
    throw new BadRequestException('Số tiền phải lớn hơn 0.');
  }

  const isReceipt = next.voucherType === 'RECEIPT';
  const isSettled =
    next.paymentStatus === 'PAID' || (isReceipt && !next.paymentStatus);
  if (isSettled) {
    const label = isReceipt ? 'Phiếu đã thu' : 'Phiếu đã chi';
    if (!text(next.paymentMethod)) {
      throw new BadRequestException(`${label} phải có phương thức thanh toán.`);
    }
    if (!text(next.paymentContent)) {
      throw new BadRequestException(`${label} phải có nội dung thanh toán.`);
    }
  }

  if (changed('voucherType', 'paymentContent', 'paymentStatus')) {
    assertContentMatchesType(next, previous);
  }

  const method = text(next.paymentMethod);
  if (
    method &&
    changed('paymentMethod') &&
    !GARAGE_PAYMENT_METHODS.includes(method)
  ) {
    throw new BadRequestException(
      `Phương thức thanh toán "${method}" không hợp lệ.`,
    );
  }

  if (
    changed('paymentContent', 'caseId', 'note') &&
    requiresCase(text(next.paymentContent)) &&
    !next.caseId &&
    !text(next.note)
  ) {
    throw new BadRequestException(
      `Nội dung "${text(next.paymentContent)}" cần gắn phiếu dịch vụ. Nếu chưa có (thu trước, trả gộp), hãy ghi lý do vào Ghi chú.`,
    );
  }
}
