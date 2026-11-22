import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecordPaymentDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  periodNumber: number;

  @IsNotEmpty()
  @IsString()
  paymentDate: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  principalPaid: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  interestPaid: number;

  @IsOptional()
  @IsString()
  paymentRef?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
