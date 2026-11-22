import { ApiProperty } from '@nestjs/swagger';

/** Số liệu tổng của một cột trong `summaries` của list V2 (khớp `SummaryMetric`). */
export class SummaryMetricDto {
  @ApiProperty({ description: 'Tổng toàn bộ dòng khớp bộ lọc' })
  total: number;

  @ApiProperty({ description: 'Tổng riêng trang hiện tại' })
  pageSubtotal: number;

  @ApiProperty({ description: 'Tổng từ dòng 1 đến hết trang hiện tại' })
  cumulative: number;
}

/** Schema Swagger của `summaries`: map key → SummaryMetricDto hoặc null. Dùng chung cho mọi list V2. */
export const SUMMARIES_SWAGGER_SCHEMA = {
  type: 'object' as const,
  additionalProperties: {
    nullable: true,
    type: 'object' as const,
    properties: {
      total: { type: 'number' as const },
      pageSubtotal: { type: 'number' as const },
      cumulative: { type: 'number' as const },
    },
  },
  description:
    'Theo summary_keys do FE gửi (khớp V2Column.key). Mỗi key: total (toàn bộ dòng khớp), pageSubtotal (trang hiện tại), cumulative (đến hết trang hiện tại). Key không tính được là null.',
};
