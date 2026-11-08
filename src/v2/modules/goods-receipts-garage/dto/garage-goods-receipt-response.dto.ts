import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  BaseGoodsReceiptLineResponseDto,
  BaseGoodsReceiptResponseDto,
} from '@/v2/core/goods-receipts-core/dto/base-goods-receipt-response.dto';

export class GarageGoodsReceiptLineResponseDto extends BaseGoodsReceiptLineResponseDto {
  @ApiPropertyOptional()
  procurementOrderLineId?: string;
}

export class GarageGoodsReceiptResponseDto extends BaseGoodsReceiptResponseDto {
  @ApiPropertyOptional()
  paymentStatus?: string;

  @ApiPropertyOptional()
  garageProcurementOrderId?: string;

  @ApiPropertyOptional({ type: [GarageGoodsReceiptLineResponseDto] })
  declare lines?: GarageGoodsReceiptLineResponseDto[];
}
