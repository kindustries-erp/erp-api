import type { KgaraCashflowVoucher } from '@/kgara-api-core/entities/kgara_cashflow_voucher.entity';
import type { CashflowVoucherGarage } from '../../cashflow-vouchers-garage/entities/cashflow-voucher-garage.entity';

export type LegacyPaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'POS' | 'OTHER';

/** Tên phương thức hiển thị (V1 lưu chuỗi tiếng Việt) sang enum của settlement V1. Mặc định tiền mặt. */
export function toLegacyPaymentMethod(
  method?: string | null,
): LegacyPaymentMethod {
  if (method === 'Chuyển khoản') return 'BANK_TRANSFER';
  if (method === 'Quẹt thẻ' || method === 'Thẻ') return 'POS';
  if (method && method !== 'Tiền mặt') return 'OTHER';
  return 'CASH';
}

const orUndefined = <T>(v: T | null | undefined): T | undefined =>
  v ?? undefined;

/** Cột của phiếu V1 từ phiếu v2 (cùng UUID). V1 không có chi nhánh nên cột đó không được mirror. */
export function toLegacyVoucherFields(
  v: CashflowVoucherGarage,
): Partial<KgaraCashflowVoucher> {
  return {
    id: v.id,
    voucherCode: v.voucherCode,
    voucherType: v.voucherType,
    amount: Number(v.amount),
    transDate: v.transDate,
    caseId: orUndefined(v.caseId),
    licensePlate: orUndefined(v.licensePlate),
    paymentMethod: orUndefined(v.paymentMethod),
    paymentContent: orUndefined(v.paymentContent),
    paymentStatus: v.status,
    isAutoExpected: v.isAutoExpected,
    isAutoCommission: v.isAutoCommission,
    partnerName: orUndefined(v.partnerName),
    erpBankTransactionId: orUndefined(v.erpBankTransactionId),
    erpCashVoucherId: orUndefined(v.erpCashVoucherId),
    note: orUndefined(v.note),
    createdBy: orUndefined(v.createdBy),
    pnlPeriodYear: v.pnlPeriodYear ?? null,
    pnlPeriodMonth: v.pnlPeriodMonth ?? null,
    pnlCommissionType: v.pnlCommissionType ?? null,
    pnlCommissionAnchorId: v.pnlCommissionAnchorId ?? null,
  };
}
