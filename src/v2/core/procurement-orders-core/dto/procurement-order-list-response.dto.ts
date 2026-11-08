import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';
import { ProcurementOrderResponseDto } from './procurement-order-response.dto';

/** Response danh sách PO chuẩn v2: `items`, `pagination`, `summaries`. */
export class ProcurementOrderListResponseDto {
  @ApiProperty({ type: () => [ProcurementOrderResponseDto] })
  items: ProcurementOrderResponseDto[];

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
