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

  it('should register on module init and handle MISA provider', () => {
    adapter.onModuleInit();
    expect(mockRegistry.register).toHaveBeenCalledWith(adapter);
    expect(adapter.canHandle('MISA')).toBe(true);
    expect(adapter.canHandle('misa')).toBe(true);
    expect(adapter.canHandle('VIETTEL')).toBe(false);
  });

  it('should return error when transactionId is missing', async () => {
    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '12345',
      lookupCode: '',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Thiếu mã tra cứu / TransactionID');
  });

  it('should download original PDF successfully when candidate endpoint returns PDF', async () => {
    const fakePdf = Buffer.from('%PDF-1.4 MISA sample stream');
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
      lookupCode: '50FBTGR_QBRJ',
    });

    expect(res.success).toBe(true);
    expect(res.source).toBe('provider_original');
    expect(res.pdfBuffer?.toString()).toContain('%PDF');
  });

  it('should return friendly fallback error when endpoints fail', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as any);

    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '12345',
      lookupCode: '50FBTGR_QBRJ',
    });

    expect(res.success).toBe(false);
    expect(res.source).toBe('failed');
    expect(res.error).toContain('liên kết tra cứu 1-chạm');
  });
});
