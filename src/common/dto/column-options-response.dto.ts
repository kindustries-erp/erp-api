import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from './pagination-meta.dto';

/** Một giá trị gợi ý của bộ lọc cột. */
export class ColumnOptionItemDto {
  @ApiProperty({ description: 'Nhãn hiển thị', example: 'PO-2026-001' })
  label: string;

  @ApiProperty({
    description: 'Giá trị gửi lên khi lọc',
    example: 'PO-2026-001',
  })
  value: string;
}

/** Response gợi ý giá trị cột (`column-options`) chuẩn v2: `items` và `pagination`. */
export class ColumnOptionsResponseDto {
  @ApiProperty({ type: () => [ColumnOptionItemDto] })
  items: ColumnOptionItemDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  pagination: PaginationMetaDto;
}
