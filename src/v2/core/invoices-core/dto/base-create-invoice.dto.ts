import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { BaseCreateInvoiceLineDto } from './base-create-invoice-line.dto';
import { ExtraDataField } from '../../base-core/dto/extra-data.decorator';

export class BaseCreateInvoiceDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  invoiceNo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  serialNo?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  invoiceDate: string;

  @ApiProperty({ enum: ['IN', 'OUT'] })
  @IsNotEmpty()
  @IsIn(['IN', 'OUT'])
  direction: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  taxInvoiceStatus?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  taxProcessStatus?: number;

  @ApiPropertyOptional({
    type: [String],
    description: 'Mảng rỗng = chưa gán chi nhánh',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  branchIds?: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isValid?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sellerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sellerTaxCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sellerAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sellerBank?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  buyerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  buyerPersonalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  buyerCccd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  buyerTaxCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buyerAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  invoiceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  invoiceCategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  preVatAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  vatRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  vatAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  salesOrderId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  paymentDocumentNos?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  licensePlate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  settlementOrder?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  relatedInvoiceNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  relatedSerialNo?: string;

  @ApiPropertyOptional({ type: () => [BaseCreateInvoiceLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BaseCreateInvoiceLineDto)
  items?: BaseCreateInvoiceLineDto[];

  @ExtraDataField()
  extraData?: Record<string, unknown>;
}
