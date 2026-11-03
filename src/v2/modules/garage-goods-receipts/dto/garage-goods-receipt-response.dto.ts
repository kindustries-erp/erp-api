import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GarageGoodsReceiptLineResponseDto {
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

/** Hình dạng dữ liệu trả ra API. Không trả entity trực tiếp. */
export class GarageGoodsReceiptResponseDto {
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
  paymentStatus?: string;

  @ApiPropertyOptional()
  remarks?: string;

  @ApiPropertyOptional({ type: [GarageGoodsReceiptLineResponseDto] })
  lines?: GarageGoodsReceiptLineResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
