import { ViettelInvoiceAdapter } from './viettel-invoice.adapter';
import { ProviderAdapterRegistry } from './provider-adapter.registry';

describe('ViettelInvoiceAdapter', () => {
  let adapter: ViettelInvoiceAdapter;
  let mockRegistry: Partial<ProviderAdapterRegistry>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockRegistry = { register: jest.fn() };
    adapter = new ViettelInvoiceAdapter(
      mockRegistry as ProviderAdapterRegistry,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should register on module init and handle VIETTEL provider', () => {
    adapter.onModuleInit();
    expect(mockRegistry.register).toHaveBeenCalledWith(adapter);
    expect(adapter.canHandle('VIETTEL')).toBe(true);
    expect(adapter.canHandle('viettel')).toBe(true);
    expect(adapter.canHandle('MISA')).toBe(false);
  });

  it('should return error when reservationCode is missing', async () => {
    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '12345',
      lookupCode: '',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Thiếu mã số bí mật / ReservationCode');
  });

  it('should download original PDF successfully when candidate endpoint returns PDF', async () => {
    const fakePdf = Buffer.from('%PDF-1.4 Viettel sample stream');
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
      lookupCode: 'OAD0M4DWGEAXVZF',
      sellerTaxCode: '0100109106',
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
      lookupCode: 'OAD0M4DWGEAXVZF',
    });

    expect(res.success).toBe(false);
    expect(res.source).toBe('failed');
    expect(res.error).toContain('liên kết tra cứu 1-chạm');
  });
});
