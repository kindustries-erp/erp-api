import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';

export class StockBalanceItemDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional({ nullable: true, type: String }) branchId:
    | string
    | null;
  @ApiProperty() itemCode: string;
  @ApiProperty() itemName: string;
  @ApiProperty() unit: string;
  @ApiProperty() qtyOnHand: number;
  @ApiProperty() avgCost: number;
  @ApiProperty() inventoryValue: number;
  @ApiProperty({ description: 'Nhập cộng dồn toàn thời gian' })
  qtyReceived: number;
  @ApiProperty({ description: 'Xuất cộng dồn toàn thời gian' })
  qtyIssued: number;
  @ApiProperty({ description: 'Điều chỉnh cộng dồn, có dấu' })
  qtyAdjusted: number;
  @ApiProperty() updatedAt: Date;
}

export class StockBalanceSummaryDto {
  @ApiProperty() total: number;
  @ApiProperty() pageSubtotal: number;
  @ApiProperty() cumulative: number;
}

export class StockBalanceExtraDataDto {
  @ApiProperty({ description: 'Số mã theo từng tab, bỏ qua lọc tab' })
  tabCounts: Record<string, number>;
}

export class StockBalanceListResponseDto {
  @ApiProperty({ type: [StockBalanceItemDto] }) items: StockBalanceItemDto[];
  @ApiProperty({ type: PaginationMetaDto }) pagination: PaginationMetaDto;
  @ApiProperty({
    description: 'Tổng toàn bộ và subtotal trang theo từng chỉ số',
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(StockBalanceSummaryDto) },
  })
  summaries: Record<string, StockBalanceSummaryDto>;
  @ApiProperty({ type: StockBalanceExtraDataDto })
  extraData: StockBalanceExtraDataDto;
}

export class StockTransactionItemDto {
  @ApiProperty() id: string;
  @ApiProperty() transactionDate: Date;
  @ApiProperty() transactionType: string;
  @ApiProperty() documentType: string;
  @ApiProperty() documentId: string;
  @ApiProperty() qtyIn: number;
  @ApiProperty() qtyOut: number;
  @ApiProperty() unitCost: number;
}

export class StockTransactionListResponseDto {
  @ApiProperty({ type: [StockTransactionItemDto] })
  items: StockTransactionItemDto[];
  @ApiProperty({ type: PaginationMetaDto }) pagination: PaginationMetaDto;
}
