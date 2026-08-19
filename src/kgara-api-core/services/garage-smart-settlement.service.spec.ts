import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  GarageSmartSettlementService,
  cleanLicensePlate,
  extractCustomerKeywords,
} from './garage-smart-settlement.service';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';

describe('GarageSmartSettlementService', () => {
  let service: GarageSmartSettlementService;
  let mockCaseRepo: any;
  let mockSettlementRepo: any;
  let mockManagerQuery: jest.Mock;

  beforeEach(async () => {
    mockManagerQuery = jest.fn();

    mockCaseRepo = {
      findOne: jest.fn(),
      manager: {
        query: mockManagerQuery,
      },
    };

    mockSettlementRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GarageSmartSettlementService,
        {
          provide: getRepositoryToken(KgaraCase),
          useValue: mockCaseRepo,
        },
        {
          provide: getRepositoryToken(KgaraCaseSettlement),
          useValue: mockSettlementRepo,
        },
      ],
    }).compile();

    service = module.get<GarageSmartSettlementService>(
      GarageSmartSettlementService,
    );
  });

  describe('helpers', () => {
    it('cleanLicensePlate should remove punctuation and lowercase', () => {
      expect(cleanLicensePlate('51G-123.45')).toBe('51g12345');
      expect(cleanLicensePlate('30H 987.65')).toBe('30h98765');
    });

    it('extractCustomerKeywords should extract meaningful words', () => {
      const kw = extractCustomerKeywords('Khách hàng Nguyễn Văn An');
      expect(kw).toContain('nguyễn');
      expect(kw).toContain('nguyen');
      expect(kw).toContain('văn');
      expect(kw).toContain('van');
      expect(kw).not.toContain('khách');
      expect(kw).not.toContain('hàng');
    });
  });

  describe('getSuggestionsForCase', () => {
    const sampleCase: KgaraCase = {
      id: 'case-123',
      soChungTu: 'SC-202608-001',
      bienSoXe: '51G-123.45',
      khachHangName: 'Nguyễn Văn An',
      tienCoThue: 2500000,
      tienDaThanhToan: 0,
      tienConPhaiThanhToan: 2500000,
      doanhThu: 2500000,
      chiPhi: 1000000,
    } as any;

    it('should rank PERFECT when amount, license plate, and customer match for RECEIPT', async () => {
      mockCaseRepo.findOne.mockResolvedValueOnce(sampleCase);
      mockManagerQuery.mockResolvedValueOnce([
        {
          id: 'txn-1',
          transDate: '2026-08-16T10:00:00Z',
          description: 'Nguyen Van An chuyen tien sua xe 51G12345',
          debitAmount: '0',
          creditAmount: '2500000',
          sourceType: 'BANK',
          correspondentName: 'Nguyen Van An',
          remainingAmount: '2500000',
        },
      ]);

      const suggestions = await service.getSuggestionsForCase(
        'case-123',
        'RECEIPT',
      );

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].score.badge).toBe('PERFECT');
      expect(suggestions[0].score.amountMatch).toBe(true);
      expect(suggestions[0].score.plateMatch).toBe(true);
      expect(suggestions[0].score.customerMatch).toBe(true);
    });

    it('should rank HIGH when amount and soChungTu match', async () => {
      mockCaseRepo.findOne.mockResolvedValueOnce(sampleCase);
      mockManagerQuery.mockResolvedValueOnce([
        {
          id: 'txn-2',
          transDate: '2026-08-16T10:00:00Z',
          description: 'Thanh toan SC-202608-001',
          debitAmount: '0',
          creditAmount: '2500000',
          sourceType: 'BANK',
          remainingAmount: '2500000',
        },
      ]);

      const suggestions = await service.getSuggestionsForCase(
        'case-123',
        'RECEIPT',
      );

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].score.badge).toBe('HIGH');
      expect(suggestions[0].score.codeMatch).toBe(true);
    });

    it('should rank POSSIBLE when only exact amount matches without text signals', async () => {
      mockCaseRepo.findOne.mockResolvedValueOnce(sampleCase);
      mockManagerQuery.mockResolvedValueOnce([
        {
          id: 'txn-3',
          transDate: '2026-08-16T10:00:00Z',
          description: 'Chuyen tien khong ghi ro noi dung',
          debitAmount: '0',
          creditAmount: '2500000',
          sourceType: 'BANK',
          remainingAmount: '2500000',
        },
      ]);

      const suggestions = await service.getSuggestionsForCase(
        'case-123',
        'RECEIPT',
      );

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].score.badge).toBe('POSSIBLE');
    });

    it('should rank NOTICE when plate matches but amount differs', async () => {
      mockCaseRepo.findOne.mockResolvedValueOnce(sampleCase);
      mockManagerQuery.mockResolvedValueOnce([
        {
          id: 'txn-4',
          transDate: '2026-08-16T10:00:00Z',
          description: 'Coc sua xe 51G-123.45',
          debitAmount: '0',
          creditAmount: '1000000',
          sourceType: 'BANK',
          remainingAmount: '1000000',
        },
      ]);

      const suggestions = await service.getSuggestionsForCase(
        'case-123',
        'RECEIPT',
      );

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].score.badge).toBe('NOTICE');
      expect(suggestions[0].score.amountMatch).toBe(false);
      expect(suggestions[0].score.plateMatch).toBe(true);
    });
  });
});
