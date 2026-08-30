import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ApplyRecurringOperatingExpenseDto {
  @IsString()
  @IsNotEmpty()
  applyScope: 'this' | 'this_and_future';

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  amount: number;

  @IsString()
  @IsOptional()
  categoryKey?: string;

  @IsString()
  @IsOptional()
  costGroup?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  recurrenceType?: string = 'MONTHLY';

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  untilYear?: number;

  @IsNumber()
  @Min(1)
  @Max(12)
  @IsOptional()
  @Type(() => Number)
  untilMonth?: number;
}

export class ListOperatingExpensesQueryDto {
  @IsOptional()
  @Type(() => Number)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  month?: number;

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  date_field?: string;

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
  cost_group?: string;

  @IsOptional()
  @IsString()
  costGroup?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  payment_status?: string;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  recurrence_type?: string;

  @IsOptional()
  @IsString()
  recurrenceType?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  column_filters?: string;

  @IsOptional()
  @IsString()
  column_search?: string;

  @IsOptional()
  @IsString()
  branch_id?: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}
