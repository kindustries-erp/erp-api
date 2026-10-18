import { HiloInvoiceAdapter } from './hilo-invoice.adapter';
import { ProviderAdapterRegistry } from './provider-adapter.registry';

describe('HiloInvoiceAdapter', () => {
  let adapter: HiloInvoiceAdapter;
  let mockRegistry: Partial<ProviderAdapterRegistry>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockRegistry = { register: jest.fn() };
    adapter = new HiloInvoiceAdapter(mockRegistry as ProviderAdapterRegistry);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should register on module init and handle HILO/GSM provider', () => {
    adapter.onModuleInit();
    expect(mockRegistry.register).toHaveBeenCalledWith(adapter);
    expect(adapter.canHandle('HILO')).toBe(true);
    expect(adapter.canHandle('hilo')).toBe(true);
    expect(adapter.canHandle('GSM')).toBe(true);
    expect(adapter.canHandle('VIETTEL')).toBe(false);
  });

  it('should return error when searchKey is missing', async () => {
    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '63733313',
      lookupCode: '',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Thiếu mã tra cứu SearchKey');
  });

  it('should download original PDF successfully when search returns ID and pdf is valid', async () => {
    const fakePdf = Buffer.alloc(1000);
    Buffer.from('%PDF-1.4 GSM original e-invoice stream').copy(fakePdf);

    const arrayBuffer = fakePdf.buffer.slice(
      fakePdf.byteOffset,
      fakePdf.byteOffset + fakePdf.byteLength,
    );

    // Mock 3 lần gọi: home, search, getPdf
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: jest
          .fn()
          .mockResolvedValue(
            'name="__RequestVerificationToken" type="hidden" value="mock-token"',
          ),
        headers: { get: jest.fn().mockReturnValue('token=123; path=/') },
      })
      .mockResolvedValueOnce({
        ok: true,
        text: jest
          .fn()
          .mockResolvedValue(
            "ShowInvTemplate('mock-inv-id-123', '1C26MHD_63733313')",
          ),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
      });

    global.fetch = fetchMock as any;

    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '63733313',
      lookupCode: '01M3XAJM2R6SP3BASMMCBJ9K2N',
    });

    expect(res.success).toBe(true);
    expect(res.source).toBe('provider_original');
    expect(res.pdfBuffer?.toString()).toContain('%PDF');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('should return error when invoice not found in search result', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: jest
          .fn()
          .mockResolvedValue('name="__RequestVerificationToken" value="token"'),
        headers: { get: jest.fn().mockReturnValue(null) },
      })
      .mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue('<div>Không tìm thấy hóa đơn</div>'),
      });

    global.fetch = fetchMock as any;

    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '63733313',
      lookupCode: 'INVALID_KEY',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Không tìm thấy hóa đơn trên cổng HILO');
  });
});
