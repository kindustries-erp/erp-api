import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KgaraCustomerCasesDetailService } from './kgara-customer-cases-detail.service';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';

describe('KgaraCustomerCasesDetailService', () => {
  let service: KgaraCustomerCasesDetailService;
  let caseRepo: any;
  let settlementRepo: any;
  let grossProfitRepo: any;

  beforeEach(async () => {
    caseRepo = {
      createQueryBuilder: jest.fn(),
    };
    settlementRepo = {
      createQueryBuilder: jest.fn(),
    };
    grossProfitRepo = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KgaraCustomerCasesDetailService,
        {
          provide: getRepositoryToken(KgaraCase),
          useValue: caseRepo,
        },
        {
          provide: getRepositoryToken(KgaraCaseSettlement),
          useValue: settlementRepo,
        },
        {
          provide: getRepositoryToken(KgaraGrossProfit),
          useValue: grossProfitRepo,
        },
      ],
    }).compile();

    service = module.get<KgaraCustomerCasesDetailService>(
      KgaraCustomerCasesDetailService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return enriched cases with both receivables and payables information', async () => {
    const mockCaseQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'case-1',
          khachHangCode: 'KH001',
          soChungTu: 'PDV-001',
          bienSoXe: '51H-12345',
          tinhTrangDichVu: 3,
          tenTinhTrangDichVu: 'Kết thúc',
          ngayHoanThanhCongViec: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          tienCoThue: 10000000,
          tienDaThanhToan: 4000000,
          chiPhi: 6000000,
        },
      ]),
    };
    caseRepo.createQueryBuilder.mockReturnValue(mockCaseQb);

    const mockSettlementQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { caseId: 'case-1', settlementType: 'RECEIPT', totalAmount: '4000000' },
        { caseId: 'case-1', settlementType: 'PAYMENT', totalAmount: '2500000' },
      ]),
    };
    settlementRepo.createQueryBuilder.mockReturnValue(mockSettlementQb);

    const mockGpQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValue([{ vuViecCode: 'PDV-001', chiPhi: '7000000' }]),
    };
    grossProfitRepo.createQueryBuilder.mockReturnValue(mockGpQb);

    const result = await service.getCasesByCustomer('BRANCH_01', 'KH001');

    expect(result).toHaveLength(1);
    const item = result[0];

    // Receivables checks
    expect(item.tienCoThue).toBe(10000000);
    expect(item.tienDaThanhToan).toBe(4000000);
    expect(item.tienConPhaiThanhToan).toBe(6000000);

    // Payables checks (preferred from gross_profit gp.chi_phi = 7000000)
    expect(item.chiPhi).toBe(7000000);
    expect(item.tienDaChi).toBe(2500000);
    expect(item.tienConPhaiChi).toBe(4500000); // 7,000,000 - 2,500,000
    expect(item.isCompleted).toBe(true);
    expect(item.agingDays).toBeGreaterThanOrEqual(4);
  });

  it('should filter by licensePlate when provided', async () => {
    const mockCaseQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    caseRepo.createQueryBuilder.mockReturnValue(mockCaseQb);

    await service.getCasesByCustomer('BRANCH_01', 'KH001', '51H-12345');

    expect(mockCaseQb.andWhere).toHaveBeenCalledWith(
      'case.bienSoXe = :licensePlate',
      { licensePlate: '51H-12345' },
    );
  });
});
