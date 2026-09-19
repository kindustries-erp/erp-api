import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceImportService } from './invoice-import.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ErpInvoice } from '../entities/erp_invoice.entity';
import { R2Service } from '../../r2/r2.service';

describe('InvoiceImportService', () => {
  let service: InvoiceImportService;
  let mockRepo: any;
  let mockQb: any;

  beforeEach(async () => {
    mockQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    mockRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceImportService,
        {
          provide: getRepositoryToken(ErpInvoice),
          useValue: mockRepo,
        },
        {
          provide: R2Service,
          useValue: {
            uploadBuffer: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InvoiceImportService>(InvoiceImportService);
  });

  describe('previewPdfMatch', () => {
    it('should match invoice number even when it is not the last numeric token', async () => {
      mockRepo.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'inv-uuid',
            invoiceNo: '1234567',
            serialNo: 'C26MGN',
            totalAmount: '1000000',
          },
        ]);

      const result = await service.previewPdfMatch(
        ['1_C26MGN_1234567_abc.pdf'],
        'IN',
      );

      expect(mockRepo.find).toHaveBeenNthCalledWith(3, {
        where: {
          invoiceNoNormalized: '1234567',
          direction: 'IN',
        },
        order: { createdAt: 'DESC' },
      });

      expect(result).toEqual({
        '1_C26MGN_1234567_abc.pdf': {
          id: 'inv-uuid',
          invoiceNo: '1234567',
          serialNo: 'C26MGN',
          totalAmount: '1000000',
        },
      });
    });

    it('should match one-digit invoice number from filename like 046353465_1', async () => {
      mockRepo.find.mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          id: 'inv-one-digit',
          invoiceNo: '1',
          serialNo: null,
          totalAmount: '50000',
        },
      ]);

      const result = await service.previewPdfMatch(['046353465_1.pdf'], 'IN');

      expect(mockRepo.find).toHaveBeenNthCalledWith(2, {
        where: {
          invoiceNoNormalized: '1',
          direction: 'IN',
        },
        order: { createdAt: 'DESC' },
      });

      expect(result).toEqual({
        '046353465_1.pdf': {
          id: 'inv-one-digit',
          invoiceNo: '1',
          serialNo: null,
          totalAmount: '50000',
        },
      });
    });

    it('should fallback to suffix match for prefixed invoice numbers', async () => {
      mockRepo.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockQb.getMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'inv-suffix',
            invoiceNo: 'AB/1781',
            serialNo: 'C26MGN',
            totalAmount: '6900000',
          },
        ]);

      const result = await service.previewPdfMatch(
        ['20260514_0313465740_1781.pdf'],
        'IN',
      );

      expect(mockRepo.find).toHaveBeenNthCalledWith(3, {
        where: {
          invoiceNoNormalized: '1781',
          direction: 'IN',
        },
        order: { createdAt: 'DESC' },
      });

      expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('inv');
      expect(result).toEqual({
        '20260514_0313465740_1781.pdf': {
          id: 'inv-suffix',
          invoiceNo: 'AB/1781',
          serialNo: 'C26MGN',
          totalAmount: '6900000',
        },
      });
    });

    it('should return null for unmatched PDFs', async () => {
      // Setup
      mockRepo.find.mockResolvedValue([]);

      // Test
      const result = await service.previewPdfMatch(
        ['1_C26MGN_1234567_abc.pdf'],
        'IN',
      );

      // Assert
      expect(result).toEqual({
        '1_C26MGN_1234567_abc.pdf': null,
      });
    });

    it('should ignore filenames with no digits', async () => {
      // Test
      const result = await service.previewPdfMatch(
        ['no_digits_here.pdf'],
        'IN',
      );

      // Assert
      expect(mockRepo.find).not.toHaveBeenCalled();
      expect(mockRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(result).toEqual({
        'no_digits_here.pdf': null,
      });
    });
  });

  describe('bulkImportMixed & Pipeline Enrichment', () => {
    it('should parse XML, create invoice, and save child ErpInvoiceItem records', async () => {
      const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
<HDon>
  <DLHDon>
    <TTChung>
      <KHMSHDon>1</KHMSHDon>
      <KHHDon>C26TGA</KHHDon>
      <SHDon>12345</SHDon>
      <NLap>2026-03-15</NLap>
    </TTChung>
    <NDHDon>
      <NBan>
        <Ten>CONG TY TNHH ABC</Ten>
        <MST>0101234567</MST>
        <DChi>Ha Noi</DChi>
      </NBan>
      <NMua>
        <Ten>CONG TY XYZ</Ten>
        <MST>0318334886</MST>
        <DChi>TP HCM</DChi>
      </NMua>
      <DSHHDVu>
        <HHDVu>
          <THHDVu>Linh kien phu tung</THHDVu>
          <DVTinh>Cai</DVTinh>
          <SLuong>2</SLuong>
          <DGia>500000</DGia>
          <Tien>1000000</Tien>
          <TSuat>10%</TSuat>
          <TThue>100000</TThue>
          <TTTien>1100000</TTTien>
        </HHDVu>
      </DSHHDVu>
      <TToan>
        <TgTCThue>1000000</TgTCThue>
        <TgTThue>100000</TgTThue>
        <TgTTTBSo>1100000</TgTTTBSo>
      </TToan>
    </NDHDon>
  </DLHDon>
</HDon>`;

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create = jest.fn((dto) => ({ id: 'inv-123', ...dto }));
      mockRepo.save = jest.fn((inv) =>
        Promise.resolve({ id: 'inv-123', ...inv }),
      );
      mockRepo.manager = {
        create: jest.fn((entityClass, data) => data),
        save: jest.fn((entityClass, data) => Promise.resolve(data)),
      };

      const result = await service.bulkImportMixed(
        [
          {
            filename: 'HD_12345.xml',
            buffer: Buffer.from(sampleXml, 'utf-8'),
            mimetype: 'application/xml',
          },
        ],
        'IN',
      );

      expect(result.created).toBe(1);
      expect(result.skipped.length).toBe(0);
      expect(result.errors.length).toBe(0);
      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.manager.create).toHaveBeenCalled();
      expect(mockRepo.manager.save).toHaveBeenCalled();
    });

    it('should recursively extract XML from nested ZIP files', async () => {
      const AdmZip = require('adm-zip');
      const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
<HDon>
  <DLHDon>
    <TTChung>
      <KHMSHDon>1</KHMSHDon>
      <KHHDon>C26TGA</KHHDon>
      <SHDon>99999</SHDon>
      <NLap>2026-03-15</NLap>
    </TTChung>
    <NDHDon>
      <NBan>
        <Ten>VINFAST TRADING</Ten>
        <MST>0108926276</MST>
      </NBan>
      <NMua>
        <Ten>KHACH HANG</Ten>
        <MST>0318334886</MST>
      </NMua>
      <DSHHDVu>
        <HHDVu>
          <THHDVu>VF5_HV_BATTERY_PACK_38_KWH</THHDVu>
          <SLuong>1</SLuong>
          <Tien>100000000</Tien>
        </HHDVu>
      </DSHHDVu>
      <TToan>
        <TgTCThue>100000000</TgTCThue>
        <TgTTTBSo>110000000</TgTTTBSo>
      </TToan>
    </NDHDon>
  </DLHDon>
</HDon>`;

      const innerZip = new AdmZip();
      innerZip.addFile('nested_invoice.xml', Buffer.from(sampleXml, 'utf-8'));
      const innerBuffer = innerZip.toBuffer();

      const outerZip = new AdmZip();
      outerZip.addFile('folder/inner.zip', innerBuffer);
      const outerBuffer = outerZip.toBuffer();

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create = jest.fn((dto) => ({ id: 'inv-nested', ...dto }));
      mockRepo.save = jest.fn((inv) =>
        Promise.resolve({ id: 'inv-nested', ...inv }),
      );
      mockRepo.manager = {
        create: jest.fn((entityClass, data) => data),
        save: jest.fn((entityClass, data) => Promise.resolve(data)),
      };

      const result = await service.bulkImportMixed(
        [
          {
            filename: 'batch_upload.zip',
            buffer: outerBuffer,
            mimetype: 'application/zip',
          },
        ],
        'IN',
      );

      expect(result.created).toBe(1);
      expect(result.skipped.length).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    it('should backfill missing XML, PDF, items, and branch when re-uploading an existing invoice', async () => {
      const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
<HDon>
  <DLHDon>
    <TTChung>
      <KHMSHDon>1</KHMSHDon>
      <KHHDon>C26TGA</KHHDon>
      <SHDon>88888</SHDon>
      <NLap>2026-03-15</NLap>
    </TTChung>
    <NDHDon>
      <NBan>
        <Ten>CONG TY TNHH ABC</Ten>
        <MST>0101234567</MST>
      </NBan>
      <NMua>
        <Ten>CONG TY XYZ</Ten>
        <MST>0318334886</MST>
      </NMua>
      <DSHHDVu>
        <HHDVu>
          <THHDVu>Dich vu sua chua</THHDVu>
          <SLuong>1</SLuong>
          <Tien>2000000</Tien>
        </HHDVu>
      </DSHHDVu>
      <TToan>
        <TgTCThue>2000000</TgTCThue>
        <TgTTTBSo>2200000</TgTTTBSo>
      </TToan>
    </NDHDon>
  </DLHDon>
</HDon>`;

      const existingInv = {
        id: 'inv-existing-id',
        invoiceNo: '88888',
        invoiceNoNormalized: '88888',
        sellerTaxCode: '0101234567',
        direction: 'IN',
        xmlFileKey: null,
        pdfFileKey: null,
        pdfFiles: [],
        branchId: null,
      };

      mockRepo.findOne.mockResolvedValue(existingInv);
      mockRepo.update = jest.fn().mockResolvedValue({ affected: 1 });
      mockRepo.manager = {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn((entityClass, data) => data),
        save: jest.fn((entityClass, data) => Promise.resolve(data)),
      };

      const result = await service.bulkImportMixed(
        [
          {
            filename: 'HD_88888.xml',
            buffer: Buffer.from(sampleXml, 'utf-8'),
            mimetype: 'application/xml',
          },
          {
            filename: 'HD_88888.pdf',
            buffer: Buffer.from('%PDF-1.4 mock pdf', 'utf-8'),
            mimetype: 'application/pdf',
          },
        ],
        'IN',
      );

      expect(result.created).toBe(0);
      expect(result.skipped.length).toBe(1);
      expect(result.skipped[0].reason).toBe('DUPLICATE');
      expect(mockRepo.update).toHaveBeenCalledWith(
        'inv-existing-id',
        expect.objectContaining({
          xmlFileKey: expect.stringContaining('.xml'),
          pdfFileKey: expect.stringContaining('.pdf'),
        }),
      );
      expect(mockRepo.manager.save).toHaveBeenCalled();
    });
  });
});
