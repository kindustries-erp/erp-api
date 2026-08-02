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
});
