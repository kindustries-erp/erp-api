import type {
  GarageAgingComparisonItem,
  GarageAgingTotals,
  GarageForecastHorizons,
  GarageTimeHorizonItem,
} from '../dto/garage-debts-analytics.types';

const pair = (receivable: number, payable: number): GarageTimeHorizonItem => ({
  receivable,
  payable,
  net: receivable - payable,
});

/** Điều kiện SQL lọc vụ việc theo mốc thời gian; `alias` là bí danh bảng `kgara_cases`. */
export function getHorizonCaseSqlCondition(
  horizon: string,
  alias: string,
): string {
  const age = `(CURRENT_DATE - DATE(${alias}.ngay_hoan_thanh_cong_viec))`;
  const due = `(DATE(${alias}.ngay_hoan_thanh_cong_viec) + INTERVAL '30 days')::date`;
  switch (horizon) {
    case 'nextWeekDue':
      return `${age} <= 7`;
    case 'nextMonthDue':
      return `${age} <= 30`;
    case 'overdue30To90':
      return `${age} > 30 AND ${age} <= 90`;
    case 'criticalOverdue90Plus':
      return `${age} > 90`;
    case 'forecastNext7Days':
      return `${due} <= (CURRENT_DATE + INTERVAL '7 days')::date`;
    case 'forecastNext30Days':
      return `${due} <= (CURRENT_DATE + INTERVAL '30 days')::date`;
    default:
      return '1=1';
  }
}

const HORIZON_TITLES: Record<string, string> = {
  nextWeekDue: 'Mới phát sinh (≤ 7 ngày)',
  nextMonthDue: 'Trong hạn chuẩn (≤ 30 ngày)',
  overdue30To90: 'Quá hạn 31-90 ngày',
  criticalOverdue90Plus: 'Quá hạn >90 ngày',
  forecastNext7Days: 'Dự báo 7 ngày tới (T+7)',
  forecastNext30Days: 'Kế hoạch 30 ngày tới (T+30)',
  expectedCashflow: 'Dòng tiền kỳ vọng (IFRS 9)',
  defaultRiskProvision: 'Dự phòng rủi ro nợ (IFRS 9)',
};

export const getHorizonTitle = (horizon: string): string =>
  HORIZON_TITLES[horizon] ?? 'Mốc thời gian';

const BRACKETS: Array<{
  bracket: GarageAgingComparisonItem['bracket'];
  label: string;
  key: keyof GarageAgingTotals;
}> = [
  { bracket: '0_30', label: '0-30 ngày', key: 'd0_30' },
  { bracket: '31_60', label: '31-60 ngày', key: 'd31_60' },
  { bracket: '61_90', label: '61-90 ngày', key: 'd61_90' },
  { bracket: 'over_90', label: '>90 ngày', key: 'over90' },
];

/** So sánh phải thu và phải trả theo 4 mốc tuổi nợ. */
export function buildAgingComparison(
  receivable: GarageAgingTotals,
  payable: GarageAgingTotals,
): GarageAgingComparisonItem[] {
  return BRACKETS.map(({ bracket, label, key }) => ({
    bracket,
    label,
    receivableAmount: receivable[key],
    payableAmount: payable[key],
    netAmount: receivable[key] - payable[key],
  }));
}

/** Hệ số thu/chi kỳ vọng và hệ số rủi ro theo mốc (IFRS 9 ECL), giữ nguyên như V1. */
const RECEIVABLE_EXPECTED = [0.85, 0.6, 0.3, 0.1];
const PAYABLE_EXPECTED = [0.95, 0.85, 0.7, 0.5];
const RECEIVABLE_RISK = [0.15, 0.4, 0.7, 0.9];
const PAYABLE_RISK = [0.05, 0.15, 0.3, 0.5];

const weighted = (t: GarageAgingTotals, w: number[]): number =>
  Math.round(
    t.d0_30 * w[0] + t.d31_60 * w[1] + t.d61_90 * w[2] + t.over90 * w[3],
  );

/** Dự báo dòng tiền và dự phòng rủi ro. `due7` và `due30` là số dư đến hạn trong 7 và 30 ngày. */
export function calculateForecast(
  receivable: GarageAgingTotals,
  payable: GarageAgingTotals,
  due7: { receivable: number; payable: number },
  due30: { receivable: number; payable: number },
): GarageForecastHorizons {
  const riskRec = weighted(receivable, RECEIVABLE_RISK);
  const riskPay = weighted(payable, PAYABLE_RISK);
  return {
    next7Days: pair(due7.receivable, due7.payable),
    next30Days: pair(due30.receivable, due30.payable),
    expectedCashflow: pair(
      weighted(receivable, RECEIVABLE_EXPECTED),
      weighted(payable, PAYABLE_EXPECTED),
    ),
    defaultRiskProvision: {
      receivableRisk: riskRec,
      payableRisk: riskPay,
      netRisk: riskRec - riskPay,
    },
  };
}

export { pair as horizonPair };
