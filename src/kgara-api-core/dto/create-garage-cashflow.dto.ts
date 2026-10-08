import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum GarageSettlementTypeEnum {
  RECEIPT = 'RECEIPT',
  PAYMENT = 'PAYMENT',
}

export enum GaragePaymentMethodEnum {
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
  POS = 'POS',
  OTHER = 'OTHER',
}

export enum GaragePayerTypeEnum {
  KH = 'KH',
  BH = 'BH',
  SUPPLIER = 'SUPPLIER',
  OTHER = 'OTHER',
}

export class CreateGarageCashflowDto {
  @IsEnum(GarageSettlementTypeEnum)
  @IsNotEmpty()
  settlementType: 'RECEIPT' | 'PAYMENT';

  @IsEnum(GaragePaymentMethodEnum)
  @IsOptional()
  paymentMethod?: 'BANK_TRANSFER' | 'CASH' | 'POS' | 'OTHER';

  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  @Type(() => Number)
  amount: number;

  @IsString()
  @IsNotEmpty()
  transDate: string;

  @IsString()
  @IsOptional()
  partnerName?: string;

  @IsEnum(GaragePayerTypeEnum)
  @IsOptional()
  payerType?: 'KH' | 'BH' | 'SUPPLIER' | 'OTHER';

  @IsUUID()
  @IsOptional()
  caseId?: string;

  @IsUUID()
  @IsOptional()
  bankTransactionId?: string;

  @IsString()
  @IsOptional()
  receiptNumber?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdateGarageCashflowDto {
  @IsEnum(GarageSettlementTypeEnum)
  @IsOptional()
  settlementType?: 'RECEIPT' | 'PAYMENT';

  @IsEnum(GaragePaymentMethodEnum)
  @IsOptional()
  paymentMethod?: 'BANK_TRANSFER' | 'CASH' | 'POS' | 'OTHER';

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  amount?: number;

  @IsString()
  @IsOptional()
  transDate?: string;

  @IsString()
  @IsOptional()
  partnerName?: string;

  @IsEnum(GaragePayerTypeEnum)
  @IsOptional()
  payerType?: 'KH' | 'BH' | 'SUPPLIER' | 'OTHER';

  @IsUUID()
  @IsOptional()
  caseId?: string;

  @IsUUID()
  @IsOptional()
  bankTransactionId?: string;

  @IsString()
  @IsOptional()
  receiptNumber?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
