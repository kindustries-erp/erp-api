import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateOperatingExpenseDto {
  @IsOptional()
  @IsString()
  expense_no?: string;

  @IsOptional()
  @IsString()
  expenseNo?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  supplier_id?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  supplier_name_snapshot?: string;

  @IsOptional()
  @IsString()
  supplierNameSnapshot?: string;

  @IsOptional()
  @IsString()
  expense_category?: string;

  @IsOptional()
  @IsString()
  expenseCategory?: string;

  @IsOptional()
  @IsString()
  category_key?: string;

  @IsOptional()
  @IsString()
  categoryKey?: string;

  @IsOptional()
  @IsString()
  cost_group?: string;

  @IsOptional()
  @IsString()
  costGroup?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  period_year?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  periodYear?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  period_month?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  periodMonth?: number;

  @IsOptional()
  @IsDateString()
  document_date?: string;

  @IsOptional()
  @IsDateString()
  documentDate?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsIn(['NO_INVOICE', 'HAS_INVOICE', 'NOT_REQUIRED'])
  invoice_status?: string;

  @IsOptional()
  @IsIn(['NO_INVOICE', 'HAS_INVOICE', 'NOT_REQUIRED'])
  invoiceStatus?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'CONFIRMED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsIn(['UNPAID', 'PARTIAL', 'PAID'])
  payment_status?: string;

  @IsOptional()
  @IsIn(['UNPAID', 'PARTIAL', 'PAID'])
  paymentStatus?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  total_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  recurrence_type?: string;

  @IsOptional()
  @IsString()
  recurrenceType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  recurrence_interval?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  recurrenceInterval?: number;

  @IsOptional()
  @IsDateString()
  recurrence_start_date?: string;

  @IsOptional()
  @IsDateString()
  recurrenceStartDate?: string;

  @IsOptional()
  @IsDateString()
  recurrence_end_date?: string;

  @IsOptional()
  @IsDateString()
  recurrenceEndDate?: string;

  @IsOptional()
  @IsDateString()
  next_due_date?: string;

  @IsOptional()
  @IsDateString()
  nextDueDate?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  recurrence_until_year?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  recurrenceUntilYear?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  recurrence_until_month?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  recurrenceUntilMonth?: number;

  @IsOptional()
  @IsString()
  recurrence_anchor_id?: string;

  @IsOptional()
  @IsString()
  recurrenceAnchorId?: string;

  @IsOptional()
  @IsBoolean()
  auto_generate_next?: boolean;

  @IsOptional()
  @IsBoolean()
  autoGenerateNext?: boolean;

  @IsOptional()
  @IsUUID()
  parent_recurring_id?: string;

  @IsOptional()
  @IsUUID()
  parentRecurringId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
