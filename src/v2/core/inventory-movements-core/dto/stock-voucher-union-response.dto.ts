import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';

/** Một dòng của danh sách chứng từ kho gộp. `type` là mã loại do module khai báo. */
export class StockVoucherUnionItemDto {
  @ApiProperty() id: string;
  @ApiProperty({ description: 'Loại phiếu, ví dụ PURCHASE_RECEIPT, ISSUE' })
  type: string;
  @ApiProperty() voucherNo: string;
  @ApiProperty() voucherDate: Date;
  @ApiProperty() status: string;
  @ApiPropertyOptional({ nullable: true, type: String }) partnerName:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true, type: String }) branchId:
    | string
    | null;
  @ApiProperty() totalAmount: number;
  @ApiPropertyOptional({ nullable: true, type: String }) remarks: string | null;
  @ApiProperty() createdAt: Date;
}

/** Số liệu tổng của một cột theo bộ lọc và sắp xếp đang áp dụng. */
export class StockVoucherUnionSummaryDto {
  @ApiProperty() total: number;
  @ApiProperty() pageSubtotal: number;
  @ApiProperty() cumulative: number;
}

export class StockVoucherUnionListResponseDto {
  @ApiProperty({ type: [StockVoucherUnionItemDto] })
  items: StockVoucherUnionItemDto[];
  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'object', nullable: true },
    description: 'Tổng theo `summary_keys`; khóa không tính được trả null',
  })
  summaries: Record<string, StockVoucherUnionSummaryDto | null>;
  @ApiProperty({
    type: 'object',
    description:
      'Dữ liệu phụ: `typeCounts` là số phiếu theo loại, bỏ qua bộ lọc loại',
    properties: {
      typeCounts: {
        type: 'object',
        additionalProperties: { type: 'number' },
      },
    },
  })
  extraData: { typeCounts: Record<string, number> };
}
