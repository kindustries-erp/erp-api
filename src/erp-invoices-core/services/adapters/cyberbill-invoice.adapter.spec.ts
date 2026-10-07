import { CyberbillInvoiceAdapter } from './cyberbill-invoice.adapter';
import { ProviderAdapterRegistry } from './provider-adapter.registry';
import { InvoiceCaptchaSolverService } from '../original-pdf/invoice-captcha-solver.service';

describe('CyberbillInvoiceAdapter', () => {
  let adapter: CyberbillInvoiceAdapter;
  let mockRegistry: Partial<ProviderAdapterRegistry>;
  let mockCaptchaSolver: Partial<InvoiceCaptchaSolverService>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockRegistry = {
      register: jest.fn(),
    };
    mockCaptchaSolver = {
      solveCaptchaBase64: jest.fn().mockResolvedValue('17768'),
    };
    adapter = new CyberbillInvoiceAdapter(
      mockRegistry as ProviderAdapterRegistry,
      mockCaptchaSolver as InvoiceCaptchaSolverService,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should register on module init and handle CYBERBILL / CYBERLOTUS / XCYBER', () => {
    adapter.onModuleInit();
    expect(mockRegistry.register).toHaveBeenCalledWith(adapter);
    expect(adapter.canHandle('CYBERBILL')).toBe(true);
    expect(adapter.canHandle('cyberbill')).toBe(true);
    expect(adapter.canHandle('CYBERLOTUS')).toBe(true);
    expect(adapter.canHandle('XCYBER')).toBe(true);
    expect(adapter.canHandle('MISA')).toBe(false);
  });

  it('should return error when lookupCode or sellerTaxCode is missing', async () => {
    const res1 = await adapter.downloadOriginalPdf({
      invoiceNo: '119',
      lookupCode: '',
      sellerTaxCode: '0318656403',
    });
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('Không tìm thấy mã số bí mật');

    const res2 = await adapter.downloadOriginalPdf({
      invoiceNo: '119',
      lookupCode: '1PKUE5K9Y9GC',
      sellerTaxCode: '',
    });
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('Không tìm thấy mã số thuế bên bán');
  });

  it('should download original PDF successfully when Cluster 1 returns fileToken and temp file downloads', async () => {
    const fakePdfBytes = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF' + ' '.repeat(500),
    );
    const arrayBuffer = fakePdfBytes.buffer.slice(
      fakePdfBytes.byteOffset,
      fakePdfBytes.byteOffset + fakePdfBytes.byteLength,
    );

    global.fetch = jest
      .fn()
      // 1. RefreshCaptcha
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: {
            key: 'cap-key-1',
            image: 'data:image/jpeg;base64,mockImageData',
          },
        }),
      } as any)
      // 2. TraCuu
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: {
            status: 1,
            key: 'session-key-123',
          },
        }),
      } as any)
      // 3. DownloadPdf
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: {
            status: 1,
            fileToken: 'token-abc',
            fileName: '0000119.pdf',
            fileType: 'text/xml',
          },
        }),
      } as any)
      // 4. DownloadTempFile
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
      } as any);

    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '119',
      lookupCode: '1PKUE5K9Y9GC',
      sellerTaxCode: '0318656403',
    });

    expect(res.success).toBe(true);
    expect(res.source).toBe('provider_original');
    expect(res.pdfBuffer).toBeDefined();
    expect(res.pdfBuffer!.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('should fallback to Cluster 2 when Cluster 1 returns status 4 and download successfully', async () => {
    const fakePdfBytes = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF' + ' '.repeat(500),
    );
    const arrayBuffer = fakePdfBytes.buffer.slice(
      fakePdfBytes.byteOffset,
      fakePdfBytes.byteOffset + fakePdfBytes.byteLength,
    );

    global.fetch = jest
      .fn()
      // Cluster 1: RefreshCaptcha
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: {
            key: 'cap-cluster-1',
            image: 'data:image/jpeg;base64,mockImage',
          },
        }),
      } as any)
      // Cluster 1: TraCuu -> Status 4
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: {
            status: 4,
          },
        }),
      } as any)
      // Cluster 2: RefreshCaptcha
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: {
            key: 'cap-cluster-2',
            image: 'data:image/jpeg;base64,mockImage2',
          },
        }),
      } as any)
      // Cluster 2: TraCuu -> Status 1
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: {
            status: 1,
            key: 'session-cluster-2',
          },
        }),
      } as any)
      // Cluster 2: DownloadPdf -> fileToken
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: {
            status: 1,
            fileToken: 'token-cluster-2',
            fileName: '0000119.pdf',
            fileType: 'text/xml',
          },
        }),
      } as any)
      // Cluster 2: DownloadTempFile -> PDF
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
      } as any);

    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '119',
      lookupCode: '1PKUE5K9Y9GC',
      sellerTaxCode: '0318656403',
    });

    expect(res.success).toBe(true);
    expect(res.source).toBe('provider_original');
    expect(res.pdfBuffer!.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('should retry when captcha is rejected (status 2) and succeed on second attempt', async () => {
    const fakePdfBytes = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF' + ' '.repeat(500),
    );

    global.fetch = jest
      .fn()
      // Attempt 1: RefreshCaptcha
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: { key: 'key-1', image: 'data:image/jpeg;base64,image-1' },
        }),
      } as any)
      // Attempt 1: TraCuu -> Status 2 (Sai captcha)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: { status: 2, message: 'Mã xác thực không hợp lệ' },
        }),
      } as any)
      // Attempt 2: RefreshCaptcha
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: { key: 'key-2', image: 'data:image/jpeg;base64,image-2' },
        }),
      } as any)
      // Attempt 2: TraCuu -> Status 1
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: { status: 1, key: 'sess-2' },
        }),
      } as any)
      // Attempt 2: DownloadPdf -> base64
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: {
            base64: fakePdfBytes.toString('base64'),
          },
        }),
      } as any);

    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '119',
      lookupCode: '1PKUE5K9Y9GC',
      sellerTaxCode: '0318656403',
    });

    expect(res.success).toBe(true);
    expect(mockCaptchaSolver.solveCaptchaBase64).toHaveBeenCalledTimes(2);
  });
});
