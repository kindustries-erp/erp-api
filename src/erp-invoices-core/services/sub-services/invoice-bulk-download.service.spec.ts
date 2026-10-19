import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import AdmZip from 'adm-zip';

import { InvoiceBulkDownloadService } from './invoice-bulk-download.service';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { R2Service } from '../../../r2/r2.service';

const archiveMocks = {
  on: jest.fn(),
  pipe: jest.fn(),
  append: jest.fn(),
  finalize: jest.fn().mockResolvedValue(undefined),
};

jest.mock('archiver', () => {
  return jest.fn(() => archiveMocks);
});

const baseInvoice = {
  id: 'inv-1',
  invoiceNo: '0001',
  invoiceDate: '2025-03-15',
  serialNo: 'C25TAA',
  totalAmount: '12500000.00',
  direction: 'IN',
  sellerName: 'Cty A',
  sellerTaxCode: '0101',
  buyerName: 'B',
  buyerTaxCode: '0202',
  attachments: [] as any[],
  pdfFileKey: null as string | null,
  pdfFiles: null as any,
  xmlFileKey: null as string | null,
};

const pdfAttachment = (fileKey: string, fileName: string) => ({
  attachment: { fileKey, fileName, mimeType: 'application/pdf' },
});
const zipAttachment = (fileKey: string, fileName: string) => ({
  attachment: { fileKey, fileName, mimeType: 'application/xml' },
});

const res = () => ({
  headersSent: false,
  status: jest.fn().mockReturnThis(),
  send: jest.fn(),
});

