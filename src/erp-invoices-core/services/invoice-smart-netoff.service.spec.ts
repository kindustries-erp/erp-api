import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  InvoiceSmartNetoffService,
  extractPartnerKeywords,
} from './invoice-smart-netoff.service';
import { ErpInvoice } from '../entities/erp_invoice.entity';
import { ErpInvoiceVoucherNetOff } from '../entities/erp_invoice_voucher_netoff.entity';

describe('InvoiceSmartNetoffService', () => {
  let service: InvoiceSmartNetoffService;
  let mockInvoiceRepo: any;
  let mockNetOffRepo: any;
  let mockManagerQuery: jest.Mock;

  beforeEach(async () => {
    mockManagerQuery = jest.fn();

    mockInvoiceRepo = {
      find: jest.fn(),
      manager: {
        query: mockManagerQuery,
      },
    };

    mockNetOffRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalNetOff: '0' }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceSmartNetoffService,
        {
          provide: getRepositoryToken(ErpInvoice),
          useValue: mockInvoiceRepo,
        },
        {
          provide: getRepositoryToken(ErpInvoiceVoucherNetOff),
          useValue: mockNetOffRepo,
        },
      ],
    }).compile();

    service = module.get<InvoiceSmartNetoffService>(InvoiceSmartNetoffService);
  });

  describe('extractPartnerKeywords', () => {
    it('should strip generic business terms and return significant words', () => {
      const keywords = extractPartnerKeywords(
        'Công ty TNHH Phụ Tùng Ô Tô Nam Á Chi Nhánh 1',
      );
      expect(keywords).toContain('phụ');
      expect(keywords).toContain('tùng');
      expect(keywords).toContain('nam');
      expect(keywords).not.toContain('công');
      expect(keywords).not.toContain('tnhh');
      expect(keywords).not.toContain('chi');
      expect(keywords).not.toContain('nhánh');
    });
  });

  describe('getSuggestionsForSingleInvoice', () => {
    const sampleInvoice: ErpInvoice = {
      id: 'inv-123',
      invoiceNo: '0004567',
      totalAmount: '1000000',
      direction: 'IN',
      sellerName: 'Công ty TNHH VinFast Nam Á',
      invoiceDate: new Date('2026-08-15'),
      isDeleted: false,
    } as any;

    it('should rank PERFECT when amount, invoiceNo, and partner match', async () => {
      mockManagerQuery.mockResolvedValueOnce([
        {
          id: 'txn-1',
          transDate: '2026-08-16T10:00:00Z',
          description: 'Thanh toan tien hang HD 0004567 cho VinFast Nam A',
          debitAmount: '1000000',
          creditAmount: '0',
          sourceType: 'BANK',
          correspondentName: 'VinFast Nam A',
          remainingAmount: '1000000',
        },
      ]);

      const suggestions =
        await service.getSuggestionsForSingleInvoice(sampleInvoice);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].score.badge).toBe('PERFECT');
      expect(suggestions[0].score.amountMatch).toBe(true);
      expect(suggestions[0].score.invoiceNoMatch).toBe(true);
      expect(suggestions[0].score.correspondentMatch).toBe(true);
    });

    it('should rank POSSIBLE when only exact amount matches without text signals', async () => {
      mockManagerQuery.mockResolvedValueOnce([
        {
          id: 'txn-2',
          transDate: '2026-08-16T10:00:00Z',
          description: 'Chuyen tien thanh toan noi bo',
          debitAmount: '1000000',
          creditAmount: '0',
          sourceType: 'BANK',
          correspondentName: 'Nguyen Van A',
          remainingAmount: '1000000',
        },
      ]);

      const suggestions =
        await service.getSuggestionsForSingleInvoice(sampleInvoice);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].score.badge).toBe('POSSIBLE');
      expect(suggestions[0].score.amountMatch).toBe(true);
      expect(suggestions[0].score.invoiceNoMatch).toBe(false);
      expect(suggestions[0].score.correspondentMatch).toBe(false);
    });

    it('should rank NOTICE when invoiceNo matches but amount is different', async () => {
      mockManagerQuery.mockResolvedValueOnce([
        {
          id: 'txn-3',
          transDate: '2026-08-16T10:00:00Z',
          description: 'Thanh toan dot 1 HD 0004567',
          debitAmount: '500000',
          creditAmount: '0',
          sourceType: 'BANK',
          remainingAmount: '500000',
        },
      ]);

      const suggestions =
        await service.getSuggestionsForSingleInvoice(sampleInvoice);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].score.badge).toBe('NOTICE');
      expect(suggestions[0].score.amountMatch).toBe(false);
      expect(suggestions[0].score.invoiceNoMatch).toBe(true);
    });

    it('should STRICTLY SKIP when amount is not exact match AND no invoiceNo match', async () => {
      mockManagerQuery.mockResolvedValueOnce([
        {
          id: 'txn-4',
          transDate: '2026-08-16T10:00:00Z',
          description: 'Chuyen khoan khong ro noi dung cho VinFast',
          debitAmount: '990000', // Khác 10.000đ, chỉ khớp partner
          creditAmount: '0',
          sourceType: 'BANK',
          correspondentName: 'VinFast',
          remainingAmount: '990000',
        },
      ]);

      const suggestions =
        await service.getSuggestionsForSingleInvoice(sampleInvoice);

      // Tiền không khớp chính xác VÀ không có số HĐ -> SKIP hoàn toàn
      expect(suggestions).toHaveLength(0);
    });
  });
});
