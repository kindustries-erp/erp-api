import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';

export class StockVoucherLineResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  extraData: Record<string, unknown>;
  @ApiProperty() lineNo: number;
  @ApiProperty() itemCode: string;
  @ApiProperty() itemName: string;
  @ApiProperty() unit: string;
  @ApiProperty() qty: number;
  @ApiPropertyOptional({ nullable: true, type: Number }) unitCost:
    | number
    | null;
  @ApiProperty() amount: number;
  @ApiProperty({ enum: ['IN', 'OUT'] }) direction: 'IN' | 'OUT';
  @ApiPropertyOptional({ nullable: true, type: String }) notes: string | null;
}

/** Dòng danh sách chứng từ kho: đầu phiếu, không có dòng chi tiết. */
export class StockVoucherListItemResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  extraData: Record<string, unknown>;
  @ApiProperty() voucherNo: string;
  @ApiProperty() voucherDate: Date;
  @ApiProperty() status: string;
  @ApiPropertyOptional({ nullable: true, type: String }) branchId:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true, type: String }) partnerName:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true, type: String }) remarks: string | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) totalAmount:
    | number
    | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

/** Chứng từ kho trả về cho client: chỉ dữ liệu, không trả entity. */
export class StockVoucherResponseDto extends StockVoucherListItemResponseDto {
  @ApiProperty({ type: [StockVoucherLineResponseDto] })
  lines: StockVoucherLineResponseDto[];
}

export class StockVoucherListResponseDto {
  @ApiProperty({ type: [StockVoucherListItemResponseDto] })
  items: StockVoucherListItemResponseDto[];
  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}
