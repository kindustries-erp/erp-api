import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';
import {
  SUMMARIES_SWAGGER_SCHEMA,
  SummaryMetricDto,
} from '@/common/dto/summary-metric.dto';
import { PurchaseRequestResponseDto } from './procurement-request-response.dto';

/** Response danh sách PR chuẩn v2: `items`, `pagination`, `summaries`. */
export class PurchaseRequestListResponseDto {
  @ApiProperty({ type: () => [PurchaseRequestResponseDto] })
  items: PurchaseRequestResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  pagination: PaginationMetaDto;

  @ApiProperty(SUMMARIES_SWAGGER_SCHEMA)
  summaries: Record<string, SummaryMetricDto | null>;
}
