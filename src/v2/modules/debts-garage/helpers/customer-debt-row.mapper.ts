import { toMoney } from '@/v2/core/debts-core';
import { CustomerDebtRow } from '../dto/customer-debt-row.dto';

export function toCustomerDebtRow(r: Record<string, unknown>): CustomerDebtRow {
  const num = (v: unknown) => toMoney(v as string | number | null);
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  const plate = text(r.bien_so_xe);
  return {
    licensePlate: plate,
    customerCode: text(r.khach_hang_code),
    customerName: text(r.khach_hang_name),
    branchExternalId: (r.branch_external_id as string | null) ?? null,
    caseCount: Number(r.so_phieu) || 0,
    totalAmount: num(r.tong_doanh_thu),
    paidAmount: num(r.da_thanh_toan),
    balanceAmount: num(r.con_phai_thu),
    latestDate: (r.ngay_gan_nhat as string | null) ?? null,
    oldestDate: (r.ngay_xa_nhat as string | null) ?? null,
    maxAgingDays: Number(r.max_aging_days) || 0,
    aging0_30: num(r.aging_0_30),
    aging31_60: num(r.aging_31_60),
    aging61_90: num(r.aging_61_90),
    agingOver90: num(r.aging_over_90),
  };
}
