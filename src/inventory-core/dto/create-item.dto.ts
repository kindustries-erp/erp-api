import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateInventoryItemDto {
  @ApiProperty()
  @IsString()
  sku: string;

  @ApiProperty()
  @IsString()
  itemName: string;

  @ApiProperty()
  @IsString()
  uom: string;

  @ApiProperty()
  @IsString()
  itemType: string;

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
