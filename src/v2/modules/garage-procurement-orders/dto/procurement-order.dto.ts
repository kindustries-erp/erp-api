import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class GarageProcurementOrderLineDto {
  @ApiProperty({ enum: ['GOODS', 'SERVICE'] })
  @IsIn(['GOODS', 'SERVICE'])
  lineType: 'GOODS' | 'SERVICE';

  @ApiPropertyOptional() @IsOptional() @IsUUID() itemId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  itemCode?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  itemName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  qtyOrdered: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Dòng PR nguồn, bắt buộc khi đơn có PR' })
  @IsOptional()
  @IsUUID()
  requestLineId?: string;
}

export class CreateProcurementOrderDto {
  @ApiProperty({ description: 'Chi nhánh' }) @IsUUID() branchId: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  branchName?: string;
  @ApiProperty() @IsDateString() orderDate: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expectedDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() supplierId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  supplierName?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() requestId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;

  @ApiProperty({ type: [GarageProcurementOrderLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GarageProcurementOrderLineDto)
  lines: GarageProcurementOrderLineDto[];
}

export class ReplaceOrderLinesDto {
  @ApiProperty({ type: [GarageProcurementOrderLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GarageProcurementOrderLineDto)
  lines: GarageProcurementOrderLineDto[];
}

export class ReceiveGoodsDto {
  @ApiProperty({ type: [Object], description: '[{orderLineId, qty}]' })
  @IsArray()
  @ArrayMinSize(1)
  items: Array<{ orderLineId: string; qty: number }>;
}

export class AcceptServicesDto {
  @ApiProperty({ type: [Object], description: '[{orderLineId, qty, note?}]' })
  @IsArray()
  @ArrayMinSize(1)
  items: Array<{ orderLineId: string; qty: number; note?: string }>;
}

export class ListProcurementOrdersDto {
  @ApiPropertyOptional({ description: 'Lọc theo chi nhánh' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 20;
}
