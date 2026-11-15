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

  @ApiPropertyOptional({ description: 'Số đơn mua nguồn' })
  garageProcurementOrderNo?: string;

  @ApiPropertyOptional({ description: 'Tổng tiền của đơn mua nguồn' })
  orderTotalAmount?: number;

  @ApiPropertyOptional({
    description:
      'Phiếu đã nhập kho còn hoàn nhập được (hàng chưa xuất/điều chỉnh)',
  })
  reversible?: boolean;

  @ApiPropertyOptional({ description: 'Lý do không hoàn nhập được' })
  reverseBlockedReason?: string;

  @ApiPropertyOptional({ type: [GarageGoodsReceiptLineResponseDto] })
  declare lines?: GarageGoodsReceiptLineResponseDto[];
}
