import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceFilesService } from './invoice-files.service';
import { ErpInvoiceAttachment } from '../entities/erp_invoice_attachment.entity';
import { ErpAttachmentsCoreService } from '../../erp-attachments-core/erp-attachments-core.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ErpInvoice } from '../entities/erp_invoice.entity';
import { R2Service } from '../../r2/r2.service';
import { NotFoundException } from '@nestjs/common';
import { InvoiceBulkDownloadService } from './sub-services/invoice-bulk-download.service';

describe('InvoiceFilesService', () => {
  let service: InvoiceFilesService;
  let repository: any;
  let r2Service: any;
  let bulkDownload: any;

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    r2Service = {
      deleteObject: jest.fn(),
      downloadBuffer: jest.fn(),
      downloadStream: jest.fn(),
      uploadBuffer: jest.fn(),
    };

    bulkDownload = {
      downloadAllPdfsZip: jest.fn().mockResolvedValue(Buffer.from('zip')),
      bulkDownloadFilesZip: jest.fn().mockResolvedValue(undefined),
      bulkDownloadSelectedZip: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceFilesService,
        {
          provide: getRepositoryToken(ErpInvoice),
          useValue: repository,
        },
        {
          provide: getRepositoryToken(ErpInvoiceAttachment),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: R2Service,
          useValue: r2Service,
        },
        {
          provide: ErpAttachmentsCoreService,
          useValue: {
            uploadFile: jest.fn(),
          },
        },
        {
          provide: InvoiceBulkDownloadService,
          useValue: bulkDownload,
        },
      ],
    }).compile();

    service = module.get<InvoiceFilesService>(InvoiceFilesService);
  });

  describe('deletePdf', () => {
    it('should throw NotFoundException if invoice not found', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.deletePdf('inv-1', 'key1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete secondary PDF (in pdfFiles array but not pdfFileKey)', async () => {
      const mockInvoice = {
        id: 'inv-1',
        pdfFileKey: 'main-key.pdf',
        pdfFiles: [{ key: 'sub-key.pdf' }, { key: 'other-key.pdf' }],
      };
      repository.findOne.mockResolvedValue(mockInvoice);
      r2Service.deleteObject.mockResolvedValue(true);
      repository.save.mockResolvedValue(mockInvoice);

      const result = await service.deletePdf('inv-1', 'sub-key.pdf');

      expect(result.success).toBe(true);

      expect(mockInvoice.pdfFileKey).toBe('main-key.pdf'); // should not be changed
      expect(r2Service.deleteObject).toHaveBeenCalledWith('sub-key.pdf');
      expect(repository.save).toHaveBeenCalledWith(mockInvoice);
    });

    it('should set pdfFileKey to null when deleting the primary PDF', async () => {
      const mockInvoice = {
        id: 'inv-2',
        pdfFileKey: 'main-key.pdf',
        pdfFiles: [],
      };
      repository.findOne.mockResolvedValue(mockInvoice);
      r2Service.deleteObject.mockResolvedValue(true);
      repository.save.mockResolvedValue(mockInvoice);

      const result = await service.deletePdf('inv-2', 'main-key.pdf');

      expect(result.success).toBe(true);

      expect(mockInvoice.pdfFileKey).toBeNull(); // should be nullified
      expect(r2Service.deleteObject).toHaveBeenCalledWith('main-key.pdf');
      expect(repository.save).toHaveBeenCalledWith(mockInvoice);
    });

    it('should swallow S3 deletion errors and continue to update DB', async () => {
      const mockInvoice = {
        id: 'inv-3',
        pdfFileKey: 'main-key.pdf',
        pdfFiles: [{ key: 'error-key.pdf' }],
      };
      repository.findOne.mockResolvedValue(mockInvoice);

      // Simulate an error from R2
      r2Service.deleteObject.mockRejectedValue(
        new Error('S3 connection error'),
      );
      repository.save.mockResolvedValue(mockInvoice);

      const result = await service.deletePdf('inv-3', 'error-key.pdf');

      expect(result.success).toBe(true);
      // DB should still be updated
      expect(repository.save).toHaveBeenCalledWith(mockInvoice);
    });
  });

  describe('bulk ZIP delegation (Facade)', () => {
    it('delegates bulkDownloadSelectedZip to the sub-service with the same args', async () => {
      const payload = { ids: ['a'], types: ['pdf'] };
      const res = {};

      await service.bulkDownloadSelectedZip(payload, res);

      expect(bulkDownload.bulkDownloadSelectedZip).toHaveBeenCalledWith(
        payload,
        res,
      );
    });

    it('delegates bulkDownloadFilesZip to the sub-service', async () => {
      const payload = { query: { direction: 'IN' }, types: ['xml'] };
      const res = {};

      await service.bulkDownloadFilesZip(payload, res);

      expect(bulkDownload.bulkDownloadFilesZip).toHaveBeenCalledWith(
        payload,
        res,
      );
    });

    it('delegates downloadAllPdfsZip to the sub-service', async () => {
      const buf = await service.downloadAllPdfsZip('inv-9');

      expect(bulkDownload.downloadAllPdfsZip).toHaveBeenCalledWith('inv-9');
      expect(buf).toEqual(Buffer.from('zip'));
    });
  });
});
