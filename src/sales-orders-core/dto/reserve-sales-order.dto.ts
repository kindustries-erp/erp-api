import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class ReserveSalesOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serialIds?: string[];
}
