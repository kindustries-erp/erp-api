export interface ExtractedInvoiceItem {
  itemName: string;
  itemCode?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatRate?: number;
}

export interface ExtractedInvoiceResult {
  invoiceNumber?: string;
  invoiceDate?: string;
  sellerTaxCode?: string;
  sellerName?: string;
  buyerTaxCode?: string;
  buyerName?: string;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  items: ExtractedInvoiceItem[];
  rawSummary?: string;
}

export interface ExtractedLicensePlateResult {
  licensePlate: string | null;
  formattedPlate: string | null;
  settlementOrder?: string | null;
  confidence: number;
  reason?: string;
}

/**
 * Lý do một hóa đơn không có danh mục (sẽ hạch toán vào TK tạm T0003):
 * - AI_ERROR: gọi AI lỗi hoặc phản hồi không parse được (nên chạy lại khi 9router ổn định)
 * - LOW_CONFIDENCE: AI trả lời nhưng độ tin cậy < ngưỡng
 * - INVALID_CODE: AI trả mã danh mục không thuộc 14 mã chuẩn
 */
export type InvoiceCategoryFallbackReason =
  | 'AI_ERROR'
  | 'LOW_CONFIDENCE'
  | 'INVALID_CODE';

export interface ClassifyInvoiceCategoryResult {
  categoryCode: string | null;
  confidence: number;
  reason: string;
  isVfDirectMatch?: boolean;
  /** true khi danh mục lấy từ lịch sử người bán (InvoiceCategoryMemoryService), không gọi AI. */
  fromMemory?: boolean;
  fallbackReason?: InvoiceCategoryFallbackReason;
}

export interface ClassifyLineItemInput {
  lineIndex: number;
  description?: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  preVatAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
  sellerName?: string;
  sellerTaxCode?: string;
  buyerName?: string;
}

export interface ClassifyLineItemResult {
  lineIndex: number;
  itemCode: string | null;
  itemType: 'PARTS' | 'SERVICE' | 'MATERIAL' | 'DISCOUNT' | 'OTHER';
  isDiscountDeduction: boolean;
  confidence: number;
  reason: string;
}

export interface ClassifyInvoiceInput {
  invoiceNo?: string;
  serialNo?: string;
  sellerName?: string;
  sellerTaxCode?: string;
  buyerName?: string;
  buyerTaxCode?: string;
  description?: string;
  notes?: string;
  totalAmount?: number;
  items?: Array<{
    description?: string;
    itemCode?: string;
    quantity?: number;
    unitPrice?: number;
    totalAmount?: number;
  }>;
}
