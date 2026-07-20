import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateInventoryAdjustmentLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  qtyAdjusted?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  typeAdjust?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  unitCost?: number;
}
