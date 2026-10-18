import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetGarageMonthlyReceivablesBreakdownQueryDto {
  @ApiPropertyOptional({
    description:
      'Tháng cần tra cứu (định dạng YYYY-MM hoặc MM/YYYY, ví dụ 2026-10)',
    example: '2026-10',
  })
  @IsOptional()
  @IsString()
  month?: string;

  @ApiPropertyOptional({
    description:
      'Mốc thời gian tuổi nợ (nextWeekDue, nextMonthDue, overdue30To90, criticalOverdue90Plus)',
    example: 'criticalOverdue90Plus',
  })
  @IsOptional()
  @IsString()
  horizon?: string;

  @ApiPropertyOptional({
    description: 'Mã chi nhánh (branch_id hoặc external branch ID)',
  })
  @IsOptional()
  @IsString()
  branch_id?: string;

  @ApiPropertyOptional({
    description: 'Mã chi nhánh camelCase',
  })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Ngày bắt đầu (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'Ngày kết thúc (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  date_to?: string;
}

export interface ReceivablesPayerSummary {
  billed: number;
  paid: number;
  remaining: number;
  rate: number;
  caseCount: number;
  withInvoiceAmount: number;
  noInvoiceAmount: number;
  vatAmount: number;
  vatWithoutInvoiceAmount: number;
}

export interface ReceivablesVatWarningSummary {
  hasVatWithoutInvoice: boolean;
  totalVatWithoutInvoice: number;
  casesWithVatNoInvoiceCount: number;
}

export interface MonthlyReceivablesSummary {
  totalBilled: number;
  totalPaid: number;
  totalRemaining: number;
  collectionRate: number;
  caseCount: number;
  customer: ReceivablesPayerSummary;
  insurance: ReceivablesPayerSummary;
  warning: ReceivablesVatWarningSummary;
}

export interface MonthlyReceivablesCaseItem {
  id: string;
  soChungTu: string;
  bienSoXe: string;
  khachHangName: string;
  khachHangCode?: string | null;
  amount: number;
  paid: number;
  remaining: number;
  cost?: number;
  paidCost?: number;
  remainingCost?: number;
  vatAmount: number;
  invoiceNo?: string;
  invoiceId?: string;
  buyerName?: string;
  vatWarning: boolean;
  ngayHoanThanh?: Date | string | null;
}

export type ReceivablesPartnerCategory =
  | 'INSURANCE'
  | 'ENTERPRISE'
  | 'INDIVIDUAL';

export type ReceivablesInvoiceCategory =
  | 'WITH_INVOICE'
  | 'PENDING_INVOICE'
  | 'NO_INVOICE';

export interface MonthlyReceivablesGroupItem {
  key: string;
  payerType: 'KH' | 'BH';
  partnerCategory?: ReceivablesPartnerCategory;
  invoiceCategory?: ReceivablesInvoiceCategory;
  title: string;
  subLabel?: string;
  buyerName: string;
  companyName?: string;
  customerName?: string;
  taxCode?: string | null;
  hasInvoice: boolean;
  invoiceNos: string[];
  hasVat: boolean;
  vatAmount: number;
  vatWarning: boolean;
  caseCount: number;
  billed: number;
  paid: number;
  remaining: number;
  cost?: number;
  paidCost?: number;
  remainingCost?: number;
  rate: number;
  shareRate: number;
  cases: MonthlyReceivablesCaseItem[];
}

export interface MonthlyReceivablesCategorizedTotals {
  billed: number;
  paid: number;
  remaining: number;
  cost?: number;
  paidCost?: number;
  remainingCost?: number;
  caseCount: number;
  partnerCount: number;
}

export interface MonthlyReceivablesGroupCategorized {
  all: MonthlyReceivablesGroupItem[];
  withInvoice: MonthlyReceivablesGroupItem[];
  pendingInvoice: MonthlyReceivablesGroupItem[];
  noInvoice: MonthlyReceivablesGroupItem[];
  totals: MonthlyReceivablesCategorizedTotals;
}

export interface MonthlyReceivablesBreakdownResponse {
  month: string;
  monthLabel: string;
  horizon?: string;
  trendItem?: any;
  summary: MonthlyReceivablesSummary;
  insuranceCompanies: MonthlyReceivablesGroupItem[];
  customerPartners: MonthlyReceivablesGroupItem[];
  allGroups: MonthlyReceivablesGroupItem[];
  categorized?: {
    insurance: MonthlyReceivablesGroupCategorized;
    enterprise: MonthlyReceivablesGroupCategorized;
    individual: MonthlyReceivablesGroupCategorized;
  };
}
