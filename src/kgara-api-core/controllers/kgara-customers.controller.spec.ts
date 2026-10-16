import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KgaraCustomersController } from './kgara-customers.controller';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { KgaraCustomerCasesDetailService } from '../services/kgara-customer-cases-detail.service';

describe('KgaraCustomersController (Debt & Completion Date Aging)', () => {
  let controller: KgaraCustomersController;
  let caseRepo: any;
  let settlementRepo: any;
  let customerCasesDetailService: any;

  beforeEach(async () => {
    const mockRepo = () => ({
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      manager: {
        query: jest.fn(),
      },
    });

    caseRepo = mockRepo();
    settlementRepo = mockRepo();
    customerCasesDetailService = {
      getCasesByCustomer: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KgaraCustomersController],
      providers: [
        { provide: getRepositoryToken(KgaraCase), useValue: caseRepo },
        {
          provide: getRepositoryToken(KgaraCaseSettlement),
          useValue: settlementRepo,
        },
        {
          provide: KgaraCustomerCasesDetailService,
          useValue: customerCasesDetailService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CoreRbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<KgaraCustomersController>(KgaraCustomersController);
  });

  describe('getCustomersDebt', () => {
    it('should query only completed cases with ngay_hoan_thanh_cong_viec and calculate aging by completion date', async () => {
      const mockSummary = [
        {
          total_customers: '1',
          total_revenue: '10000000',
          total_paid: '5000000',
          total_balance: '5000000',
          total_aging_0_30: '5000000',
          total_aging_31_60: '0',
          total_aging_61_90: '0',
          total_aging_over_90: '0',
        },
      ];

      const mockData = [
        {
          bien_so_xe: '51A-123.45',
          khach_hang_code: 'KH001',
          khach_hang_name: 'Nguyen Van A',
          branch_external_id: 'BRANCH_01',
          so_phieu: '2',
          tong_doanh_thu: '10000000',
          da_thanh_toan: '5000000',
          con_phai_thu: '5000000',
          ngay_gan_nhat: '2026-09-20T10:00:00Z',
          ngay_xa_nhat: '2026-09-15T10:00:00Z',
          max_aging_days: 5,
          aging_0_30: '5000000',
          aging_31_60: '0',
          aging_61_90: '0',
          aging_over_90: '0',
        },
      ];

      caseRepo.manager.query
        .mockResolvedValueOnce(mockSummary)
        .mockResolvedValueOnce(mockData);

      const result = await controller.getCustomersDebt(
        'BRANCH_01',
        '1',
        '20',
        '',
        '2026-07-01',
        '2026-09-25',
      );

      expect(caseRepo.manager.query).toHaveBeenCalledTimes(2);

      // Verify SQL contains GROUP BY bien_so_xe
      const summaryQuery = caseRepo.manager.query.mock.calls[0][0];
      expect(summaryQuery).toContain(
        'COALESCE(NULLIF(TRIM("case"."bien_so_xe"), \'\'), \'CHUA_CO_BKS\')',
      );
      expect(summaryQuery).toContain(
        '"case"."ngay_hoan_thanh_cong_viec" IS NOT NULL',
      );
      expect(summaryQuery).toContain(
        'CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec")',
      );

      const dataQuery = caseRepo.manager.query.mock.calls[1][0];
      expect(dataQuery).toContain(
        'COALESCE(NULLIF(TRIM("case"."bien_so_xe"), \'\'), \'CHUA_CO_BKS\')',
      );
      expect(dataQuery).toContain(
        '"case"."ngay_hoan_thanh_cong_viec" IS NOT NULL',
      );
      expect(dataQuery).toContain(
        'CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec")',
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].licensePlate).toBe('51A-123.45');
      expect(result.data[0].customerCode).toBe('KH001');
      expect(result.data[0].maxAgingDays).toBe(5);
      expect(result.data[0].aging0_30).toBe(5000000);
      expect(result.summary.totalAging0_30).toBe(5000000);
    });

    it('should handle __BLANK__ and __ALL_MATCHING__ filters for licensePlate', async () => {
      caseRepo.manager.query
        .mockResolvedValueOnce([
          {
            total_customers: '0',
            total_revenue: '0',
            total_paid: '0',
            total_balance: '0',
            total_aging_0_30: '0',
            total_aging_31_60: '0',
            total_aging_61_90: '0',
            total_aging_over_90: '0',
          },
        ])
        .mockResolvedValueOnce([]);

      await controller.getCustomersDebt(
        'BRANCH_01',
        '1',
        '20',
        '',
        '',
        '',
        'all',
        JSON.stringify({ licensePlate: ['__BLANK__'] }),
      );

      const blankQuery = caseRepo.manager.query.mock.calls[0][0];
      expect(blankQuery).toContain('"case"."bien_so_xe" IS NULL');

      caseRepo.manager.query
        .mockResolvedValueOnce([
          {
            total_customers: '0',
            total_revenue: '0',
            total_paid: '0',
            total_balance: '0',
            total_aging_0_30: '0',
            total_aging_31_60: '0',
            total_aging_61_90: '0',
            total_aging_over_90: '0',
          },
        ])
        .mockResolvedValueOnce([]);

      await controller.getCustomersDebt(
        'BRANCH_01',
        '1',
        '20',
        '',
        '',
        '',
        'all',
        JSON.stringify({ licensePlate: ['__ALL_MATCHING__', '51A'] }),
      );

      const allMatchingQuery = caseRepo.manager.query.mock.calls[2][0];
      expect(allMatchingQuery).toContain('"case"."bien_so_xe" ILIKE');
    });

    it('should return column options for licensePlate and customer', async () => {
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ cnt: '2' }),
        getRawMany: jest
          .fn()
          .mockResolvedValue([
            { value: '51A-123.45' },
            { value: '51B-678.90' },
          ]),
      };
      caseRepo.createQueryBuilder.mockReturnValue(mockQb);

      const res = await controller.getCustomersDebtColumnOptions(
        'BRANCH_01',
        'licensePlate',
        '',
        '1',
        '20',
        '',
      );

      expect(res.items).toEqual(['51A-123.45', '51B-678.90']);
      expect(mockQb.select).toHaveBeenCalledWith(
        'DISTINCT "case"."bien_so_xe"',
        'value',
      );
    });

    it('should return predefined currency range options for balanceAmount without querying customerCode', async () => {
      const res = await controller.getCustomersDebtColumnOptions(
        'BRANCH_01',
        'balanceAmount',
        '',
        '1',
        '20',
        '',
      );

      expect(res.items).toEqual([
        { label: '0 đ (Đã thanh toán hết)', value: '0' },
        { label: '< 10.000.000 đ', value: '0-10m' },
        { label: '10.000.000 - 20.000.000 đ', value: '10m-20m' },
        { label: '20.000.000 - 50.000.000 đ', value: '20m-50m' },
        { label: '> 50.000.000 đ', value: '>50m' },
      ]);
      expect(caseRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should filter by balanceAmount in column_filters with HAVING condition', async () => {
      caseRepo.manager.query
        .mockResolvedValueOnce([{ total_customers: '1' }])
        .mockResolvedValueOnce([]);

      await controller.getCustomersDebt(
        'BRANCH_01',
        '1',
        '20',
        '',
        undefined,
        undefined,
        undefined,
        JSON.stringify({ balanceAmount: ['0-10m', '>50m'] }),
        undefined,
      );

      const summaryQuery = caseRepo.manager.query.mock.calls[0][0];
      expect(summaryQuery).toContain('HAVING');
      expect(summaryQuery).toContain('tien_con_phai_thanh_toan');
    });

    it('should sort by all aging buckets with the requested directions', async () => {
      caseRepo.manager.query
        .mockResolvedValueOnce([{ total_customers: '0' }])
        .mockResolvedValueOnce([]);

      await controller.getCustomersDebt(
        'BRANCH_01',
        '1',
        '20',
        '',
        undefined,
        undefined,
        ['aging0_30', '-aging31_60', 'aging61_90', '-agingOver90'],
      );

      const dataQuery = caseRepo.manager.query.mock.calls[1][0];
      expect(dataQuery).toContain(
        'ORDER BY aging_0_30 ASC, aging_31_60 DESC, aging_61_90 ASC, aging_over_90 DESC',
      );
    });
  });

  describe('getCasesByCustomer', () => {
    it('should delegate getCasesByCustomer to customerCasesDetailService', async () => {
      const mockResult = [{ id: 'case-1', isCompleted: true }] as any;
      customerCasesDetailService.getCasesByCustomer.mockResolvedValue(
        mockResult,
      );

      const cases = await controller.getCasesByCustomer('BRANCH_01', 'KH001');

      expect(
        customerCasesDetailService.getCasesByCustomer,
      ).toHaveBeenCalledWith('BRANCH_01', 'KH001');
      expect(cases).toBe(mockResult);
    });
  });
});
