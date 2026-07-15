import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CashflowVoucherQueryDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  channel_type?: string;

  @IsOptional()
  @IsString()
  flow_direction?: string;

  @IsOptional()
  @IsString()
  business_type?: string;

  @IsOptional()
  @IsString()
  party_scope?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  column_filters?: string;

  @IsOptional()
  @IsString()
  column_search?: string;
}

export class AddRelatedDocumentDto {
  @IsString()
  related_document_type!: string;

  @IsUUID()
  related_document_id!: string;

  @IsString()
  @IsOptional()
  related_document_no_snapshot?: string;

  @IsNumber()
  @IsOptional()
  reference_amount?: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class AddAllocationDto {
  @IsString()
  target_document_type!: string;

  @IsUUID()
  target_document_id!: string;

  @IsString()
  @IsOptional()
  target_document_no_snapshot?: string;

  @IsString()
  allocation_type!: string;

  @IsNumber()
  @Min(0.01)
  allocated_amount!: number;

  @IsString()
  @IsOptional()
  currency_code?: string;

  @IsNumber()
  @IsOptional()
  exchange_rate?: number;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CounterpartyLookupQueryDto {
  @IsString()
  scope!: string;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  pageSize?: number = 50;
}
