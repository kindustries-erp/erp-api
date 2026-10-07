import AdmZip from 'adm-zip';
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
      solveCaptchaImage: jest.fn().mockResolvedValue('1234'),
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

  it('should register on module init and handle EASYINVOICE and SOFTDREAMS provider', () => {
    adapter.onModuleInit();
    expect(mockRegistry.register).toHaveBeenCalledWith(adapter);
    expect(adapter.canHandle('EASYINVOICE')).toBe(true);
    expect(adapter.canHandle('easyinvoice')).toBe(true);
    expect(adapter.canHandle('SOFTDREAMS')).toBe(true);
    expect(adapter.canHandle('softdreams')).toBe(true);
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
    const fakePdf = Buffer.from(
      '%PDF-1.4 EasyInvoice valid stream padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding',
    );
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
  });

  it('should download and extract PDF from EasyInvoice server export zip via AI Captcha pipeline', async () => {
    // Tạo file zip chứa 1 file PDF hợp lệ
    const validPdfBuffer = Buffer.from(
      '%PDF-1.4 Official EasyInvoice PDF stream padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding',
    );
    const zip = new AdmZip();
    zip.addFile('307_1C26TAA.pdf', validPdfBuffer);
    const zipBuffer = zip.toBuffer();
    const zipArrayBuffer = zipBuffer.buffer.slice(
      zipBuffer.byteOffset,
      zipBuffer.byteOffset + zipBuffer.byteLength,
    );

    const fakeCaptchaImg = Buffer.from(
      'fake-captcha-image-data-length-over-100-bytes-padding-padding-padding-padding-padding-padding-padding-padding-padding-padding-padding-padding-padding',
    );
    const searchHtml = `
      <html>
        <body>
          <input id="InvData" value="{&quot;str&quot;:&quot;&lt;body&gt;&lt;div id=\\&quot;printView\\&quot;&gt;Invoice Content&lt;/div&gt;&lt;/body&gt;&quot;}" />
          <script>
            showInv('', '', '', '', '', '', '', '', '', '', 'mock-inv-token-xyz');
          </script>
        </body>
      </html>
    `;

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/Captcha/Show')) {
        return Promise.resolve({
          ok: true,
          headers: {
            getSetCookie: () => ['ASP.NET_SessionId=mock-session; path=/'],
            get: () => 'ASP.NET_SessionId=mock-session; path=/',
          },
          arrayBuffer: () =>
            Promise.resolve(
              fakeCaptchaImg.buffer.slice(
                fakeCaptchaImg.byteOffset,
                fakeCaptchaImg.byteOffset + fakeCaptchaImg.byteLength,
              ),
            ),
        });
      }
      if (url.includes('/Search/Search')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(searchHtml),
        });
      }
      if (url.includes('/DownloadPdfAndFileAttachFromAvailableHtml')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              fileGuid: 'mock-guid-123',
              fileName: 'invoice.zip',
            }),
        });
      }
      if (url.includes('/Invoice/Download')) {
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(zipArrayBuffer),
        });
      }
      // candidate direct URLs fail
      return Promise.resolve({ ok: false, status: 404 });
    });

    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '307',
      lookupCode: 'fd4b203e-a884-42b7-9068-510a8272f0f8',
      sellerTaxCode: '0318880490',
      lookupUrl: 'https://tracuu.easyinvoice.vn',
    });

    expect(res.success).toBe(true);
    expect(res.source).toBe('provider_original');
    expect(res.pdfBuffer?.subarray(0, 4).toString()).toBe('%PDF');
    expect(mockCaptchaSolver.solveCaptchaImage).toHaveBeenCalled();
  });

  it('should return error when all attempts fail', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as any);

    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '12345',
      lookupCode: 'invalid-fkey',
      lookupUrl: 'https://tracuu.easyinvoice.vn',
    });

    expect(res.success).toBe(false);
    expect(res.source).toBe('failed');
    expect(res.error).toContain(
      'Không thể tải tệp PDF gốc từ cổng EasyInvoice',
    );
  });
});
