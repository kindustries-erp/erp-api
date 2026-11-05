import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { BaseCreateGoodsReceiptLineDto } from '@/v2/core/goods-receipts/dto/base-create-goods-receipt-line.dto';

export class CreateGarageGoodsReceiptLineDto extends BaseCreateGoodsReceiptLineDto {
  @ApiPropertyOptional({ description: 'Dòng đơn mua garage được nhận' })
  @IsOptional()
  @IsUUID()
  procurementOrderLineId?: string;
}
