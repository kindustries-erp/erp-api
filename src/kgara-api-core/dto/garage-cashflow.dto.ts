import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsIn,
  IsUUID,
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
  partnerName?: string;

  @IsString()
  @IsOptional()
  partnerPhone?: string;

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
  partnerName?: string;

  @IsString()
  @IsOptional()
  partnerPhone?: string;

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
