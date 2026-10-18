import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InvoiceOriginalPdfFacade } from './invoice-original-pdf.facade';
import { InvoicePdfDownloadWorkerService } from './invoice-pdf-download-worker.service';
import { InvoiceProviderDetectorService } from './invoice-provider-detector.service';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { ErpEInvoiceSync } from '../../entities/erp_einvoice_sync.entity';

describe('InvoiceOriginalPdfFacade', () => {
  let facade: InvoiceOriginalPdfFacade;
  let mockInvoiceRepo: Partial<Repository<ErpInvoice>>;
  let mockSyncRepo: Partial<Repository<ErpEInvoiceSync>>;
  let mockWorkerService: Partial<InvoicePdfDownloadWorkerService>;
  let mockDetectorService: Partial<InvoiceProviderDetectorService>;

  beforeEach(() => {
    mockInvoiceRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([{ id: 'inv-1' }, { id: 'inv-2' }]),
      }),
    };

    mockSyncRepo = {
      create: jest
        .fn()
        .mockImplementation((dto) => ({ id: 'sync-123', ...dto })),
      save: jest
        .fn()
        .mockImplementation((entity) =>
          Promise.resolve({ id: 'sync-123', ...entity }),
        ),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    mockWorkerService = {
      downloadSingleInvoice: jest.fn().mockResolvedValue({ success: true }),
      processBatch: jest.fn().mockResolvedValue(undefined),
    };

    mockDetectorService = {
      detectFromMetadata: jest.fn().mockReturnValue({
        providerCode: 'VINFAST',
        providerName: 'VinFast E-Invoice',
        lookupUrl: 'https://e-invoice-tt78.vingroup.net',
      }),
    };

    facade = new InvoiceOriginalPdfFacade(
      mockInvoiceRepo as Repository<ErpInvoice>,
      mockSyncRepo as Repository<ErpEInvoiceSync>,
      mockWorkerService as InvoicePdfDownloadWorkerService,
      mockDetectorService as InvoiceProviderDetectorService,
    );
  });

  it('should download single invoice successfully', async () => {
    const fakeInvoice = {
      id: 'inv-1',
      invoiceNo: '0001234',
      pdfSource: 'provider_original',
      pdfFileKey: 'invoices/pdf/inv-1.pdf',
      pdfError: null,
    } as any;
    (mockInvoiceRepo.findOne as jest.Mock).mockResolvedValue(fakeInvoice);

    const res = await facade.downloadForInvoice('inv-1');
    expect(res.success).toBe(true);
    expect(res.pdfFileKey).toBe('invoices/pdf/inv-1.pdf');
    expect(mockWorkerService.downloadSingleInvoice).toHaveBeenCalledWith(
      fakeInvoice,
    );
  });

  it('should throw NotFoundException when invoice does not exist', async () => {
    (mockInvoiceRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(facade.downloadForInvoice('non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should start advanced sync session and query candidate invoices', async () => {
    const res = await facade.startAdvancedSync({
      companyTaxCode: '0318042459',
      syncType: 'purchase',
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
    });

    expect(res.syncId).toBe('sync-123');
    expect(res.totalFound).toBe(2);
    expect(res.status).toBe('in_progress');
    expect(mockSyncRepo.create).toHaveBeenCalled();
  });

  it('should return lookup info for an invoice', async () => {
    const fakeInvoice = {
      id: 'inv-1',
      invoiceNo: '0001234',
      sellerTaxCode: '0108926276',
      lookupCode: 'ptZNNF',
      lookupUrl: null,
    } as any;
    (mockInvoiceRepo.findOne as jest.Mock).mockResolvedValue(fakeInvoice);

    const info = await facade.getLookupInfo('inv-1');
    expect(info.providerCode).toBe('VINFAST');
    expect(info.lookupCode).toBe('ptZNNF');
    expect(mockDetectorService.detectFromMetadata).toHaveBeenCalled();
  });
});
