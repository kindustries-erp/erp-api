import { VinfastInvoiceAdapter } from './vinfast-invoice.adapter';
import { InvoiceCaptchaSolverService } from '../original-pdf/invoice-captcha-solver.service';
import { ProviderAdapterRegistry } from './provider-adapter.registry';

describe('VinfastInvoiceAdapter', () => {
  let adapter: VinfastInvoiceAdapter;
  let mockCaptchaSolver: Partial<InvoiceCaptchaSolverService>;
  let mockRegistry: Partial<ProviderAdapterRegistry>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockCaptchaSolver = {
      solveCaptchaImage: jest.fn().mockResolvedValue('6898'),
    };
    mockRegistry = {
      register: jest.fn(),
    };
    adapter = new VinfastInvoiceAdapter(
      mockCaptchaSolver as InvoiceCaptchaSolverService,
      mockRegistry as ProviderAdapterRegistry,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should register on module init and handle VINFAST provider', () => {
    adapter.onModuleInit();
    expect(mockRegistry.register).toHaveBeenCalledWith(adapter);
    expect(adapter.canHandle('VINFAST')).toBe(true);
    expect(adapter.canHandle('vinfast')).toBe(true);
    expect(adapter.canHandle('MISA')).toBe(false);
  });

  it('should return error when lookupCode is missing', async () => {
    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '12345',
      lookupCode: '',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Thiếu mã tra cứu');
  });

  it('should detect WAF / Cloudflare block and return friendly instructions', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      headers: new Headers(),
      text: jest
        .fn()
        .mockResolvedValue(
          '<html><body>Request Rejected. Support ID: 1234</body></html>',
        ),
    } as any);

    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '12345',
      lookupCode: 'ptZNNF',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Cloudflare/WAF');
  });

  it('should download original PDF successfully when portal responds', async () => {
    const fakePdf = Buffer.from('%PDF-1.4 test invoice content');
    const mockHeaders = new Headers();
    mockHeaders.set('set-cookie', 'ASP.NET_SessionId=xyz123; path=/');

    global.fetch = jest
      .fn()
      // Call 1: GET SearchBySalt (Session)
      .mockResolvedValueOnce({
        headers: mockHeaders,
        text: jest
          .fn()
          .mockResolvedValue(
            '<input name="__RequestVerificationToken" type="hidden" value="token123" />',
          ),
      } as any)
      // Call 2: GET Captcha
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(10)),
      } as any)
      // Call 3: POST SearchBySalt
      .mockResolvedValueOnce({
        text: jest
          .fn()
          .mockResolvedValue(
            '<div><a href="/TraCuu/DownloadPdf?id=999">Tải hóa đơn</a></div>',
          ),
      } as any)
      // Call 4: GET PDF
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(
            fakePdf.buffer.slice(
              fakePdf.byteOffset,
              fakePdf.byteOffset + fakePdf.byteLength,
            ),
          ),
      } as any);

    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '12345',
      lookupCode: 'ptZNNF',
    });

    expect(res.success).toBe(true);
    expect(res.source).toBe('provider_original');
    expect(res.pdfBuffer?.toString()).toContain('%PDF');
  });
});
