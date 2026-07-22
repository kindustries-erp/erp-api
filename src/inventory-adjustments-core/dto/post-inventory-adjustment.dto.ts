import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class PostInventoryAdjustmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}
