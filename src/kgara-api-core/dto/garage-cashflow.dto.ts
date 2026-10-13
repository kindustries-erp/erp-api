import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsIn,
  IsUUID,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateKgaraCashflowVoucherDto {
  @IsString()
  @IsOptional()
  voucherCode?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['RECEIPT', 'PAYMENT'])
  voucherType: 'RECEIPT' | 'PAYMENT';

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  amount: number;

  @IsString()
  @IsOptional()
  transDate?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  paymentContent?: string;

  @IsString()
  @IsOptional()
  partnerName?: string;

  @IsString()
  @IsOptional()
  partnerPhone?: string;

  @IsString()
  @IsOptional()
  licensePlate?: string;

  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @IsUUID()
  @IsOptional()
  caseId?: string;

  @IsUUID()
  @IsOptional()
  erpBankTransactionId?: string;

  @IsUUID()
  @IsOptional()
  erpCashVoucherId?: string;

  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdateKgaraCashflowVoucherDto {
  @IsString()
  @IsOptional()
  @IsIn(['RECEIPT', 'PAYMENT'])
  voucherType?: 'RECEIPT' | 'PAYMENT';

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  amount?: number;

  @IsString()
  @IsOptional()
  transDate?: string;

  @IsUUID()
  @IsOptional()
  caseId?: string;

  @IsUUID()
  @IsOptional()
  erpBankTransactionId?: string;

  @IsUUID()
  @IsOptional()
  erpCashVoucherId?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  paymentContent?: string;

  @IsString()
  @IsOptional()
  partnerName?: string;

  @IsString()
  @IsOptional()
  partnerPhone?: string;

  @IsString()
  @IsOptional()
  licensePlate?: string;

  @IsString()
  @IsOptional()
  referenceNumber?: string;
}

export class ListKgaraCashflowVoucherQueryDto {
  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @IsString()
  @IsIn(['RECEIPT', 'PAYMENT'])
  voucher_type?: 'RECEIPT' | 'PAYMENT';

  @IsOptional()
  @IsString()
  case_id?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 20;

  @IsOptional()
  sorts?: string | string[];

  @IsOptional()
  @IsString()
  column_filters?: string;

  @IsOptional()
  @IsString()
  column_search?: string;
}

export class KgaraCashflowCaseResponseDto {
  id: string;
  khachHangName?: string | null;
  khachHangCode?: string | null;
  soChungTu?: string | null;
  bienSoXe?: string | null;
}

export class KgaraCashflowVoucherResponseDto {
  id: string;
  voucherCode: string;
  voucherType: 'RECEIPT' | 'PAYMENT';
  amount: number;
  transDate: string;
  partnerName?: string | null;
  partnerPhone?: string | null;
  licensePlate?: string | null;
  note?: string | null;
  paymentMethod?: string | null;
  paymentContent?: string | null;
  referenceNumber?: string | null;
  caseId?: string | null;
  erpBankTransactionId?: string | null;
  erpCashVoucherId?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  case?: KgaraCashflowCaseResponseDto | null;
  erpBankTransaction?: {
    id: string;
    referenceNumber?: string | null;
    seqNo?: string | null;
  } | null;
}

export function toKgaraCashflowVoucherResponse(
  entity: import('../entities/kgara_cashflow_voucher.entity').KgaraCashflowVoucher,
): KgaraCashflowVoucherResponseDto {
  return {
    id: entity.id,
    voucherCode: entity.voucherCode,
    voucherType: entity.voucherType,
    amount: Number(entity.amount) || 0,
    transDate: entity.transDate,
    partnerName: entity.partnerName ?? null,
    licensePlate: entity.licensePlate ?? null,
    note: entity.note ?? null,
    paymentMethod: entity.paymentMethod ?? null,
    paymentContent: entity.paymentContent ?? null,
    caseId: entity.caseId ?? null,
    erpBankTransactionId: entity.erpBankTransactionId ?? null,
    erpCashVoucherId: entity.erpCashVoucherId ?? null,
    createdBy: entity.createdBy ?? null,
    createdAt:
      entity.createdAt instanceof Date
        ? entity.createdAt.toISOString()
        : String(entity.createdAt),
    updatedAt:
      entity.updatedAt instanceof Date
        ? entity.updatedAt.toISOString()
        : String(entity.updatedAt),
    case: entity.case
      ? {
          id: entity.case.id,
          khachHangName: entity.case.khachHangName ?? null,
          khachHangCode: entity.case.khachHangCode ?? null,
          soChungTu: entity.case.soChungTu ?? null,
          bienSoXe: entity.case.bienSoXe ?? null,
        }
      : null,
    erpBankTransaction: entity.erpBankTransaction
      ? {
          id: entity.erpBankTransaction.id,
          referenceNumber: entity.erpBankTransaction.referenceNumber ?? null,
          seqNo: (entity.erpBankTransaction as any).seqNo ?? null,
        }
      : null,
  };
}

export class CheckKgaraCashflowDuplicateQueryDto {
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @IsString()
  @IsOptional()
  transDate?: string;

  @IsUUID()
  @IsOptional()
  caseId?: string;

  @IsString()
  @IsOptional()
  licensePlate?: string;

  @IsUUID()
  @IsOptional()
  excludeId?: string;
}

export class KgaraCashflowDuplicateItemDto {
  id: string;
  voucherCode: string;
  voucherType: 'RECEIPT' | 'PAYMENT';
  amount: number;
  transDate: string;
  licensePlate?: string | null;
  caseCode?: string | null;
  partnerName?: string | null;
}

export class KgaraCashflowDuplicateGroupDto {
  items: KgaraCashflowDuplicateItemDto[];
  total: number;
}

export class KgaraCashflowDuplicateResponseDto {
  nearbyDate: KgaraCashflowDuplicateGroupDto;
  sameCase: KgaraCashflowDuplicateGroupDto;
  samePlate: KgaraCashflowDuplicateGroupDto;
}
