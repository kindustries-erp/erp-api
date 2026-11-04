import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Một dòng hàng hóa trả ra API. */
export class BaseInvoiceLineResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  invoiceSubcategory!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  unit?: string;

  @ApiPropertyOptional()
  itemCode?: string;

  @ApiPropertyOptional()
  quantity?: number;

  @ApiPropertyOptional()
  unitPrice?: number;

  @ApiProperty()
  preVatAmount!: number;

  @ApiPropertyOptional()
  vatRate?: number;

  @ApiProperty()
  vatAmount!: number;

  @ApiProperty()
  discountAmount!: number;

  @ApiProperty()
  totalAmount!: number;
}

/** Hình dạng dữ liệu trả ra API. Không trả entity trực tiếp. */
export class BaseInvoiceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  invoiceNo!: string;

  @ApiPropertyOptional()
  invoiceNoNormalized?: string;

  @ApiPropertyOptional()
  serialNo?: string;

  @ApiProperty()
  invoiceDate!: string;

  @ApiProperty()
  direction!: string;

  @ApiPropertyOptional()
  status?: string;

  @ApiPropertyOptional()
  taxInvoiceStatus?: number;

  @ApiPropertyOptional()
  taxProcessStatus?: number;

  @ApiPropertyOptional()
  sellerName?: string;

  @ApiPropertyOptional()
  sellerTaxCode?: string;

  @ApiPropertyOptional()
  sellerAddress?: string;

  @ApiPropertyOptional()
  sellerBank?: string;

  @ApiPropertyOptional()
  buyerName?: string;

  @ApiPropertyOptional()
  buyerPersonalName?: string;

  @ApiPropertyOptional()
  buyerTaxCode?: string;

  @ApiPropertyOptional()
  buyerCccd?: string;

  @ApiPropertyOptional()
  buyerAddress?: string;

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

  /** Chỉ có trong danh sách (`GET /`), tổng số đã cấn trừ của hóa đơn. */
  @ApiPropertyOptional()
  netOffAmount?: number;

  /** Chỉ có trong danh sách (`GET /`), số tiền còn lại sau cấn trừ. */
  @ApiPropertyOptional()
  remainingAmount?: number;

  @ApiPropertyOptional()
  purchaseOrderId?: string;

  @ApiPropertyOptional()
  salesOrderId?: string;

  @ApiPropertyOptional()
  paymentDocumentNos?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiPropertyOptional()
  settlementOrder?: string;

  @ApiPropertyOptional()
  licensePlate?: string;

  @ApiPropertyOptional()
  relatedInvoiceNo?: string;

  @ApiPropertyOptional()
  relatedSerialNo?: string;

  @ApiProperty({ type: [String] })
  branchIds!: string[];

  @ApiPropertyOptional()
  categoryId?: string;

  @ApiProperty()
  isValid!: boolean;

  @ApiProperty()
  postingStatus!: string;

  @ApiPropertyOptional()
  createdBy?: string;

  @ApiPropertyOptional()
  pdfFileKey?: string;

  @ApiPropertyOptional()
  xmlFileKey?: string;

  @ApiPropertyOptional({ type: Object })
  effectiveData?: Record<string, unknown>;

  /** Chỉ có ở `GET :id`, không có trong danh sách. */
  @ApiPropertyOptional({ type: [BaseInvoiceLineResponseDto] })
  items?: BaseInvoiceLineResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
