import type { KgaraCashflowVoucher } from '@/kgara-api-core/entities/kgara_cashflow_voucher.entity';
import type { CashflowVoucherGarage } from '../../cashflow-vouchers-garage/entities/cashflow-voucher-garage.entity';

export {
  toLegacyPaymentMethod,
  type LegacyPaymentMethod,
} from '@/kgara-api-core/helpers/garage-cashflow-catalog';

/** Trống thì ghi null để xóa ở V1; undefined sẽ bị TypeORM bỏ qua và giữ giá trị cũ. */
export const orNull = <T>(v: T | null | undefined): T => (v ?? null) as T;

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
    caseId: orNull(v.caseId),
    licensePlate: orNull(v.licensePlate),
    paymentMethod: orNull(v.paymentMethod),
    paymentContent: orNull(v.paymentContent),
    paymentStatus: v.status,
    isAutoExpected: v.isAutoExpected,
    isAutoCommission: v.isAutoCommission,
    partnerName: orNull(v.partnerName),
    erpBankTransactionId: orNull(v.erpBankTransactionId),
    erpCashVoucherId: orNull(v.erpCashVoucherId),
    note: orNull(v.note),
    createdBy: v.createdBy ?? undefined,
    pnlPeriodYear: v.pnlPeriodYear ?? null,
    pnlPeriodMonth: v.pnlPeriodMonth ?? null,
    pnlCommissionType: v.pnlCommissionType ?? null,
    pnlCommissionAnchorId: v.pnlCommissionAnchorId ?? null,
  };
}
