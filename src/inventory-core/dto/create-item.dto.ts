import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateInventoryItemDto {
  @ApiProperty()
  @IsString()
  sku: string;

  @ApiProperty()
  @IsString()
  itemName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ enum: ['NONE', 'SERIAL', 'LOT', 'VEHICLE', 'CUSTOM'] })
  @IsOptional()
  @IsString()
  @IsIn(['NONE', 'SERIAL', 'LOT', 'VEHICLE', 'CUSTOM'])
  trackingPolicy?: 'NONE' | 'SERIAL' | 'LOT' | 'VEHICLE' | 'CUSTOM';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trackingCategoryKey?: string;
}
