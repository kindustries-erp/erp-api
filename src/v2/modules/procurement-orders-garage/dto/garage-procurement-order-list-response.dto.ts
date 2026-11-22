import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';
import {
  SUMMARIES_SWAGGER_SCHEMA,
  SummaryMetricDto,
} from '@/common/dto/summary-metric.dto';
import { GarageProcurementOrderResponseDto } from './garage-procurement-order-response.dto';

/** Response danh sách PO garage chuẩn v2: `items`, `pagination`, `summaries`. */
export class GarageProcurementOrderListResponseDto {
  @ApiProperty({ type: () => [GarageProcurementOrderResponseDto] })
  items: GarageProcurementOrderResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  pagination: PaginationMetaDto;

  @ApiProperty(SUMMARIES_SWAGGER_SCHEMA)
  summaries: Record<string, SummaryMetricDto | null>;
}
