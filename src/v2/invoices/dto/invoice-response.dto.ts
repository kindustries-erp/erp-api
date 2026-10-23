import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Hình dạng dữ liệu trả ra API. Không trả entity trực tiếp. */
export class InvoiceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  invoiceNo: string;

  @ApiPropertyOptional()
  serialNo?: string;

  @ApiProperty()
  invoiceDate: string;

  @ApiProperty()
  direction: string;

  @ApiPropertyOptional()
  status?: string;

  @ApiPropertyOptional()
  sellerName?: string;

  @ApiPropertyOptional()
  sellerTaxCode?: string;

  @ApiPropertyOptional()
  buyerName?: string;

  @ApiPropertyOptional()
  buyerTaxCode?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  invoiceType?: string;

  @ApiPropertyOptional()
  invoiceCategory?: string;

  @ApiPropertyOptional()
  preVatAmount?: number;

  @ApiPropertyOptional()
  vatRate?: number;

  @ApiPropertyOptional()
  vatAmount?: number;

  @ApiPropertyOptional()
  discountAmount?: number;

  @ApiPropertyOptional()
  totalAmount?: number;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty({ type: [String] })
  branchIds: string[];

  @ApiPropertyOptional()
  categoryId?: string;

  @ApiProperty()
  isValid: boolean;

  @ApiProperty()
  postingStatus: string;

  @ApiPropertyOptional()
  pdfFileKey?: string;

  @ApiPropertyOptional()
  xmlFileKey?: string;

  @ApiPropertyOptional({ type: Object })
  effectiveData?: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
