import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetGarageMonthlyReceivablesBreakdownQueryDto {
  @ApiProperty({
    description:
      'Tháng cần tra cứu (định dạng YYYY-MM hoặc MM/YYYY, ví dụ 2026-10)',
    example: '2026-10',
  })
  @IsNotEmpty()
  @IsString()
  month: string;

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
  vatAmount: number;
  invoiceNo?: string;
  invoiceId?: string;
  buyerName?: string;
  vatWarning: boolean;
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
  rate: number;
  shareRate: number;
  cases: MonthlyReceivablesCaseItem[];
}

export interface MonthlyReceivablesCategorizedTotals {
  billed: number;
  paid: number;
  remaining: number;
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
