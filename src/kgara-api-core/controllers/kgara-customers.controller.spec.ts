import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KgaraCustomersController } from './kgara-customers.controller';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';

describe('KgaraCustomersController (Debt & Completion Date Aging)', () => {
  let controller: KgaraCustomersController;
  let caseRepo: any;
  let settlementRepo: any;

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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KgaraCustomersController],
      providers: [
        { provide: getRepositoryToken(KgaraCase), useValue: caseRepo },
        {
          provide: getRepositoryToken(KgaraCaseSettlement),
          useValue: settlementRepo,
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

      // Verify SQL contains ngay_hoan_thanh_cong_viec for aging
      const summaryQuery = caseRepo.manager.query.mock.calls[0][0];
      expect(summaryQuery).toContain(
        '"case"."ngay_hoan_thanh_cong_viec" IS NOT NULL',
      );
      expect(summaryQuery).toContain(
        'CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec")',
      );

      const dataQuery = caseRepo.manager.query.mock.calls[1][0];
      expect(dataQuery).toContain(
        '"case"."ngay_hoan_thanh_cong_viec" IS NOT NULL',
      );
      expect(dataQuery).toContain(
        'CURRENT_DATE - DATE("case"."ngay_hoan_thanh_cong_viec")',
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].customerCode).toBe('KH001');
      expect(result.data[0].maxAgingDays).toBe(5);
      expect(result.data[0].aging0_30).toBe(5000000);
      expect(result.summary.totalAging0_30).toBe(5000000);
    });
  });

  describe('getCasesByCustomer', () => {
    it('should calculate agingDays only for completed cases and set agingDays=0 for in-progress vehicles', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'case-1',
            khachHangCode: 'KH001',
            soChungTu: 'PDV-001',
            tinhTrangDichVu: 3,
            tenTinhTrangDichVu: 'Kết thúc',
            ngayHoanThanhCongViec: new Date(
              Date.now() - 10 * 24 * 60 * 60 * 1000,
            ), // 10 days ago
            ngayPhatSinh: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
            tienCoThue: 5000000,
            tienDaThanhToan: 0,
            tienConPhaiThanhToan: 5000000,
          },
          {
            id: 'case-2',
            khachHangCode: 'KH001',
            soChungTu: 'PDV-002',
            tinhTrangDichVu: 1, // In progress
            tenTinhTrangDichVu: 'Đang sửa chữa',
            ngayHoanThanhCongViec: null, // NOT finished
            ngayPhatSinh: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            tienCoThue: 3000000,
            tienDaThanhToan: 0,
            tienConPhaiThanhToan: 3000000,
          },
        ]),
      };

      caseRepo.createQueryBuilder.mockReturnValue(mockQb);

      const mockSettlementQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      settlementRepo.createQueryBuilder.mockReturnValue(mockSettlementQb);

      const cases = await controller.getCasesByCustomer('BRANCH_01', 'KH001');

      expect(cases).toHaveLength(2);

      // Completed case should have isCompleted=true and agingDays ~ 10
      expect(cases[0].id).toBe('case-1');
      expect(cases[0].isCompleted).toBe(true);
      expect(cases[0].agingDays).toBeGreaterThanOrEqual(9);
      expect(cases[0].agingDays).toBeLessThanOrEqual(11);

      // In-progress case should have isCompleted=false and agingDays = 0
      expect(cases[1].id).toBe('case-2');
      expect(cases[1].isCompleted).toBe(false);
      expect(cases[1].agingDays).toBe(0);
    });
  });
});
