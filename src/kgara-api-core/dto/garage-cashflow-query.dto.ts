import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  GaragePaymentMethodEnum,
  GarageSettlementTypeEnum,
} from './create-garage-cashflow.dto';

export class GarageCashflowQueryDto {
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 20;

  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(GarageSettlementTypeEnum)
  @IsOptional()
  settlementType?: 'RECEIPT' | 'PAYMENT';

  @IsEnum(GaragePaymentMethodEnum)
  @IsOptional()
  paymentMethod?: 'BANK_TRANSFER' | 'CASH' | 'POS' | 'OTHER';

  @IsString()
  @IsOptional()
  caseCode?: string;

  @IsString()
  @IsOptional()
  licensePlate?: string;

  @IsString()
  @IsOptional()
  partnerName?: string;

  @IsString()
  @IsOptional()
  dateFrom?: string;

  @IsString()
  @IsOptional()
  dateTo?: string;

  @IsString()
  @IsOptional()
  sortField?: string = 'transDate';

  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  sorts?: string | string[];

  @IsString()
  @IsOptional()
  filtersStr?: string;

  @IsString()
  @IsOptional()
  statusTab?: string;
}

export class GarageCashflowColumnOptionsQueryDto {
  @IsString()
  @IsOptional()
  column?: string;

  @IsString()
  @IsOptional()
  columnKey?: string;

  @IsString()
  @IsOptional()
  search?: string = '';

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 20;

  @IsString()
  @IsOptional()
  filtersStr?: string;

  @IsString()
  @IsOptional()
  statusTab?: string;
}

export interface GarageCashflowBankTxnSummaryDto {
  id: string;
  bankAccount?: string;
  transDate?: string;
  amount: number;
  description?: string;
  correspondentName?: string;
}

export interface GarageCashflowCaseSummaryDto {
  id: string;
  soChungTu: string;
  bienSoXe?: string;
  tenKhachHang?: string;
  tienCoThue: number;
  tienDaThanhToan: number;
  tienConPhaiThanhToan: number;
}

export interface GarageCashflowItemDto {
  id: string;
  transDate?: string;
  settlementType: 'RECEIPT' | 'PAYMENT';
  sourceChannel: 'ON_SYSTEM' | 'OFF_SYSTEM_MANUAL';
  paymentMethod: 'BANK_TRANSFER' | 'CASH' | 'POS' | 'OTHER';
  amount: number;
  partnerName?: string;
  payerType?: 'KH' | 'BH' | 'SUPPLIER' | 'OTHER';
  receiptNumber?: string;
  category?: string;
  note?: string;
  caseId?: string;
  caseCode?: string;
  licensePlate?: string;
  bankTransactionId?: string;
  bankTransaction?: GarageCashflowBankTxnSummaryDto;
  caseSummary?: GarageCashflowCaseSummaryDto;
  createdAt: string;
  updatedAt: string;
}

export interface GarageCashflowStatsDto {
  totalReceipts: number;
  totalPayments: number;
  netCashflow: number;
  totalTransactions: number;
  linkedCasesCount: number;
}

export interface GarageCashflowListResponseDto {
  items: GarageCashflowItemDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: GarageCashflowStatsDto;
}
