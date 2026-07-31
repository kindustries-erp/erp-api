import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateOperatingExpenseDto {
  @IsOptional()
  @IsString()
  expense_no?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsUUID()
  supplier_id?: string;

  @IsOptional()
  @IsString()
  supplier_name_snapshot?: string;

  @IsOptional()
  @IsString()
  expense_category?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  document_date?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsIn(['NO_INVOICE', 'HAS_INVOICE', 'NOT_REQUIRED'])
  invoice_status?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'CONFIRMED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  total_amount?: number;

  @IsOptional()
  @IsIn(['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY'])
  recurrence_type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  recurrence_interval?: number;

  @IsOptional()
  @IsDateString()
  recurrence_start_date?: string;

  @IsOptional()
  @IsDateString()
  recurrence_end_date?: string;

  @IsOptional()
  @IsDateString()
  next_due_date?: string;

  @IsOptional()
  @IsBoolean()
  auto_generate_next?: boolean;

  @IsOptional()
  @IsUUID()
  parent_recurring_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
