import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';

/** Response danh sách hóa đơn chuẩn v2: `items`, `pagination`, `summaries`. */
export class InvoiceListResponseDto {
  @ApiProperty({
    type: () => [Object],
    description: 'Dòng hóa đơn (response item)',
  })
  items: Record<string, unknown>[];

  @ApiProperty({ type: () => PaginationMetaDto })
  pagination: PaginationMetaDto;

  @ApiProperty({
    type: Object,
    description: 'Tổng cột số trên toàn bộ dòng khớp',
  })
  summaries: Record<string, unknown>;
}
