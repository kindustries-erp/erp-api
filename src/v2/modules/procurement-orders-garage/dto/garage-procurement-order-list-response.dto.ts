import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';
import { GarageProcurementOrderResponseDto } from './garage-procurement-order-response.dto';

/** Response danh sách PO garage chuẩn v2: `items`, `pagination`, `summaries`. */
export class GarageProcurementOrderListResponseDto {
  @ApiProperty({ type: () => [GarageProcurementOrderResponseDto] })
  items: GarageProcurementOrderResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  pagination: PaginationMetaDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description:
      'Tổng toàn bộ dòng khớp bộ lọc, theo tên cột số (khớp V2Column.key). Ví dụ: totalAmount',
  })
  summaries: Record<string, number>;
}
