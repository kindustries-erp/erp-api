import AdmZip from 'adm-zip';
import { XmlDownloadLinkAdapter } from './xml-download-link.adapter';
import { ProviderAdapterRegistry } from './provider-adapter.registry';

const buildXml = (link: string) =>
  `<HDon><TTKhac><TTin><TTruong>SearchKey</TTruong><KDLieu>string</KDLieu><DLieu>abc</DLieu></TTin>` +
  `<TTin><TTruong>DownloadPdf</TTruong><KDLieu>string</KDLieu><DLieu>${link}</DLieu></TTin></TTKhac></HDon>`;

const fakePdf = () => {
  const buf = Buffer.alloc(600);
  Buffer.from('%PDF-1.4 test').copy(buf);
  return buf;
};

const fakeZip = (entryName: string, data: Buffer) => {
  const zip = new AdmZip();
  zip.addFile(entryName, data);
  return zip.toBuffer();
};

const okResponse = (body: Buffer) => ({
  ok: true,
  status: 200,
  arrayBuffer: jest
    .fn()
    .mockResolvedValue(
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    ),
});

describe('XmlDownloadLinkAdapter', () => {
  let adapter: XmlDownloadLinkAdapter;
  let mockRegistry: Partial<ProviderAdapterRegistry>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockRegistry = { register: jest.fn() };
    adapter = new XmlDownloadLinkAdapter(
      mockRegistry as ProviderAdapterRegistry,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('registers itself on module init and handles XML_LINK only', () => {
    adapter.onModuleInit();
    expect(mockRegistry.register).toHaveBeenCalledWith(adapter);
    expect(adapter.canHandle('XML_LINK')).toBe(true);
    expect(adapter.canHandle('xml_link')).toBe(true);
    expect(adapter.canHandle('OTHER')).toBe(false);
  });

  it('fails when xmlContent is missing', async () => {
    const res = await adapter.downloadOriginalPdf({ invoiceNo: '1' });
    expect(res.success).toBe(false);
    expect(res.source).toBe('failed');
    expect(res.error).toContain('DownloadPdf');
  });

  it('fails when XML has no DownloadPdf entry', async () => {
    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '1',
      xmlContent: '<HDon><TTKhac></TTKhac></HDon>',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('DownloadPdf');
  });

  it('rejects non-https or private-host links without fetching', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    for (const link of [
      'http://example.com/a.pdf',
      'http://localhost/a.pdf',
      'https://127.0.0.1/a.pdf',
      'https://192.168.1.10/a.pdf',
    ]) {
      const res = await adapter.downloadOriginalPdf({
        invoiceNo: '1',
        xmlContent: buildXml(link),
      });
      expect(res.success).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('downloads a raw PDF response', async () => {
    const pdf = fakePdf();
    global.fetch = jest.fn().mockResolvedValue(okResponse(pdf)) as any;

    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '168239',
      xmlContent: buildXml('example.com/getinvoice?token=abc'),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/getinvoice?token=abc',
      expect.anything(),
    );
    expect(res.success).toBe(true);
    expect(res.source).toBe('provider_original');
    expect(res.pdfBuffer?.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('extracts the PDF from a ZIP response', async () => {
    const zip = fakeZip('10_2026_1C02T_1C26TAA_168239.pdf', fakePdf());
    global.fetch = jest.fn().mockResolvedValue(okResponse(zip)) as any;

    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '168239',
      xmlContent: buildXml('https://example.com/getinvoice?token=abc'),
    });

    expect(res.success).toBe(true);
    expect(res.pdfBuffer?.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('fails when ZIP has no valid PDF', async () => {
    const zip = fakeZip('invoice.xml', Buffer.from('<HDon/>'));
    global.fetch = jest.fn().mockResolvedValue(okResponse(zip)) as any;

    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '1',
      xmlContent: buildXml('https://example.com/getinvoice'),
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('không chứa file PDF');
  });

  it('fails on HTTP error status', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 404 }) as any;

    const res = await adapter.downloadOriginalPdf({
      invoiceNo: '1',
      xmlContent: buildXml('https://example.com/getinvoice'),
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('HTTP 404');
  });
});
