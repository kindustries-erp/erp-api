import { BadRequestException } from '@nestjs/common';

export type CashBankRelatedDocumentLike = {
  related_type?: string | null;
  related_id?: string | null;
  amount?: number | string | null;
};

export type CashBankSettlementLinkLike = {
  amount?: number | string | null;
  payment_voucher_id?: string | null | { status?: string | null };
};

const ELIGIBLE_SETTLEMENT_VOUCHER_STATUSES = new Set(['APPROVED', 'POSTED']);

export function normalizeCashBankAmount(
  input: number | string | null | undefined,
) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  if (typeof input !== 'string') return 0;

  const value = input.trim();
  if (!value) return 0;

  const hasComma = value.includes(',');
  const hasDot = value.includes('.');
  const normalized = hasComma
    ? value.replace(/\./g, '').replace(',', '.')
    : hasDot && /^\d{1,3}(\.\d{3})+$/.test(value)
      ? value.replace(/\./g, '')
      : value;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateArDocumentSettlement(
  totalAmountInput: number | string | null | undefined,
  linkedAmounts: Array<number | string | null | undefined>,
) {
  const totalAmount = normalizeCashBankAmount(totalAmountInput);
  const linkedAmount = linkedAmounts.reduce<number>(
    (sum, amount) => sum + normalizeCashBankAmount(amount),
    0,
  );
  const settledAmount = Math.min(totalAmount, linkedAmount);
  const openAmount = Math.max(totalAmount - settledAmount, 0);
  const status =
    settledAmount <= 0
      ? 'POSTED'
      : settledAmount >= totalAmount
        ? 'SETTLED'
        : 'PARTIAL';
  return { settledAmount, openAmount, status };
}

export function filterEligibleCashBankSettlementLinks<
  T extends CashBankSettlementLinkLike,
>(links: T[]) {
  return links.filter((link) => {
    const voucher = link.payment_voucher_id;
    const status =
      typeof voucher === 'object' && voucher ? voucher.status : undefined;
    return ELIGIBLE_SETTLEMENT_VOUCHER_STATUSES.has(
      String(status || '').toUpperCase(),
    );
  });
}

export function validateCashBankRelatedArDocuments({
  voucherAmount,
  relatedDocuments,
}: {
  voucherAmount: number | string | null | undefined;
  relatedDocuments: CashBankRelatedDocumentLike[] | undefined;
}) {
  const docs = (relatedDocuments || []).filter(
    (doc) => doc.related_type === 'ar_documents',
  );
  for (const doc of docs) {
    const amount = normalizeCashBankAmount(doc.amount);
    if (amount <= 0) {
      throw new BadRequestException('Số tiền cấn trừ công nợ phải lớn hơn 0');
    }
  }
  const totalRelatedAmount = docs.reduce(
    (sum, doc) => sum + normalizeCashBankAmount(doc.amount),
    0,
  );
  const paymentAmount = normalizeCashBankAmount(voucherAmount);
  if (totalRelatedAmount > paymentAmount) {
    throw new BadRequestException(
      'Tổng số tiền cấn trừ công nợ không được vượt quá số tiền phiếu',
    );
  }
}
