import { BadRequestException, NotFoundException } from '@nestjs/common';
import AdmZip from 'adm-zip';
import { Repository } from 'typeorm';
import { InvoiceOriginalPdfFacade } from './invoice-original-pdf.facade';
import { InvoicePdfDownloadWorkerService } from './invoice-pdf-download-worker.service';
import { InvoiceProviderDetectorService } from './invoice-provider-detector.service';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { ErpEInvoiceSync } from '../../entities/erp_einvoice_sync.entity';
import { R2Service } from '../../../r2/r2.service';

describe('InvoiceOriginalPdfFacade', () => {
  let facade: InvoiceOriginalPdfFacade;
  let mockInvoiceRepo: Partial<Repository<ErpInvoice>>;
  let mockSyncRepo: Partial<Repository<ErpEInvoiceSync>>;
  let mockWorkerService: Partial<InvoicePdfDownloadWorkerService>;
  let mockDetectorService: Partial<InvoiceProviderDetectorService>;
  let mockR2Service: Partial<R2Service>;

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

    mockR2Service = {
      downloadBuffer: jest.fn().mockResolvedValue(Buffer.from('')),
    };

    facade = new InvoiceOriginalPdfFacade(
      mockInvoiceRepo as Repository<ErpInvoice>,
      mockSyncRepo as Repository<ErpEInvoiceSync>,
      mockWorkerService as InvoicePdfDownloadWorkerService,
      mockDetectorService as InvoiceProviderDetectorService,
      mockR2Service as R2Service,
    );
    mockR2Service.uploadBuffer = jest.fn().mockResolvedValue(undefined);
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

  it('should read XML when DB has no lookup code and return MCCQT, hints and hasXml', async () => {
    const fakeInvoice = {
      id: 'inv-2',
      invoiceNo: '2698',
      sellerTaxCode: '0302539983',
      msttcgp: '0101360697',
      providerCode: 'BKAV',
      lookupCode: null,
      lookupUrl: null,
      xmlFileKey: 'invoices/IN/2026/09/2698.zip',
    } as any;
    (mockInvoiceRepo.findOne as jest.Mock).mockResolvedValue(fakeInvoice);
    const zip = new AdmZip();
    zip.addFile(
      'invoice.xml',
      Buffer.from('<HDon><MCCQT>M1-26-2JNWA-00000037338</MCCQT></HDon>'),
    );
    (mockR2Service.downloadBuffer as jest.Mock).mockResolvedValue(
      zip.toBuffer(),
    );
    mockDetectorService.detectFromXml = jest.fn().mockReturnValue({
      providerCode: 'BKAV',
      providerName: 'BKAV eHoadon',
      msttcgp: '0101360697',
      lookupCode: 'M1-26-2JNWA-00000037338',
      lookupUrl: 'https://van.ehoadon.vn/TCHD',
      hints: [{ label: 'Mã CQT (MCCQT)', value: 'M1-26-2JNWA-00000037338' }],
    });

    const info = await facade.getLookupInfo('inv-2');

    expect(info.lookupCode).toBe('M1-26-2JNWA-00000037338');
    expect(info.lookupUrl).toBe('https://van.ehoadon.vn/TCHD');
    expect(info.hasXml).toBe(true);
    expect(info.hints).toEqual([
      { label: 'Mã CQT (MCCQT)', value: 'M1-26-2JNWA-00000037338' },
    ]);
    expect(mockInvoiceRepo.save).not.toHaveBeenCalled();
  });

  it('should still return metadata lookup info when reading XML fails', async () => {
    const fakeInvoice = {
      id: 'inv-3',
      invoiceNo: '1',
      sellerTaxCode: '0108926276',
      lookupCode: null,
      lookupUrl: null,
      xmlFileKey: 'invoices/IN/x.zip',
    } as any;
    (mockInvoiceRepo.findOne as jest.Mock).mockResolvedValue(fakeInvoice);
    (mockR2Service.downloadBuffer as jest.Mock).mockRejectedValue(
      new Error('R2 down'),
    );

    const info = await facade.getLookupInfo('inv-3');

    expect(info.providerCode).toBe('VINFAST');
    expect(info.hasXml).toBe(true);
    expect(info.hints).toEqual([]);
  });

  it('should upload a manual PDF, store it under invoices/pdf/{id}.pdf and mark manual_upload', async () => {
    const fakeInvoice = {
      id: 'inv-9',
      invoiceNo: '2698',
      pdfError: 'x',
    } as any;
    (mockInvoiceRepo.findOne as jest.Mock).mockResolvedValue(fakeInvoice);
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4 '), Buffer.alloc(100)]);

    const res = await facade.uploadManualPdf('inv-9', pdf);

    expect(mockR2Service.uploadBuffer).toHaveBeenCalledWith(
      'invoices/pdf/inv-9.pdf',
      pdf,
      'application/pdf',
    );
    expect(mockInvoiceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        pdfFileKey: 'invoices/pdf/inv-9.pdf',
        pdfSource: 'manual_upload',
        pdfError: null,
      }),
    );
    expect(res).toEqual({
      invoiceId: 'inv-9',
      pdfFileKey: 'invoices/pdf/inv-9.pdf',
      pdfSource: 'manual_upload',
    });
  });

  it('should reject a manual upload that is not a PDF', async () => {
    (mockInvoiceRepo.findOne as jest.Mock).mockResolvedValue({ id: 'inv-9' });
    await expect(
      facade.uploadManualPdf('inv-9', Buffer.from('<html>not pdf</html>')),
    ).rejects.toThrow(BadRequestException);
    expect(mockR2Service.uploadBuffer).not.toHaveBeenCalled();
  });

  it('should reject a manual upload larger than 10MB', async () => {
    (mockInvoiceRepo.findOne as jest.Mock).mockResolvedValue({ id: 'inv-9' });
    const big = Buffer.alloc(10 * 1024 * 1024 + 1);
    Buffer.from('%PDF').copy(big);
    await expect(facade.uploadManualPdf('inv-9', big)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw NotFoundException when uploading for a missing invoice', async () => {
    (mockInvoiceRepo.findOne as jest.Mock).mockResolvedValue(null);
    await expect(
      facade.uploadManualPdf('missing', Buffer.from('%PDF-1.4')),
    ).rejects.toThrow(NotFoundException);
  });
});
