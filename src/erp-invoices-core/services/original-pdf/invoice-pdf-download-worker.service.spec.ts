import { InvoicePdfDownloadWorkerService } from './invoice-pdf-download-worker.service';
import { ProviderAdapterRegistry } from '../adapters/provider-adapter.registry';
import { InvoiceProviderDetectorService } from './invoice-provider-detector.service';
import { R2Service } from '../../../r2/r2.service';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { ErpEInvoiceSync } from '../../entities/erp_einvoice_sync.entity';
import { Repository } from 'typeorm';

describe('InvoicePdfDownloadWorkerService', () => {
  let worker: InvoicePdfDownloadWorkerService;
  let invoiceRepo: { save: jest.Mock; findOne: jest.Mock };
  let registry: Partial<ProviderAdapterRegistry>;
  let r2: Partial<R2Service>;
  let detector: Partial<InvoiceProviderDetectorService>;

  beforeEach(() => {
    invoiceRepo = {
      save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
      findOne: jest.fn(),
    };
    registry = { getAdapter: jest.fn().mockReturnValue(undefined) };
    r2 = {
      downloadBuffer: jest.fn(),
      uploadBuffer: jest.fn().mockResolvedValue(undefined),
    };
    detector = { detectFromXml: jest.fn() };
    worker = new InvoicePdfDownloadWorkerService(
      invoiceRepo as unknown as Repository<ErpInvoice>,
      {} as Repository<ErpEInvoiceSync>,
      registry as ProviderAdapterRegistry,
      detector as InvoiceProviderDetectorService,
      r2 as R2Service,
      { get: jest.fn() } as any,
    );
  });

  it('does not touch a PDF the user uploaded manually', async () => {
    const invoice = {
      id: 'inv-1',
      providerCode: 'BKAV',
      lookupCode: 'M1',
      pdfSource: 'manual_upload',
      pdfFileKey: 'invoices/pdf/inv-1.pdf',
    } as any;

    const res = await worker.downloadSingleInvoice(invoice);

    expect(res.success).toBe(true);
    expect(r2.uploadBuffer).not.toHaveBeenCalled();
    expect(invoiceRepo.save).not.toHaveBeenCalled();
  });

  it('falls back to the XML_LINK adapter when the provider has no adapter', async () => {
    const xmlAdapter = {
      downloadOriginalPdf: jest.fn().mockResolvedValue({
        success: true,
        source: 'provider_original',
        pdfBuffer: Buffer.from('%PDF-1.4 ok'),
      }),
    };
    (registry.getAdapter as jest.Mock).mockImplementation((code: string) =>
      code === 'XML_LINK' ? xmlAdapter : undefined,
    );
    const invoice = {
      id: 'inv-2',
      invoiceNo: '2349',
      providerCode: 'OTHER',
      lookupCode: 'x',
      pdfSource: null,
    } as any;

    const res = await worker.downloadSingleInvoice(invoice);

    expect(res.success).toBe(true);
    expect(xmlAdapter.downloadOriginalPdf).toHaveBeenCalled();
    expect(r2.uploadBuffer).toHaveBeenCalledWith(
      'invoices/pdf/inv-2.pdf',
      expect.any(Buffer),
      'application/pdf',
    );
    expect(invoice.pdfSource).toBe('provider_original');
  });
});
