import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AmortizationMethod } from '@/v2/core/loans-core';

export class SimulateLoanDto {
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
}
