import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

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
}
