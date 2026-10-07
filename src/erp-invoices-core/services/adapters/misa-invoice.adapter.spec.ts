import { MisaInvoiceAdapter } from './misa-invoice.adapter';
import { ProviderAdapterRegistry } from './provider-adapter.registry';

describe('MisaInvoiceAdapter', () => {
  let adapter: MisaInvoiceAdapter;
  let mockRegistry: Partial<ProviderAdapterRegistry>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockRegistry = { register: jest.fn() };
    adapter = new MisaInvoiceAdapter(mockRegistry as ProviderAdapterRegistry);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should register on module init and handle MISA/MEINVOICE provider', () => {
    adapter.onModuleInit();
    expect(mockRegistry.register).toHaveBeenCalledWith(adapter);
    expect(adapter.canHandle('MISA')).toBe(true);
    expect(adapter.canHandle('misa')).toBe(true);
    expect(adapter.canHandle('MEINVOICE')).toBe(true);
    expect(adapter.canHandle('VIETTEL')).toBe(false);
  });

  it('should return error when transactionId is missing', async () => {
    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '5138',
      lookupCode: '',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Thiếu mã tra cứu TransactionID');
  });

  it('should download original PDF successfully when MISA session and download succeed', async () => {
    const fakePdf = Buffer.alloc(1000);
    Buffer.from('%PDF-1.4 MISA meInvoice original stream').copy(fakePdf);

    const arrayBuffer = fakePdf.buffer.slice(
      fakePdf.byteOffset,
      fakePdf.byteOffset + fakePdf.byteLength,
    );

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          getSetCookie: () => ['_msid=mock-cookie; path=/'],
          get: () => '_msid=mock-cookie; path=/',
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          customData: 'mock-ext-token-123',
          data: '<xml>dummy</xml>',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
      });

    global.fetch = fetchMock as any;

    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '5138',
      lookupCode: '25F9CJNXWZWG',
    });

    expect(res.success).toBe(true);
    expect(res.source).toBe('provider_original');
    expect(res.pdfBuffer?.toString()).toContain('%PDF');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('should return error when invoice not found or rejected by MISA', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          getSetCookie: () => [],
          get: () => null,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: false,
          errorCode: 'InvoiceDataEmpty',
        }),
      });

    global.fetch = fetchMock as any;

    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '5138',
      lookupCode: 'INVALID_CODE',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('MISA meInvoice từ chối tra cứu');
  });
});
