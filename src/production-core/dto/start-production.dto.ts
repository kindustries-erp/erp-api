import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class StartProductionDto {
  @ApiProperty({ description: 'Số lượng cần sản xuất trong lần này' })
  @IsNumber()
  @Min(0.001)
  qtyToManufacture: number;

  @ApiProperty({
    description: 'Mã kho xuất NVL (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  warehouseCode?: string;
}
