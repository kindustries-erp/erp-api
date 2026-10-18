import {
  GarageAgingComparisonItem,
  GarageForecastHorizonsOverview,
} from '../dto/garage-debts-analytics.dto';

/**
 * Trả về SQL condition lọc vụ việc theo từng Mốc thời gian (Time Horizon)
 */
export function getHorizonCaseSqlCondition(
  horizon: string,
  alias: string = 'case',
): string {
  const dateExpr = `DATE(${alias}.ngay_hoan_thanh_cong_viec)`;
  switch (horizon) {
    case 'nextWeekDue':
      return `(CURRENT_DATE - ${dateExpr}) <= 7`;
    case 'nextMonthDue':
      return `(CURRENT_DATE - ${dateExpr}) <= 30`;
    case 'overdue30To90':
      return `(CURRENT_DATE - ${dateExpr}) > 30 AND (CURRENT_DATE - ${dateExpr}) <= 90`;
    case 'criticalOverdue90Plus':
      return `(CURRENT_DATE - ${dateExpr}) > 90`;
    case 'forecastNext7Days':
      return `(${dateExpr} + INTERVAL '30 days')::date <= (CURRENT_DATE + INTERVAL '7 days')::date`;
    case 'forecastNext30Days':
      return `(${dateExpr} + INTERVAL '30 days')::date <= (CURRENT_DATE + INTERVAL '30 days')::date`;
    case 'expectedCashflow':
    case 'defaultRiskProvision':
    default:
      return '1=1';
  }
}

/**
 * Trả về SQL condition lọc công nợ nhà cung cấp theo từng Mốc thời gian (Time Horizon)
 */
export function getHorizonPayableSqlCondition(
  horizon: string,
  alias: string = 'p',
): string {
  const dateExpr = `DATE(COALESCE(${alias}.period_to, ${alias}.period_from, ${alias}.created_at))`;
  switch (horizon) {
    case 'nextWeekDue':
      return `(CURRENT_DATE - ${dateExpr}) <= 7`;
    case 'nextMonthDue':
      return `(CURRENT_DATE - ${dateExpr}) <= 30`;
    case 'overdue30To90':
      return `(CURRENT_DATE - ${dateExpr}) > 30 AND (CURRENT_DATE - ${dateExpr}) <= 90`;
    case 'criticalOverdue90Plus':
      return `(CURRENT_DATE - ${dateExpr}) > 90`;
    case 'forecastNext7Days':
      return `(${dateExpr} + INTERVAL '30 days')::date <= (CURRENT_DATE + INTERVAL '7 days')::date`;
    case 'forecastNext30Days':
      return `(${dateExpr} + INTERVAL '30 days')::date <= (CURRENT_DATE + INTERVAL '30 days')::date`;
    case 'expectedCashflow':
    case 'defaultRiskProvision':
    default:
      return '1=1';
  }
}

/**
 * Trả về nhãn hiển thị tiếng Việt của từng Mốc thời gian
 */
export function getHorizonTitle(horizon: string): string {
  switch (horizon) {
    case 'nextWeekDue':
      return 'Mới phát sinh (≤ 7 ngày)';
    case 'nextMonthDue':
      return 'Trong hạn chuẩn (≤ 30 ngày)';
    case 'overdue30To90':
      return 'Quá hạn 31-90 ngày';
    case 'criticalOverdue90Plus':
      return 'Quá hạn >90 ngày';
    case 'forecastNext7Days':
      return 'Dự báo 7 ngày tới (T+7)';
    case 'forecastNext30Days':
      return 'Kế hoạch 30 ngày tới (T+30)';
    case 'expectedCashflow':
      return 'Dòng tiền kỳ vọng (IFRS 9)';
    case 'defaultRiskProvision':
      return 'Dự phòng rủi ro nợ (IFRS 9)';
    default:
      return 'Mốc thời gian';
  }
}

/**
 * Xây dựng danh sách 4 phân khoảng tuổi nợ so sánh Phải thu KH vs Phải trả NCC
 */
export function buildAgingComparisonMatrix(
  r0_30: number,
  r31_60: number,
  r61_90: number,
  rOver90: number,
  p0_30: number,
  p31_60: number,
  p61_90: number,
  pOver90: number,
): GarageAgingComparisonItem[] {
  return [
    {
      bracket: '0_30',
      label: '0-30 ngày',
      receivableAmount: r0_30,
      payableAmount: p0_30,
      netAmount: r0_30 - p0_30,
    },
    {
      bracket: '31_60',
      label: '31-60 ngày',
      receivableAmount: r31_60,
      payableAmount: p31_60,
      netAmount: r31_60 - p31_60,
    },
    {
      bracket: '61_90',
      label: '61-90 ngày',
      receivableAmount: r61_90,
      payableAmount: p61_90,
      netAmount: r61_90 - p61_90,
    },
    {
      bracket: 'over_90',
      label: '>90 ngày',
      receivableAmount: rOver90,
      payableAmount: pOver90,
      netAmount: rOver90 - pOver90,
    },
  ];
}

/**
 * Tính toán Dự báo Dòng tiền Kỳ vọng & Dự phòng Rủi ro theo chuẩn IFRS 9 ECL
 */
export function calculateIfrs9Provisions(
  outA0_30: number,
  outA31_60: number,
  outA61_90: number,
  outAOver90: number,
  inA0_30: number,
  inA31_60: number,
  inA61_90: number,
  inAOver90: number,
  outF7: number,
  inF7: number,
  outF30: number,
  inF30: number,
): GarageForecastHorizonsOverview {
  const expRec = Math.round(
    outA0_30 * 0.85 + outA31_60 * 0.6 + outA61_90 * 0.3 + outAOver90 * 0.1,
  );
  const expPay = Math.round(
    inA0_30 * 0.95 + inA31_60 * 0.85 + inA61_90 * 0.7 + inAOver90 * 0.5,
  );
  const riskRec = Math.round(
    outA0_30 * 0.15 + outA31_60 * 0.4 + outA61_90 * 0.7 + outAOver90 * 0.9,
  );
  const riskPay = Math.round(
    inA0_30 * 0.05 + inA31_60 * 0.15 + inA61_90 * 0.3 + inAOver90 * 0.5,
  );

  return {
    next7Days: {
      receivable: outF7,
      payable: inF7,
      net: outF7 - inF7,
    },
    next30Days: {
      receivable: outF30,
      payable: inF30,
      net: outF30 - inF30,
    },
    expectedCashflow: {
      receivable: expRec,
      payable: expPay,
      net: expRec - expPay,
    },
    defaultRiskProvision: {
      receivableRisk: riskRec,
      payableRisk: riskPay,
      netRisk: riskRec - riskPay,
    },
  };
}
