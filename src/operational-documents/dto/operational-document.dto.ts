import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class OperationalQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  exclude_status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payment_status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoice_status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source_system?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  inventory_item_id?: string;

  @ApiPropertyOptional({ description: 'Lọc từ ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'Lọc đến ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Lọc theo nhà cung cấp (UUID)' })
  @IsOptional()
  @IsUUID()
  supplier_id?: string;
}

export class OperationalLineDto {
  @IsOptional()
  @IsNumber()
  line_no?: number;

  @IsOptional()
  @IsString()
  line_type?: string;

  @IsOptional()
  @IsString()
  item_code?: string;

  @IsOptional()
  @IsString()
  item_name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  qty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unit_price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsUUID()
  inventory_item_id?: string;

  @IsOptional()
  source_payload?: Record<string, any>;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateSalesServiceOrderDto {
  @IsOptional()
  @IsString()
  order_no?: string;

  @IsOptional()
  @IsIn(['ERP', 'KGARA', 'VINFAST_DMS'])
  source_system?: string;

  @IsOptional()
  @IsString()
  source_document_id?: string;

  @IsOptional()
  @IsString()
  source_document_no?: string;

  @IsOptional()
  source_payload?: Record<string, any>;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @IsOptional()
  @IsString()
  customer_name_snapshot?: string;

  @IsOptional()
  @IsString()
  vehicle_plate?: string;

  @IsOptional()
  @IsString()
  vehicle_vin?: string;

  @IsOptional()
  @IsString()
  vehicle_model?: string;

  @IsOptional()
  @IsString()
  service_advisor_name?: string;

  @IsOptional()
  @IsDateString()
  document_date?: string;

  @IsOptional()
  @IsDateString()
  expected_delivery_date?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsIn(['NO_INVOICE', 'HAS_INVOICE', 'NOT_REQUIRED'])
  invoice_status?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  total_amount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OperationalLineDto)
  lines?: OperationalLineDto[];
}

export class CreatePurchaseOrderDto {
  @IsOptional()
  @IsString()
  purchase_no?: string;

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
  @IsDateString()
  document_date?: string;

  @IsOptional()
  @IsDateString()
  expected_receipt_date?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsIn(['NO_INVOICE', 'HAS_INVOICE', 'NOT_REQUIRED'])
  invoice_status?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'CONFIRMED', 'RECEIVED', 'CANCELLED'])
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OperationalLineDto)
  lines?: OperationalLineDto[];
}

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OperationalLineDto)
  lines?: OperationalLineDto[];
}

export class CreateDocumentPaymentLinkDto {
  @IsIn(['sales_service_orders', 'purchase_orders', 'operating_expenses'])
  document_type!: string;

  @IsUUID()
  document_id!: string;

  @IsUUID()
  payment_voucher_id!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  applied_amount!: number;

  @IsOptional()
  @IsDateString()
  applied_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateInventoryItemDto {
  @IsOptional()
  @IsString()
  item_code?: string;

  @IsString()
  item_name!: string;

  @IsOptional()
  @IsIn(['PART', 'MATERIAL', 'CONSUMABLE', 'OTHER'])
  item_type?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateInventoryTransactionDto {
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsUUID()
  inventory_item_id!: string;

  @IsIn([
    'RECEIPT',
    'ISSUE',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
  ])
  transaction_type!: string;

  @IsOptional()
  @IsDateString()
  transaction_date?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  qty!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unit_cost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  source_type?: string;

  @IsOptional()
  @IsUUID()
  source_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PostPurchaseReceiptLineDto {
  @IsOptional()
  @IsString()
  line_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  qty?: number;
}

export class PostPurchaseReceiptDto {
  @IsOptional()
  @IsDateString()
  transaction_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostPurchaseReceiptLineDto)
  receipt_lines?: PostPurchaseReceiptLineDto[];
}

export class PostSalesIssueLineDto {
  @IsOptional()
  @IsString()
  line_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  qty?: number;
}

export class PostSalesIssueDto {
  @IsOptional()
  @IsDateString()
  transaction_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostSalesIssueLineDto)
  issue_lines?: PostSalesIssueLineDto[];
}
