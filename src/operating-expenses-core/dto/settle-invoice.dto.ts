import { IsOptional, IsString, IsUUID, IsNumber, Min } from 'class-validator';

export class SettleInvoiceDto {
  @IsUUID()
  invoiceId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  settleAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vatAmount?: number;

  @IsOptional()
  @IsString()
  postingDate?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class PostExpenseDto {
  @IsOptional()
  @IsString()
  accrualMode?: 'NONE' | 'ACCRUED';

  @IsOptional()
  @IsString()
  postingDate?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
