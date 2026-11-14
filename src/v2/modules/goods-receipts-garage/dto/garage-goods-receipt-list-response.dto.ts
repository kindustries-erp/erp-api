import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';
import { GarageGoodsReceiptResponseDto } from './garage-goods-receipt-response.dto';

/** Response danh sách phiếu nhập Garage chuẩn v2: `items`, `pagination`, `summaries`. */
export class GarageGoodsReceiptListResponseDto {
  @ApiProperty({ type: () => [GarageGoodsReceiptResponseDto] })
  items: GarageGoodsReceiptResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  pagination: PaginationMetaDto;

  @ApiProperty({
    type: Object,
    description: 'Tổng cột số trên toàn bộ dòng khớp',
  })
  summaries: Record<string, unknown>;
}
