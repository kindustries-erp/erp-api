import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StockVoucherLineResponseDto {
  @ApiProperty() id: string;
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

/** Chứng từ kho trả về cho client: chỉ dữ liệu, không trả entity. */
export class StockVoucherResponseDto {
  @ApiProperty() id: string;
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
  @ApiProperty({ type: [StockVoucherLineResponseDto] })
  lines: StockVoucherLineResponseDto[];
}
