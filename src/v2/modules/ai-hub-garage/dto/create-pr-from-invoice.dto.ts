import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { GARAGE_ITEM_TYPES } from '@/v2/modules/items-garage/helpers/garage-item-code.helper';

export class PrFromInvoiceLineDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  itemName: string;

  @ApiPropertyOptional({
    description:
      'Mã hàng người dùng xác nhận. Bỏ trống: server tra theo tên, chưa có thì sinh mã',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  itemCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional({ enum: GARAGE_ITEM_TYPES })
  @IsOptional()
  @IsIn(GARAGE_ITEM_TYPES)
  itemType?: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  qtyRequested: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  estUnitPrice?: number;
}

export class CreatePrFromInvoiceDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  branchName?: string;

  @ApiProperty() @IsDateString() requestDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;

  @ApiPropertyOptional({ description: 'Số hóa đơn nguồn, lưu để truy vết' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  invoiceNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sellerName?: string;

  @ApiProperty({ type: [PrFromInvoiceLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PrFromInvoiceLineDto)
  lines: PrFromInvoiceLineDto[];
}
