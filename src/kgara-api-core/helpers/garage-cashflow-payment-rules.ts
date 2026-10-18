export type GarageVoucherType = 'RECEIPT' | 'PAYMENT';
export type GaragePaymentStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'EXPECTED';

export interface GaragePaymentRuleInput {
  voucherType?: GarageVoucherType | string | null;
  paymentStatus?: GaragePaymentStatus | string | null;
  paymentContent?: string | null;
}

export const PAYMENT_CONTENT_HHBH = '4. HHBH';
export const PAYMENT_CONTENT_CONSUMABLES = '10. Vật tư tiêu hao';
export const PAYMENT_CONTENT_CONSUMABLES_LEGACY = '8. Vật tư tiêu hao';

/** Nội dung chi ghi vào garage-opex (nhóm Giá vốn) thay vì trừ công nợ garage. */
export const OPEX_ROUTED_PAYMENT_CONTENTS: Record<
  string,
  { categoryKey: string; categoryName: string }
> = {
  [PAYMENT_CONTENT_HHBH]: {
    categoryKey: 'HHBH',
    categoryName: 'HHBH',
  },
  [PAYMENT_CONTENT_CONSUMABLES]: {
    categoryKey: 'VAT_TU_TIEU_HAO',
    categoryName: 'Vật tư tiêu hao',
  },
  [PAYMENT_CONTENT_CONSUMABLES_LEGACY]: {
    categoryKey: 'VAT_TU_TIEU_HAO',
    categoryName: 'Vật tư tiêu hao',
  },
};

const isOpexRoutedContent = (content?: string | null): boolean =>
  !!content &&
  Object.prototype.hasOwnProperty.call(OPEX_ROUTED_PAYMENT_CONTENTS, content);

/** Phiếu chi chỉ trừ công nợ garage khi Đã chi và nội dung không thuộc nhóm 4/8. */
export function isDebtOffsetPayment(v: GaragePaymentRuleInput): boolean {
  return (
    v.voucherType === 'PAYMENT' &&
    v.paymentStatus === 'PAID' &&
    !isOpexRoutedContent(v.paymentContent)
  );
}

/** Phiếu thu trừ công nợ garage khi không phải là Dự thu (EXPECTED). */
export function isReceiptSettled(v: GaragePaymentRuleInput): boolean {
  return v.voucherType === 'RECEIPT' && v.paymentStatus !== 'EXPECTED';
}

/** Phiếu thu có settlement khi không phải Dự thu; phiếu chi chỉ khi Đã chi và không thuộc nhóm 4/8. */
export function shouldHaveSettlement(v: GaragePaymentRuleInput): boolean {
  if (v.voucherType === 'RECEIPT') {
    return isReceiptSettled(v);
  }
  return isDebtOffsetPayment(v);
}

/** Phiếu chi 4/8 đã duyệt hoặc đã chi được ghi vào garage-opex. */
export function isRecordedToOpex(v: GaragePaymentRuleInput): boolean {
  return (
    v.voucherType === 'PAYMENT' &&
    (v.paymentStatus === 'APPROVED' || v.paymentStatus === 'PAID') &&
    isOpexRoutedContent(v.paymentContent)
  );
}

/** Phiếu chi đã Đã chi thì khóa trạng thái thanh toán và loại phiếu. */
export function isPaymentLocked(v: GaragePaymentRuleInput): boolean {
  return v.voucherType === 'PAYMENT' && v.paymentStatus === 'PAID';
}

export function getOpexCategoryForContent(content?: string | null) {
  return isOpexRoutedContent(content)
    ? OPEX_ROUTED_PAYMENT_CONTENTS[content as string]
    : null;
}
