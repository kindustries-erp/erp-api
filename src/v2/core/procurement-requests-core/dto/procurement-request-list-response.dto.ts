import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';
import { PurchaseRequestResponseDto } from './procurement-request-response.dto';

/** Response danh sách PR chuẩn v2: `items`, `pagination`, `summaries`. */
export class PurchaseRequestListResponseDto {
  @ApiProperty({ type: () => [PurchaseRequestResponseDto] })
  items: PurchaseRequestResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  pagination: PaginationMetaDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description:
      'Tổng toàn bộ dòng khớp bộ lọc, theo tên cột số (khớp V2Column.key). Ví dụ: estimatedTotal',
  })
  summaries: Record<string, number>;
}
