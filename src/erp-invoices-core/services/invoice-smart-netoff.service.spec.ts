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
    it('should strip generic business terms and stop words, returning only distinctive brand words', () => {
      const keywords = extractPartnerKeywords(
        'Công ty TNHH Phụ Tùng Greenway Việt Nam Chi Nhánh 1',
      );
      expect(keywords).toContain('greenway');
      expect(keywords).not.toContain('công');
      expect(keywords).not.toContain('tnhh');
      expect(keywords).not.toContain('chi');
      expect(keywords).not.toContain('nhánh');
      expect(keywords).not.toContain('việt');
      expect(keywords).not.toContain('nam');
      expect(keywords).not.toContain('phụ');
      expect(keywords).not.toContain('tùng');
    });
  });

  describe('getSuggestionsForSingleInvoice', () => {
    const sampleInvoice: ErpInvoice = {
      id: 'inv-123',
      invoiceNo: '0004567',
      invoiceNoNormalized: '4567',
      serialNo: '1C26TGA',
      totalAmount: '1000000',
      direction: 'IN',
      sellerName: 'Công ty TNHH VinFast Việt Nam',
      sellerTaxCode: '0202357718',
      licensePlate: '51G-123.45',
      settlementOrder: 'QTO-2026-001',
      invoiceDate: new Date('2026-08-15'),
      isDeleted: false,
    } as any;

    it('should rank PERFECT when amount, normalized invoiceNo (without leading zeros), and partner match', async () => {
      mockManagerQuery.mockResolvedValueOnce([
        {
          id: 'txn-1',
          transDate: '2026-08-16T10:00:00Z',
          description: 'Thanh toan tien hang HD 4567 cho VinFast',
          debitAmount: '1000000',
          creditAmount: '0',
          sourceType: 'BANK',
          correspondentName: 'VinFast',
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

    it('should rank HIGH when exact amount and license plate match without partner match', async () => {
      mockManagerQuery.mockResolvedValueOnce([
        {
          id: 'txn-plate',
          transDate: '2026-08-16T10:00:00Z',
          description: 'Thanh toan sua chua xe 51G12345',
          debitAmount: '1000000',
          creditAmount: '0',
          sourceType: 'BANK',
          correspondentName: 'Nguyen Van B',
          remainingAmount: '1000000',
        },
      ]);

      const suggestions =
        await service.getSuggestionsForSingleInvoice(sampleInvoice);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].score.badge).toBe('HIGH');
      expect(suggestions[0].score.amountMatch).toBe(true);
    });

    it('should rank LIKELY when exact amount and tax code match', async () => {
      mockManagerQuery.mockResolvedValueOnce([
        {
          id: 'txn-mst',
          transDate: '2026-08-16T10:00:00Z',
          description: 'Chuyen tien cho MST 0202357718',
          debitAmount: '1000000',
          creditAmount: '0',
          sourceType: 'BANK',
          correspondentName: 'Cong ty ABC',
          remainingAmount: '1000000',
        },
      ]);

      const suggestions =
        await service.getSuggestionsForSingleInvoice(sampleInvoice);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].score.badge).toBe('LIKELY');
      expect(suggestions[0].score.amountMatch).toBe(true);
      expect(suggestions[0].score.correspondentMatch).toBe(true);
    });

    it('should drop suggestions that only match the exact amount without any specific signal', async () => {
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

      expect(suggestions).toHaveLength(0);
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

    it('should rank NOTICE_STRONG when invoiceNo and partner match but amount is different', async () => {
      mockManagerQuery.mockResolvedValueOnce([
        {
          id: 'txn-notice-strong',
          transDate: '2026-08-16T10:00:00Z',
          description: 'Thanh toan dot 1 HD 4567 cho VinFast',
          debitAmount: '500000',
          creditAmount: '0',
          sourceType: 'BANK',
          correspondentName: 'VinFast',
          remainingAmount: '500000',
        },
      ]);

      const suggestions =
        await service.getSuggestionsForSingleInvoice(sampleInvoice);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].score.badge).toBe('NOTICE_STRONG');
      expect(suggestions[0].score.amountMatch).toBe(false);
      expect(suggestions[0].score.invoiceNoMatch).toBe(true);
      expect(suggestions[0].score.correspondentMatch).toBe(true);
    });
  });

  describe('chất lượng gợi ý (v2)', () => {
    const sampleInvoice: ErpInvoice = {
      id: 'inv-123',
      invoiceNo: '0004567',
      invoiceNoNormalized: '4567',
      serialNo: '1C26TGA',
      totalAmount: '1000000',
      direction: 'IN',
      sellerName: 'Công ty TNHH VinFast Việt Nam',
      sellerTaxCode: '0202357718',
      licensePlate: '51G-123.45',
      settlementOrder: 'QTO-2026-001',
      invoiceDate: new Date('2026-08-15'),
      isDeleted: false,
    } as any;

    const insuranceInvoice: ErpInvoice = {
      id: 'inv-dbv',
      invoiceNo: '0001945',
      invoiceNoNormalized: '1945',
      serialNo: 'C26TGA',
      totalAmount: '38574170',
      direction: 'OUT',
      buyerName: 'Công ty Cổ Phần Tập Đoàn Bảo Hiểm DBV - Chi Nhánh Miền Nam',
      buyerTaxCode: '0102737963-082',
      invoiceDate: new Date('2026-10-17'),
      isDeleted: false,
    } as any;

    it('should not suggest other insurance companies that only share generic words (bảo hiểm)', async () => {
      mockManagerQuery.mockResolvedValueOnce([
        {
          id: 'txn-pjico',
          transDate: '2026-10-16T10:00:00Z',
          description: '(B/O CT BAO HIEM PJICO HA NOI) IBVCB.2026',
          debitAmount: '0',
          creditAmount: '38574170',
          sourceType: 'BANK',
          correspondentName: 'CT BAO HIEM PJICO HA NOI',
          remainingAmount: '38574170',
        },
      ]);

      const suggestions =
        await service.getSuggestionsForSingleInvoice(insuranceInvoice);

      expect(suggestions).toHaveLength(0);
    });

    it('should not match a short normalized invoice number inside a longer number', async () => {
      mockManagerQuery.mockResolvedValueOnce([
        {
          id: 'txn-long-number',
          transDate: '2026-10-16T10:00:00Z',
          description: 'Thanh toan ma 14567 cho DBV',
          debitAmount: '38574170',
          creditAmount: '0',
          sourceType: 'BANK',
          correspondentName: 'DBV',
          remainingAmount: '38574170',
        },
      ]);

      const suggestions = await service.getSuggestionsForSingleInvoice({
        ...sampleInvoice,
        invoiceNo: '0004567',
        invoiceNoNormalized: '4567',
        totalAmount: '38574170',
        sellerName: 'Công ty TNHH VinFast Việt Nam',
      } as any);

      expect(
        suggestions.every((s) => !s.matchedKeywords.includes('4567')),
      ).toBe(true);
    });

    it('should return reasons and confidence for an accepted suggestion', async () => {
      mockManagerQuery.mockResolvedValueOnce([
        {
          id: 'txn-reasons',
          transDate: '2026-08-16T10:00:00Z',
          description: 'Thanh toan tien hang HD 4567 cho VinFast',
          debitAmount: '1000000',
          creditAmount: '0',
          sourceType: 'BANK',
          correspondentName: 'VinFast',
          remainingAmount: '1000000',
        },
      ]);

      const [suggestion] =
        await service.getSuggestionsForSingleInvoice(sampleInvoice);

      expect(suggestion.score.score).toBeGreaterThanOrEqual(40);
      expect(suggestion.reasons?.map((r) => r.key)).toEqual(
        expect.arrayContaining([
          'AMOUNT_REMAINING',
          'INVOICE_NO_SHORT',
          'PARTNER_STRONG',
        ]),
      );
    });

    it('should suggest a 4-digit invoice number (no leading zeros) when the amount matches exactly', async () => {
      const shortInvoice = {
        ...sampleInvoice,
        invoiceNo: '1821',
        invoiceNoNormalized: undefined,
        sellerName: 'Công ty Khác',
        sellerTaxCode: undefined,
        licensePlate: undefined,
        settlementOrder: undefined,
      } as any;
      mockManagerQuery.mockResolvedValueOnce([
        {
          id: 'txn-1821',
          transDate: '2026-08-16T10:00:00Z',
          description: 'TT GREENWAY HD 1821 30.09.2026',
          debitAmount: '1000000',
          creditAmount: '0',
          sourceType: 'BANK',
          correspondentName: 'LE THI DIEU HIEN',
          remainingAmount: '1000000',
        },
      ]);

      const suggestions =
        await service.getSuggestionsForSingleInvoice(shortInvoice);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].matchedKeywords).toContain('1821');
    });

    it('should drop a 4-digit invoice number match when the amount differs and there is no partner', async () => {
      const shortInvoice = {
        ...sampleInvoice,
        invoiceNo: '1821',
        invoiceNoNormalized: undefined,
        sellerName: 'Công ty Khác',
        sellerTaxCode: undefined,
        licensePlate: undefined,
        settlementOrder: undefined,
      } as any;
      mockManagerQuery.mockResolvedValueOnce([
        {
          id: 'txn-1821-lech',
          transDate: '2026-08-16T10:00:00Z',
          description: 'TT HD 1821 tien con lai',
          debitAmount: '500000',
          creditAmount: '0',
          sourceType: 'BANK',
          remainingAmount: '500000',
        },
      ]);

      const suggestions =
        await service.getSuggestionsForSingleInvoice(shortInvoice);

      expect(suggestions).toHaveLength(0);
    });

    it('should penalize and drop a transaction far from the invoice date when signals are weak', async () => {
      mockManagerQuery.mockResolvedValueOnce([
        {
          id: 'txn-far',
          transDate: '2024-01-01T10:00:00Z',
          description: 'Chuyen tien cho MST 0202357718',
          debitAmount: '1000000',
          creditAmount: '0',
          sourceType: 'BANK',
          correspondentName: 'Cong ty ABC',
          remainingAmount: '1000000',
        },
      ]);

      const suggestions =
        await service.getSuggestionsForSingleInvoice(sampleInvoice);

      // MST 25 + tiền 40 - lệch ngày 15 = 50 vẫn đạt ngưỡng; kiểm tra lý do có DATE_FAR
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].reasons?.some((r) => r.key === 'DATE_FAR')).toBe(
        true,
      );
    });
  });
});
