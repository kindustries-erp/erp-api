import { BadRequestException } from '@nestjs/common';

export type CashBankRelatedDocumentLike = {
  related_type?: string | null;
  related_id?: string | null;
  amount?: number | string | null;
};

export function calculateArDocumentSettlement(totalAmountInput: number | string | null | undefined, linkedAmounts: Array<number | string | null | undefined>) {
  const totalAmount = Number(totalAmountInput) || 0;
  const linkedAmount = linkedAmounts.reduce<number>((sum, amount) => sum + (Number(amount) || 0), 0);
  const settledAmount = Math.min(totalAmount, linkedAmount);
  const openAmount = Math.max(totalAmount - settledAmount, 0);
  const status = settledAmount <= 0 ? 'POSTED' : settledAmount >= totalAmount ? 'SETTLED' : 'PARTIAL';
  return { settledAmount, openAmount, status };
}

export function validateCashBankRelatedArDocuments({
  voucherAmount,
  relatedDocuments,
}: {
  voucherAmount: number | string | null | undefined;
  relatedDocuments: CashBankRelatedDocumentLike[] | undefined;
}) {
  const docs = (relatedDocuments || []).filter((doc) => doc.related_type === 'ar_documents');
  for (const doc of docs) {
    const amount = Number(doc.amount) || 0;
    if (amount <= 0) {
      throw new BadRequestException('Số tiền cấn trừ công nợ phải lớn hơn 0');
    }
  }
  const totalRelatedAmount = docs.reduce((sum, doc) => sum + (Number(doc.amount) || 0), 0);
  const paymentAmount = Number(voucherAmount) || 0;
  if (totalRelatedAmount > paymentAmount) {
    throw new BadRequestException('Tổng số tiền cấn trừ công nợ không được vượt quá số tiền phiếu');
  }
}
