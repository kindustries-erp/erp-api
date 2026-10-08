import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KgaraSuppliersService } from './kgara-suppliers.service';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';

describe('KgaraSuppliersService', () => {
  let service: KgaraSuppliersService;
  let caseRepo: any;
  let grossProfitRepo: any;

  beforeEach(async () => {
    const mockRepo = () => ({
      find: jest.fn(),
      findOne: jest.fn(),
      getMany: jest.fn(),
      createQueryBuilder: jest.fn(),
      manager: {
        query: jest.fn(),
      },
    });

    caseRepo = mockRepo();
    grossProfitRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KgaraSuppliersService,
        { provide: getRepositoryToken(KgaraCase), useValue: caseRepo },
        {
          provide: getRepositoryToken(KgaraGrossProfit),
          useValue: grossProfitRepo,
        },
      ],
    }).compile();

    service = module.get<KgaraSuppliersService>(KgaraSuppliersService);
  });

  describe('getSuppliersDebt', () => {
    it('should query cases and gross profit, format data and calculate aging buckets correctly', async () => {
      const mockSummary = [
        {
          total_cases: '2',
          total_cost: '7000000',
          total_paid: '0',
          total_balance: '7000000',
          total_aging_0_30: '4000000',
          total_aging_31_60: '3000000',
          total_aging_61_90: '0',
          total_aging_over_90: '0',
        },
      ];

      const mockRows = [
        {
          id: 'case-01',
          case_id: 'case-01',
          so_phieu: 'GR-PDV2608-0074',
          bien_so_xe: '61K63313',
          customer_code: 'GR-KHA-000107',
          customer_name: 'CÔNG TY TNHH ĐẦU TƯ PHÁT TRIỂN',
          status_name: 'Kết thúc',
          revenue_amount: '2226960',
          cost_amount: '4000000',
          paid_amount: '0',
          balance_amount: '4000000',
          completed_date: '2026-08-26T10:56:00.000Z',
          aging_days: 15,
          aging_0_30: '4000000',
          aging_31_60: '0',
          aging_61_90: '0',
          aging_over_90: '0',
        },
      ];

      caseRepo.manager.query
        .mockResolvedValueOnce(mockSummary)
        .mockResolvedValueOnce(mockRows);

      const result = await service.getSuppliersDebt({
        branchId: 'BR-01',
        page: 1,
        pageSize: 20,
      });

      expect(result.total).toBe(2);
      expect(result.data.length).toBe(1);
      expect(result.data[0].customerCode).toBe('GR-KHA-000107');
      expect(result.data[0].customerName).toBe(
        'CÔNG TY TNHH ĐẦU TƯ PHÁT TRIỂN',
      );
      expect(result.data[0].costAmount).toBe(4000000);
      expect(result.data[0].balanceAmount).toBe(4000000);
      expect(result.summary.totalCost).toBe(7000000);
      expect(result.summary.totalAging0_30).toBe(4000000);
    });

    it('should handle exact, multi, and blank search filters in column_search', async () => {
      caseRepo.manager.query
        .mockResolvedValueOnce([{ total_cases: '0' }])
        .mockResolvedValueOnce([]);

      await service.getSuppliersDebt({
        column_search: JSON.stringify({
          soPhieu: 'exact:GR-PDV2608-0074',
          bienSoXe: '61K, 70A',
          customerName: '__BLANK__',
        }),
      });

      const calledSql = caseRepo.manager.query.mock.calls[0][0];
      const calledParams = caseRepo.manager.query.mock.calls[0][1];

      expect(calledSql).toContain('= $2');
      expect(calledParams).toContain('GR-PDV2608-0074');
      expect(calledParams).toContain('%61K%');
      expect(calledParams).toContain('%70A%');
      expect(calledSql).toContain('IS NULL');
    });
  });

  describe('getSuppliersDebtColumnOptions', () => {
    it('should query distinct options with pagination and return string array', async () => {
      caseRepo.manager.query
        .mockResolvedValueOnce([{ total: '1' }])
        .mockResolvedValueOnce([{ value: 'GR-PDV2608-0074' }]);

      const result = await service.getSuppliersDebtColumnOptions(
        'BR-01',
        'soPhieu',
        'PDV',
        1,
        20,
      );

      expect(result.total).toBe(1);
      expect(result.items).toEqual(['GR-PDV2608-0074']);
    });
  });
});
