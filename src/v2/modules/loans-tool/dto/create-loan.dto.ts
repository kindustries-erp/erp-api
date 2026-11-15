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
import { AmortizationMethod, LoanStatus } from '@/v2/core/loans-core';

export class CreateLoanDto {
  @IsOptional()
  @IsString()
  loanCode?: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  lenderName: string;

  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  principalAmount: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  annualInterestRate: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  tenorMonths: number;

  @IsEnum(AmortizationMethod)
  amortizationMethod: AmortizationMethod;

  @IsNotEmpty()
  @IsString()
  startDate: string;

  @IsOptional()
  @IsString()
  firstPaymentDate?: string;

  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
