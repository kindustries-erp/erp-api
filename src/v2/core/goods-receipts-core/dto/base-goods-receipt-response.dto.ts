import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BaseGoodsReceiptLineResponseDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  extraData: Record<string, unknown>;
  @ApiProperty()
  id: string;

  @ApiProperty()
  lineNo: number;

  @ApiPropertyOptional()
  itemCode?: string;

  @ApiProperty()
  itemName: string;

  @ApiProperty()
  unit: string;

  @ApiProperty()
  qtyReceived: number;

  @ApiProperty()
  unitCost: number;

  @ApiProperty()
  amount: number;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  createdAt: Date;
}

export class BaseGoodsReceiptResponseDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  extraData: Record<string, unknown>;
  @ApiProperty()
  id: string;

  @ApiProperty()
  receiptNo: string;

  @ApiProperty()
  receiptDate: Date;

  @ApiPropertyOptional()
  supplierId?: string;

  @ApiPropertyOptional()
  supplierName?: string;

  @ApiPropertyOptional()
  branchId?: string;

  @ApiPropertyOptional()
  branchName?: string;

  @ApiPropertyOptional()
  totalAmount?: number;

  @ApiPropertyOptional()
  status?: string;

  @ApiPropertyOptional()
  remarks?: string;

  @ApiPropertyOptional({ type: [BaseGoodsReceiptLineResponseDto] })
  lines?: BaseGoodsReceiptLineResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
