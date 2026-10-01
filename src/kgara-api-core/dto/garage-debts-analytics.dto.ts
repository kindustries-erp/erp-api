import { IsOptional, IsString, IsIn, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetGarageDebtsAnalyticsQueryDto {
  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  branch_id?: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}

export class GetGarageTimeHorizonCasesQueryDto {
  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  branch_id?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsIn(['ALL', 'IN', 'OUT'])
  direction?: 'ALL' | 'IN' | 'OUT' = 'ALL';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc' = 'DESC';

  @IsOptional()
  @IsString()
  column_search?: string;

  @IsOptional()
  @IsString()
  column_filters?: string;
}

export interface GarageDebtsAnalyticsSummary {
  totalReceivable: number;
  paidReceivable: number;
  remainingReceivable: number;
  totalPayable: number;
  paidPayable: number;
  remainingPayable: number;
  netBalance: number;
  collectionRate: number;
  paymentRate: number;
}

export interface GarageAgingComparisonItem {
  bracket: '0_30' | '31_60' | '61_90' | 'over_90';
  label: string;
  receivableAmount: number;
  payableAmount: number;
  netAmount: number;
}

export interface GarageTimeHorizonItem {
  receivable: number;
  payable: number;
  net: number;
}

export interface GarageTimeHorizonsOverview {
  nextWeekDue: GarageTimeHorizonItem;
  nextMonthDue: GarageTimeHorizonItem;
  overdue30To90: GarageTimeHorizonItem;
  criticalOverdue90Plus: GarageTimeHorizonItem;
}

export interface GarageForecastHorizonsOverview {
  next7Days: GarageTimeHorizonItem;
  next30Days: GarageTimeHorizonItem;
  expectedCashflow: GarageTimeHorizonItem;
  defaultRiskProvision: {
    receivableRisk: number;
    payableRisk: number;
    netRisk: number;
  };
}

export interface GarageCashTrendItem {
  label: string;
  cashIn: number;
  cashOut: number;
  netCash: number;
}

export interface GarageTopDebtPartnerItem {
  partnerCode: string;
  partnerName: string;
  totalAmount: number;
  balanceAmount: number;
  overdueAmount: number;
  maxAgingDays: number;
  caseCount: number;
}

export interface GarageDebtsAnalyticsResponse {
  summary: GarageDebtsAnalyticsSummary;
  agingComparison: GarageAgingComparisonItem[];
  timeHorizons: GarageTimeHorizonsOverview;
  forecastHorizons: GarageForecastHorizonsOverview;
  cashTrend: GarageCashTrendItem[];
  topReceivableCustomers: GarageTopDebtPartnerItem[];
  topPayableSuppliers: GarageTopDebtPartnerItem[];
}

export interface GarageTimeHorizonCaseItem {
  id: string;
  caseId?: string;
  soChungTu: string;
  bienSoXe?: string;
  customerCode?: string;
  customerName?: string;
  supplierCode?: string;
  supplierName?: string;
  direction: 'OUT' | 'IN';
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  completionDate: string;
  agingDays: number;
  branchExternalId: string;
  status: string;
  description?: string;
}

export interface GarageTimeHorizonCasesSummary {
  horizon: string;
  horizonLabel: string;
  receivableAmount: number;
  payableAmount: number;
  receivableTotalAmount: number;
  payableTotalAmount: number;
  receivedAmount: number;
  paidAmount: number;
  netAmount: number;
  receivableCount: number;
  payableCount: number;
  topPartners: Array<{
    partnerCode: string;
    partnerName: string;
    partnerType: 'CUSTOMER' | 'SUPPLIER';
    balanceAmount: number;
    caseCount: number;
    sharePercentage: number;
  }>;
  branchBreakdown: Array<{
    branchId: string;
    branchName: string;
    amount: number;
    caseCount: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    receivable: number;
    payable: number;
    caseCount: number;
  }>;
}

export interface GarageTimeHorizonCasesResponse {
  summary: GarageTimeHorizonCasesSummary;
  items: GarageTimeHorizonCaseItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
