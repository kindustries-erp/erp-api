import { toMoney } from '@/v2/core/debts-core';
import type { CashflowVoucherGarageRow } from '../dto/cashflow-voucher-garage.types';
import type { CashflowVoucherGarage } from '../entities/cashflow-voucher-garage.entity';

/** Map entity sang dòng response: số tiền number, không lộ cột nội bộ (`pnl_*`, liên kết ngân hàng). */
export function toCashflowVoucherRow(
  v: CashflowVoucherGarage,
): CashflowVoucherGarageRow {
  return {
    id: v.id,
    branchExternalId: v.branchExternalId,
    voucherCode: v.voucherCode,
    voucherType: v.voucherType,
    status: v.status,
    transDate: v.transDate,
    amount: toMoney(v.amount),
    caseId: v.caseId ?? null,
    licensePlate: v.licensePlate ?? null,
    paymentMethod: v.paymentMethod ?? null,
    paymentContent: v.paymentContent ?? null,
    partnerName: v.partnerName ?? null,
    payerType: v.payerType,
    note: v.note ?? null,
    source: v.source,
    createdBy: v.createdBy ?? null,
    isAutoExpected: v.isAutoExpected,
    createdAt: new Date(v.createdAt).toISOString(),
  };
}
