/** Kiểu response analytics công nợ garage. Hình dạng giữ như V1 để web chuyển route không đổi contract. */

export interface GarageAgingTotals {
  d0_30: number;
  d31_60: number;
  d61_90: number;
  over90: number;
}

export interface GarageTimeHorizonItem {
  receivable: number;
  payable: number;
  net: number;
}

export interface GarageAgingComparisonItem {
  bracket: '0_30' | '31_60' | '61_90' | 'over_90';
  label: string;
  receivableAmount: number;
  payableAmount: number;
  netAmount: number;
}

export interface GarageForecastHorizons {
  next7Days: GarageTimeHorizonItem;
  next30Days: GarageTimeHorizonItem;
  expectedCashflow: GarageTimeHorizonItem;
  defaultRiskProvision: {
    receivableRisk: number;
    payableRisk: number;
    netRisk: number;
  };
}

export interface GarageTopDebtPartner {
  partnerCode: string;
  partnerName: string;
  totalAmount: number;
  balanceAmount: number;
  overdueAmount: number;
  maxAgingDays: number;
  caseCount: number;
}

export interface GarageDebtsAnalyticsResponse {
  summary: {
    totalReceivable: number;
    paidReceivable: number;
    remainingReceivable: number;
    totalPayable: number;
    paidPayable: number;
    remainingPayable: number;
    netBalance: number;
    collectionRate: number;
    paymentRate: number;
  };
  agingComparison: GarageAgingComparisonItem[];
  timeHorizons: {
    nextWeekDue: GarageTimeHorizonItem;
    nextMonthDue: GarageTimeHorizonItem;
    overdue31To60: GarageTimeHorizonItem;
    overdue61To90: GarageTimeHorizonItem;
    /** @deprecated Tương thích client cũ: bằng overdue31To60 + overdue61To90. */
    overdue30To90: GarageTimeHorizonItem;
    criticalOverdue90Plus: GarageTimeHorizonItem;
  };
  forecastHorizons: GarageForecastHorizons;
  cashTrend: Array<{
    label: string;
    cashIn: number;
    cashOut: number;
    netCash: number;
  }>;
  topReceivableCustomers: GarageTopDebtPartner[];
  topPayableSuppliers: GarageTopDebtPartner[];
}
