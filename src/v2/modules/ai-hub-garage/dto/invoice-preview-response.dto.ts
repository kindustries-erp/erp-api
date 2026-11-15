import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvoicePreviewHeaderDto {
  @ApiPropertyOptional({ nullable: true }) sellerName: string | null;
  @ApiPropertyOptional({ nullable: true }) sellerTaxCode: string | null;
  @ApiPropertyOptional({ nullable: true }) invoiceNo: string | null;
  @ApiPropertyOptional({ nullable: true }) invoiceDate: string | null;
  @ApiPropertyOptional({ nullable: true }) total: number | null;
}

export class InvoicePreviewMatchDto {
  @ApiProperty({ enum: ['MATCHED', 'NEW'] })
  status: 'MATCHED' | 'NEW';

  @ApiPropertyOptional({ enum: ['CODE', 'NAME'] })
  matchedBy?: 'CODE' | 'NAME';

  @ApiPropertyOptional()
  itemId?: string;

  @ApiPropertyOptional({ description: 'Tên trong danh mục của mã đã khớp' })
  catalogItemName?: string;
}

export class InvoicePreviewLineDto {
  @ApiProperty() itemName: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Mã đã khớp, hoặc mã đề xuất cho dòng mới. null: server sinh số khi tạo',
  })
  itemCode: string | null;

  @ApiPropertyOptional({ nullable: true }) unit: string | null;
  @ApiProperty() qtyRequested: number;
  @ApiPropertyOptional({ nullable: true }) estUnitPrice: number | null;
  @ApiProperty() itemType: string;
  @ApiProperty({ enum: ['GOODS', 'SERVICE'] }) lineType: 'GOODS' | 'SERVICE';
  @ApiProperty({ type: InvoicePreviewMatchDto }) match: InvoicePreviewMatchDto;
}

export class InvoicePreviewResponseDto {
  @ApiProperty({ type: InvoicePreviewHeaderDto })
  invoice: InvoicePreviewHeaderDto;

  @ApiProperty({ type: [InvoicePreviewLineDto] })
  lines: InvoicePreviewLineDto[];

  @ApiProperty({ type: [String], description: 'Mã cảnh báo cho người dùng' })
  warnings: string[];

  @ApiProperty({ description: 'Tier và model đã dùng để đọc tài liệu' })
  ai: { tier: string; model: string; latencyMs: number };
}
