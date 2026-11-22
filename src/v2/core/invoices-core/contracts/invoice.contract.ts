export type InvoiceDirection = 'IN' | 'OUT';
export type InvoiceStatus = 'DRAFT' | 'ACTIVE' | 'CANCELLED';
export type InvoicePostingStatus = 'UNPOSTED' | 'POSTED';

export interface IInvoiceLine {
  id?: string;
  invoiceId?: string;
  lineNumber?: number | null;
  itemCode?: string | null;
  description?: string | null;
  unit?: string | null;
  quantity?: string | number | null;
  unitPrice?: string | number | null;
  preVatAmount?: string | number | null;
  vatRate?: string | number | null;
  vatAmount?: string | number | null;
  totalAmount?: string | number | null;
  discountAmount?: string | number | null;
  invoiceSubcategory?: string;
}

export interface IInvoiceHeader {
  id?: string;
  invoiceNo: string;
  invoiceNoNormalized?: string | null;
  serialNo?: string | null;
  invoiceDate: string | Date;
  direction: InvoiceDirection | string;
  status: InvoiceStatus | string;
  postingStatus?: InvoicePostingStatus | string;
  postingDate?: string | Date | null;
  sellerName?: string | null;
  sellerTaxCode?: string | null;
  sellerAddress?: string | null;
  buyerName?: string | null;
  buyerTaxCode?: string | null;
  buyerAddress?: string | null;
  preVatAmount?: string | number | null;
  vatRate?: string | number | null;
  vatAmount?: string | number | null;
  totalAmount?: string | number | null;
  discountAmount?: string | number | null;
  branchId?: string | null;
  branchIds?: string[];
  licensePlate?: string | null;
  settlementOrder?: string | null;
  notes?: string | null;
  description?: string | null;
  items?: IInvoiceLine[];
}
