import { toMoney } from '@/v2/core/debts-core';
import type {
  GarageAgingTotals,
  GarageDebtsAnalyticsResponse,
  GarageTopDebtPartner,
} from '../dto/garage-debts-analytics.types';
import {
  buildAgingComparison,
  calculateForecast,
  horizonPair,
} from './garage-debts-horizon.helper';

type Row = Record<string, unknown>;
const num = (v: unknown) => toMoney(v as string | number | null);

const totalsOf = (r: Row): GarageAgingTotals => ({
  d0_30: num(r.aging_0_30),
  d31_60: num(r.aging_31_60),
  d61_90: num(r.aging_61_90),
  over90: num(r.aging_over_90),
});

const toPartner = (r: Row): GarageTopDebtPartner => ({
  partnerCode: String(r.partner_code),
  partnerName: String(r.partner_name),
  totalAmount: num(r.total_amount),
  balanceAmount: num(r.balance_amount),
  overdueAmount: num(r.overdue_amount),
  maxAgingDays: Number(r.max_aging_days) || 0,
  caseCount: Number(r.case_count) || 0,
});

/** Ghép kết quả 5 truy vấn thành response analytics. */
export function buildAnalyticsResponse(
  r: Row,
  p: Row,
  trend: Row[],
  topCust: Row[],
  topSupp: Row[],
): GarageDebtsAnalyticsResponse {
  const rt = totalsOf(r);
  const pt = totalsOf(p);
  const rDue = num(r.due_week);
  const pDue = num(p.due_week);
  const rate = (part: number, whole: number) =>
    whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

  return {
    summary: {
      totalReceivable: num(r.total),
      paidReceivable: num(r.paid),
      remainingReceivable: num(r.remaining),
      totalPayable: num(p.total),
      paidPayable: num(p.paid),
      remainingPayable: num(p.remaining),
      netBalance: num(r.remaining) - num(p.remaining),
      collectionRate: rate(num(r.paid), num(r.total)),
      paymentRate: rate(num(p.paid), num(p.total)),
    },
    agingComparison: buildAgingComparison(rt, pt),
    timeHorizons: {
      nextWeekDue: horizonPair(rDue, pDue),
      nextMonthDue: horizonPair(rt.d0_30, pt.d0_30),
      overdue30To90: horizonPair(rt.d31_60 + rt.d61_90, pt.d31_60 + pt.d61_90),
      criticalOverdue90Plus: horizonPair(rt.over90, pt.over90),
    },
    forecastHorizons: calculateForecast(
      rt,
      pt,
      { receivable: rDue, payable: pDue },
      { receivable: rt.d0_30, payable: pt.d0_30 },
    ),
    cashTrend: trend.map((t) => ({
      label: String(t.month),
      cashIn: num(t.cash_in),
      cashOut: num(t.cash_out),
      netCash: num(t.cash_in) - num(t.cash_out),
    })),
    topReceivableCustomers: topCust.map(toPartner),
    topPayableSuppliers: topSupp.map(toPartner),
  };
}
