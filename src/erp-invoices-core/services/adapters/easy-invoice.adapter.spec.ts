import { EasyInvoiceAdapter } from './easy-invoice.adapter';
import { InvoiceCaptchaSolverService } from '../original-pdf/invoice-captcha-solver.service';
import { ProviderAdapterRegistry } from './provider-adapter.registry';

describe('EasyInvoiceAdapter', () => {
  let adapter: EasyInvoiceAdapter;
  let mockCaptchaSolver: Partial<InvoiceCaptchaSolverService>;
  let mockRegistry: Partial<ProviderAdapterRegistry>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockCaptchaSolver = {
      solveCaptchaImage: jest.fn(),
    };
    mockRegistry = {
      register: jest.fn(),
    };
    adapter = new EasyInvoiceAdapter(
      mockCaptchaSolver as InvoiceCaptchaSolverService,
      mockRegistry as ProviderAdapterRegistry,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should register on module init and handle EASYINVOICE provider', () => {
    adapter.onModuleInit();
    expect(mockRegistry.register).toHaveBeenCalledWith(adapter);
    expect(adapter.canHandle('EASYINVOICE')).toBe(true);
    expect(adapter.canHandle('easyinvoice')).toBe(true);
    expect(adapter.canHandle('VINFAST')).toBe(false);
  });

  it('should return error when lookupCode is missing', async () => {
    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '12345',
      lookupCode: '',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Thiếu mã tra cứu Fkey');
  });

  it('should download original PDF successfully when candidate endpoint returns PDF', async () => {
    const fakePdf = Buffer.from('%PDF-1.4 EasyInvoice valid stream');
    const arrayBuffer = fakePdf.buffer.slice(
      fakePdf.byteOffset,
      fakePdf.byteOffset + fakePdf.byteLength,
    );

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
    } as any);

    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '12345',
      lookupCode: '5b59bd60-498c-4fa6-8f2e-07a8bdf1efbe',
      lookupUrl: 'https://vinfastsaigon.easyinvoice.vn',
    });

    expect(res.success).toBe(true);
    expect(res.source).toBe('provider_original');
    expect(res.pdfBuffer?.toString()).toContain('%PDF');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('vinfastsaigon.easyinvoice.vn'),
      expect.any(Object),
    );
  });

  it('should return friendly error when all endpoints fail', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as any);

    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '12345',
      lookupCode: 'invalid-fkey',
      lookupUrl: 'https://tracuu.easyinvoice.vn',
    });

    expect(res.success).toBe(false);
    expect(res.source).toBe('failed');
    expect(res.error).toContain('liên kết tra cứu 1-chạm');
  });
});
