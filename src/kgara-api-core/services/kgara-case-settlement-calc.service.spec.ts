import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KgaraCaseSettlementCalcService } from './kgara-case-settlement-calc.service';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';

describe('KgaraCaseSettlementCalcService', () => {
  let service: KgaraCaseSettlementCalcService;
  let caseRepo: any;
  let settlementRepo: any;

  beforeEach(async () => {
    caseRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    settlementRepo = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KgaraCaseSettlementCalcService,
        {
          provide: getRepositoryToken(KgaraCase),
          useValue: caseRepo,
        },
        {
          provide: getRepositoryToken(KgaraCaseSettlement),
          useValue: settlementRepo,
        },
      ],
    }).compile();

    service = module.get<KgaraCaseSettlementCalcService>(
      KgaraCaseSettlementCalcService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recalculateCaseSettlementSummary', () => {
    it('should calculate receipts and update remaining balance on case', async () => {
      const mockCase = {
        id: 'c-1',
        soChungTu: 'PDV-001',
        tienCoThue: 10000000,
        tienConPhaiThanhToan: 10000000,
        tienDaThanhToan: 0,
      };

      caseRepo.findOne.mockResolvedValue(mockCase);
      settlementRepo.find.mockResolvedValue([
        {
          id: 's-1',
          caseId: 'c-1',
          amount: 4000000,
          settlementType: 'RECEIPT',
        },
        {
          id: 's-2',
          caseId: 'c-1',
          amount: 1000000,
          settlementType: 'PAYMENT',
        }, // ignored for receipts
      ]);

      await service.recalculateCaseSettlementSummary('c-1');

      expect(caseRepo.update).toHaveBeenCalledWith(
        'c-1',
        expect.objectContaining({
          tienDaThanhToan: 4000000,
          tienConPhaiThanhToan: 6000000,
        }),
      );
    });

    it('should gracefully handle non-existent case', async () => {
      caseRepo.findOne.mockResolvedValue(null);
      await service.recalculateCaseSettlementSummary('non-existent');
      expect(caseRepo.update).not.toHaveBeenCalled();
    });
  });
});
