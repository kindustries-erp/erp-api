import { toMoney } from '@/v2/core/debts-core';
import { SupplierDebtRow } from '../dto/supplier-debt-row.dto';

export function toSupplierDebtRow(r: Record<string, unknown>): SupplierDebtRow {
  const num = (v: unknown) => toMoney(v as string | number | null);
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  const plate = text(r.license_plate);
  const licensePlate = plate;
  const code = text(r.customer_code) || 'UNKNOWN';
  return {
    id: licensePlate || `${code}_no_bks`,
    licensePlate,
    customerCode: code,
    customerName: text(r.customer_name) || 'Chưa xác định',
    branchExternalId: text(r.branch_external_id),
    caseCount: Number(r.case_count) || 0,
    vehicleCount: Number(r.vehicle_count) || (licensePlate ? 1 : 0),
    costAmount: num(r.cost_amount),
    paidAmount: num(r.paid_amount),
    balanceAmount: num(r.balance_amount),
    latestDate: (r.latest_date as string | null) ?? null,
    oldestDate: (r.oldest_date as string | null) ?? null,
    maxAgingDays: Number(r.max_aging_days) || 0,
    aging0_30: num(r.aging_0_30),
    aging31_60: num(r.aging_31_60),
    aging61_90: num(r.aging_61_90),
    agingOver90: num(r.aging_over_90),
  };
}