describe('InvoiceBulkDownloadService', () => {
  let service: InvoiceBulkDownloadService;
  let repository: any;
  let r2Service: any;

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    r2Service = {
      downloadBuffer: jest.fn(),
      downloadStream: jest.fn(),
    };

    Object.values(archiveMocks).forEach((mockFn: any) => {
      if (mockFn?.mockReset) mockFn.mockReset();
    });
    archiveMocks.finalize.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceBulkDownloadService,
        { provide: getRepositoryToken(ErpInvoice), useValue: repository },
        { provide: R2Service, useValue: r2Service },
      ],
    }).compile();

    service = module.get(InvoiceBulkDownloadService);
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

    it('appends PDF stream and writes _FILE_LOI for missing XML', async () => {
      repository.find.mockResolvedValue([
        {
          ...baseInvoice,
          attachments: [pdfAttachment('k1', 'hoa_don_1.pdf')],
        },
      ]);
      r2Service.downloadStream.mockResolvedValue('stream-data');

      await service.bulkDownloadSelectedZip(
        { ids: ['inv-1'], types: ['pdf', 'xml'] },
        res(),
      );

      expect(r2Service.downloadStream).toHaveBeenCalledWith('k1');
      expect(archiveMocks.append).toHaveBeenCalledWith('stream-data', {
        name: '0101 - Cty A/20250315_C25TAA_0001_12500000.pdf',
      });
      expect(archiveMocks.append).toHaveBeenCalledWith(
        expect.stringContaining('không có file XML'),
        { name: '_FILE_LOI.txt' },
      );
      expect(archiveMocks.finalize).toHaveBeenCalled();
    });

    it('never emits a .zip entry for pdf-only export when only a provider zip is attached', async () => {
      repository.find.mockResolvedValue([
        {
          ...baseInvoice,
          attachments: [zipAttachment('k-zip', 'pkg_C25TAA_0001.zip')],
          pdfFileKey: null,
        },
      ]);

      await service.bulkDownloadSelectedZip(
        { ids: ['inv-1'], types: ['pdf'] },
        res(),
      );

      expect(r2Service.downloadStream).not.toHaveBeenCalled();
      const names = archiveMocks.append.mock.calls.map((c) => c[1]?.name);
      expect(names.some((n) => String(n).endsWith('.zip'))).toBe(false);
      expect(archiveMocks.append).toHaveBeenCalledWith(
        expect.stringContaining('không có file PDF'),
        { name: '_FILE_LOI.txt' },
      );
    });

    it('uses pdfFileKey when a zip attachment sits alongside it (pdf-only export)', async () => {
      repository.find.mockResolvedValue([
        {
          ...baseInvoice,
          attachments: [zipAttachment('k-zip', 'pkg.zip')],
          pdfFileKey: 'k-pdf',
        },
      ]);
      r2Service.downloadStream.mockResolvedValue('pdf-stream');

      await service.bulkDownloadSelectedZip(
        { ids: ['inv-1'], types: ['pdf'] },
        res(),
      );

      expect(r2Service.downloadStream).toHaveBeenCalledWith('k-pdf');
      expect(archiveMocks.append).toHaveBeenCalledWith('pdf-stream', {
        name: '0101 - Cty A/20250315_C25TAA_0001_12500000.pdf',
      });
    });

    it('extracts the .xml from a provider zip for xml export', async () => {
      const pkg = new AdmZip();
      pkg.addFile('pkg/hoa_don.xml', Buffer.from('<HDon/>'));
      pkg.addFile('pkg/view.html', Buffer.from('<html/>'));
      r2Service.downloadBuffer.mockResolvedValue(pkg.toBuffer());

      repository.find.mockResolvedValue([
        { ...baseInvoice, xmlFileKey: 'invoices/IN/2025/03/pkg.zip' },
      ]);

      await service.bulkDownloadSelectedZip(
        { ids: ['inv-1'], types: ['xml'] },
        res(),
      );

      expect(r2Service.downloadBuffer).toHaveBeenCalledWith(
        'invoices/IN/2025/03/pkg.zip',
      );
      expect(archiveMocks.append).toHaveBeenCalledWith(expect.any(Buffer), {
        name: '0101 - Cty A/20250315_C25TAA_0001_12500000.xml',
      });
      const names = archiveMocks.append.mock.calls.map((c) => c[1]?.name);
      expect(names.some((n) => String(n).endsWith('.zip'))).toBe(false);
    });

    it('streams a direct .xml key without unzipping', async () => {
      r2Service.downloadStream.mockResolvedValue('xml-stream');
      repository.find.mockResolvedValue([
        { ...baseInvoice, xmlFileKey: 'invoices/IN/2025/03/a.xml' },
      ]);

      await service.bulkDownloadSelectedZip(
        { ids: ['inv-1'], types: ['xml'] },
        res(),
      );

      expect(r2Service.downloadBuffer).not.toHaveBeenCalled();
      expect(archiveMocks.append).toHaveBeenCalledWith('xml-stream', {
        name: '0101 - Cty A/20250315_C25TAA_0001_12500000.xml',
      });
    });
  });

  describe('downloadAllPdfsZip', () => {
    it('throws NotFound when the invoice only has a provider zip', async () => {
      repository.findOne.mockResolvedValue({
        ...baseInvoice,
        attachments: [zipAttachment('k-zip', 'pkg.zip')],
        pdfFileKey: null,
      });

      await expect(service.downloadAllPdfsZip('inv-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('zip export type', () => {
    it('streams the provider zip for zip type and never emits .xml/.pdf', async () => {
      r2Service.downloadStream.mockResolvedValue('zip-stream');
      repository.find.mockResolvedValue([
        {
          ...baseInvoice,
          xmlFileKey: 'invoices/IN/2025/03/pkg.zip',
          attachments: [],
        },
      ]);

      await service.bulkDownloadSelectedZip(
        { ids: ['inv-1'], types: ['zip'] },
        res(),
      );

      expect(r2Service.downloadStream).toHaveBeenCalledWith(
        'invoices/IN/2025/03/pkg.zip',
      );
      expect(archiveMocks.append).toHaveBeenCalledWith('zip-stream', {
        name: '0101 - Cty A/20250315_C25TAA_0001_12500000.zip',
      });
      expect(r2Service.downloadBuffer).not.toHaveBeenCalled();
    });

    it('writes _FILE_LOI when the invoice has no zip', async () => {
      repository.find.mockResolvedValue([{ ...baseInvoice }]);

      await service.bulkDownloadSelectedZip(
        { ids: ['inv-1'], types: ['zip'] },
        res(),
      );

      expect(archiveMocks.append).toHaveBeenCalledWith(
        expect.stringContaining('không có file ZIP'),
        { name: '_FILE_LOI.txt' },
      );
    });
  });
});
