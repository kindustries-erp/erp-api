import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceFilesService } from './invoice-files.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ErpInvoice } from '../entities/erp_invoice.entity';
import { R2Service } from '../../r2/r2.service';
import { BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const archiveMocks = {
  on: jest.fn(),
  pipe: jest.fn(),
  append: jest.fn(),
  finalize: jest.fn().mockResolvedValue(undefined),
};

jest.mock('archiver', () => {
  return jest.fn(() => archiveMocks);
});

describe('InvoiceFilesService', () => {
  let service: InvoiceFilesService;
  let repository: any;
  let r2Service: any;

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

    Object.values(archiveMocks).forEach((mockFn: any) => {
      if (mockFn?.mockReset) mockFn.mockReset();
    });
    archiveMocks.finalize.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceFilesService,
        {
          provide: getRepositoryToken(ErpInvoice),
          useValue: repository,
        },
        {
          provide: R2Service,
          useValue: r2Service,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        Logger,
      ],
    }).compile();

    service = module.get<InvoiceFilesService>(InvoiceFilesService);
    (service as any).createZipArchive = jest.fn(() => archiveMocks);
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
      expect(result.pdfFiles).toHaveLength(1);
      expect(result.pdfFiles[0].key).toBe('other-key.pdf');

      expect(mockInvoice.pdfFileKey).toBe('main-key.pdf'); // should not be changed
      expect(mockInvoice.pdfFiles).toHaveLength(1);
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
      expect(result.pdfFiles).toHaveLength(0);

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
      expect(mockInvoice.pdfFiles).toHaveLength(0);
      expect(repository.save).toHaveBeenCalledWith(mockInvoice);
    });
  });

  describe('bulkDownloadSelectedZip', () => {
    it('should throw when ids are empty', async () => {
      await expect(
        service.bulkDownloadSelectedZip({ ids: [], types: ['pdf'] }, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when ids exceed limit', async () => {
      const ids = Array.from({ length: 501 }, (_, i) => `id-${i}`);
      await expect(
        service.bulkDownloadSelectedZip({ ids, types: ['pdf'] }, {}),
      ).rejects.toThrow('Tối đa 500 hóa đơn mỗi lần tải');
    });

    it('should append files and include _FILE_LOI report for missing files', async () => {
      repository.find.mockResolvedValue([
        {
          id: 'inv-1',
          invoiceNo: '0001',
          direction: 'IN',
          sellerName: 'Cty A',
          sellerTaxCode: '0101',
          buyerName: 'B',
          buyerTaxCode: '0202',
          pdfFiles: [{ key: 'k1', filename: 'hoa_don_1.pdf' }],
          pdfFileKey: null,
          xmlFileKey: null,
        },
      ]);
      r2Service.downloadStream.mockResolvedValue('stream-data');

      const res = {
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await service.bulkDownloadSelectedZip(
        { ids: ['inv-1'], types: ['pdf', 'xml'] },
        res,
      );

      expect(repository.find).toHaveBeenCalled();
      expect(r2Service.downloadStream).toHaveBeenCalledWith('k1');
      expect(archiveMocks.append).toHaveBeenCalledWith('stream-data', {
        name: expect.stringContaining('0001.pdf'),
      });
      expect(archiveMocks.append).toHaveBeenCalledWith(
        expect.stringContaining('không có file XML'),
        {
          name: '_FILE_LOI.txt',
        },
      );
      expect(archiveMocks.finalize).toHaveBeenCalled();
    });
  });
});
