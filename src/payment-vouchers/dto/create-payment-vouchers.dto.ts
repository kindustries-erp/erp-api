import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsNotEmpty,
  IsIn,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CashBankRelatedDocumentDto {
  @ApiProperty({
    enum: [
      'payment_vouchers',
      'ap_documents',
      'sales_invoices',
      'purchase_invoices',
      'manual',
    ],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([
    'payment_vouchers',
    'ap_documents',
    'sales_invoices',
    'purchase_invoices',
    'manual',
  ])
  related_type!: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  related_id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  related_no?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  related_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreatePaymentVouchersDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  voucher_no!: string;

  @ApiProperty({ enum: ['CASH', 'BANK'] })
  @IsString()
  @IsNotEmpty()
  voucher_channel!: string;

  @ApiProperty({ enum: ['IN', 'OUT'] })
  @IsString()
  @IsNotEmpty()
  voucher_direction!: string;

  @ApiProperty({
    enum: [
      'CASH_RECEIPT',
      'CASH_PAYMENT',
      'BANK_RECEIPT',
      'BANK_PAYMENT',
      'CUSTOMER_ADVANCE_RECEIPT',
    ],
  })
  @IsString()
  @IsNotEmpty()
  voucher_type!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  document_date!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  posting_date!: string;

  @ApiProperty({
    enum: ['INTERNAL', 'EXTERNAL'],
    description: 'Nguồn đối tác: nội bộ (nhân viên) hoặc bên ngoài (đối tác)',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['INTERNAL', 'EXTERNAL'])
  counterparty_source!: string;

  @ApiPropertyOptional({
    description: 'UUID nhân viên — bắt buộc khi counterparty_source = INTERNAL',
  })
  @IsOptional()
  @IsUUID()
  employee_id?: string;

  @ApiPropertyOptional({
    description: 'UUID đối tác — bắt buộc khi counterparty_source = EXTERNAL',
  })
  @IsOptional()
  @IsUUID()
  counterparty_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actual_person_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actual_person_id_no?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actual_person_phone?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({
    description: 'Cash/Bank tag preset id dùng để gắn preset gợi ý',
  })
  @IsOptional()
  @IsUUID()
  cash_bank_tag_preset_id?: string;

  @ApiPropertyOptional({
    description: 'Cash/Bank tag preset code dùng để resolve preset gợi ý',
  })
  @IsOptional()
  @IsString()
  cash_bank_tag_code?: string;

  @ApiPropertyOptional({ type: [CashBankRelatedDocumentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CashBankRelatedDocumentDto)
  related_documents?: CashBankRelatedDocumentDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Bắt buộc khi voucher_channel = CASH' })
  @IsOptional()
  @IsUUID()
  cash_fund_id?: string;

  @ApiPropertyOptional({ description: 'Bắt buộc khi voucher_channel = BANK' })
  @IsOptional()
  @IsUUID()
  company_bank_account_id?: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  amount_in_words?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'CONFIRMED', 'CANCELLED'] })
  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'CONFIRMED', 'CANCELLED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  counterparty_name_snapshot?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  counterparty_identity_no_snapshot?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  counterparty_phone_snapshot?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  counterparty_tax_code_snapshot?: string;

  @ApiPropertyOptional({ description: 'ID bút toán đã hạch toán thủ công' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  journal_entry_id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
