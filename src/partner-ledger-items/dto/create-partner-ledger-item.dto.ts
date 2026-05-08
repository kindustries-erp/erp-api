import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsNotEmpty,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePartnerLedgerItemDto {
  @ApiProperty() @IsString() @IsNotEmpty() item_no: string;

  @ApiProperty({ enum: ['RECEIVABLE', 'PAYABLE'] })
  @IsIn(['RECEIVABLE', 'PAYABLE'])
  item_type: 'RECEIVABLE' | 'PAYABLE';

  @ApiPropertyOptional({
    enum: ['OPENING', 'MANUAL', 'SALES_DOC', 'PURCHASE_DOC', 'ADJUSTMENT'],
  })
  @IsOptional()
  @IsIn(['OPENING', 'MANUAL', 'SALES_DOC', 'PURCHASE_DOC', 'ADJUSTMENT'])
  source_type?:
    | 'OPENING'
    | 'MANUAL'
    | 'SALES_DOC'
    | 'PURCHASE_DOC'
    | 'ADJUSTMENT';

  @ApiProperty() @IsUUID() @IsNotEmpty() business_partner_id: string;

  @ApiProperty() @IsUUID() @IsNotEmpty() accounting_account_id: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsString()
  @IsNotEmpty()
  document_date: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsString()
  @IsNotEmpty()
  posting_date: string;

  @ApiPropertyOptional({ example: '2026-02-01' })
  @IsOptional()
  @IsString()
  due_date?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() reference_no?: string;

  @ApiProperty() @IsString() @IsNotEmpty() description: string;

  @ApiPropertyOptional({ example: 'VND' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty() @IsNumber() original_amount: number;

  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
