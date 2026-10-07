export interface DownloadPdfParams {
  invoiceId?: string;
  invoiceNo: string;
  serialNo?: string | null;
  invoiceDate?: string | null;
  sellerTaxCode?: string | null;
  buyerTaxCode?: string | null;
  lookupCode?: string | null;
  lookupUrl?: string | null;
  xmlContent?: string | null;
  extraInfo?: Record<string, string>;
}

export interface DownloadPdfResult {
  success: boolean;
  pdfBuffer?: Buffer;
  source: 'provider_original' | 'manual_upload' | 'failed';
  error?: string;
  contentType?: string;
}

export interface IProviderAdapter {
  readonly providerCode: string;
  canHandle(providerCode: string): boolean;
  downloadOriginalPdf(params: DownloadPdfParams): Promise<DownloadPdfResult>;
}
