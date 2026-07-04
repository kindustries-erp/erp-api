import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ProductionIdentifierDto {
  @ApiPropertyOptional({
    description: 'VIN (vin_no) nếu tracking policy = VEHICLE',
  })
  @IsOptional()
  @IsString()
  vinNo?: string;

  @ApiPropertyOptional({ description: 'Số máy nếu tracking policy = VEHICLE' })
  @IsOptional()
  @IsString()
  engineNo?: string;

  @ApiPropertyOptional({
    description: 'Serial number nếu tracking policy = SERIAL',
  })
  @IsOptional()
  @IsString()
  serialNo?: string;

  @ApiPropertyOptional({ description: 'Lot number nếu tracking policy = LOT' })
  @IsOptional()
  @IsString()
  lotNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Thuộc tính mở rộng tự do dạng key-value — áp dụng cho mọi tracking policy',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;
}

export class CompleteProductionDto {
  @ApiProperty({ description: 'Số lượng thành phẩm hoàn thành trong lần này' })
  @IsNumber()
  @Min(0.001)
  qtyFinished: number;

  @ApiProperty({
    description: 'Mã kho nhập thành phẩm (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiProperty({
    description: 'Đơn giá nhập kho thành phẩm (optional, mặc định 0)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  unitCost?: number;

  @ApiPropertyOptional({
    description:
      'Danh sách mã định danh theo từng đơn vị hoàn thành (VIN/Engine/Serial/Lot)',
    type: [ProductionIdentifierDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductionIdentifierDto)
  identifiers?: ProductionIdentifierDto[];
}
