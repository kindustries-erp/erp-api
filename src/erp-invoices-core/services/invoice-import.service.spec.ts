import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceImportService } from './invoice-import.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ErpInvoice } from '../entities/erp_invoice.entity';
import { R2Service } from '../../r2/r2.service';

describe('InvoiceImportService', () => {
  let service: InvoiceImportService;
  let mockRepo: any;

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
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
    it('should match a PDF filename with invoiceNo using regex digits', async () => {
      // Setup: first call (26) returns [], second call (1234567) returns [invoice]
      mockRepo.find.mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          id: 'inv-uuid',
          invoiceNo: '1234567',
          serialNo: 'C26MGN',
          totalAmount: '1000000',
        },
      ]);

      // Test
      const result = await service.previewPdfMatch(
        ['1_C26MGN_1234567_abc.pdf'],
        'IN',
      );

      // Assert
      expect(mockRepo.find).toHaveBeenCalledWith({
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
      expect(result).toEqual({
        'no_digits_here.pdf': null,
      });
    });
  });
});
