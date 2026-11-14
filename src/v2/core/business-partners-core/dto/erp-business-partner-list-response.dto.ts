import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';
import { ErpBusinessPartnerResponseDto } from './erp-business-partner-response.dto';

/** Response danh sách đối tác chuẩn v2: `items`, `pagination`, `summaries`. */
export class ErpBusinessPartnerListResponseDto {
  @ApiProperty({ type: () => [ErpBusinessPartnerResponseDto] })
  items: ErpBusinessPartnerResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  pagination: PaginationMetaDto;

  @ApiProperty({
    type: Object,
    description: 'Tổng cột số trên toàn bộ dòng khớp (thường rỗng)',
  })
  summaries: Record<string, unknown>;
}
