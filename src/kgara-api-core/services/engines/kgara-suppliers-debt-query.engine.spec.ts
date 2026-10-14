import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KgaraSuppliersDebtQueryEngine } from './kgara-suppliers-debt-query.engine';
import { KgaraCase } from '../../entities/kgara_case.entity';
import { KgaraGrossProfit } from '../../entities/kgara_gross_profit.entity';

describe('KgaraSuppliersDebtQueryEngine', () => {
  let engine: KgaraSuppliersDebtQueryEngine;
  let caseRepo: any;
  let grossProfitRepo: any;

  beforeEach(async () => {
    const mockRepo = () => ({
      manager: {
        query: jest.fn(),
      },
    });

    caseRepo = mockRepo();
    grossProfitRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KgaraSuppliersDebtQueryEngine,
        { provide: getRepositoryToken(KgaraCase), useValue: caseRepo },
        {
          provide: getRepositoryToken(KgaraGrossProfit),
          useValue: grossProfitRepo,
        },
      ],
    }).compile();

    engine = module.get<KgaraSuppliersDebtQueryEngine>(
      KgaraSuppliersDebtQueryEngine,
    );
  });

  it('should map column names to db fields correctly', () => {
    expect(engine.mapColumnToDbField('customer')).toContain('khach_hang_name');
    expect(engine.mapColumnToDbField('licensePlate')).toContain('bien_so_xe');
    expect(engine.mapColumnToDbField('bienSoXe')).toContain('bien_so_xe');
    expect(engine.mapColumnToDbField('customerName')).toContain(
      'khach_hang_name',
    );
    expect(engine.mapColumnToDbField('customerCode')).toContain(
      'khach_hang_code',
    );
  });

  it('should return maxAgingDays options correctly', async () => {
    const res = await engine.getSuppliersDebtColumnOptions(
      'BR-01',
      'maxAgingDays',
    );
    expect(res.items).toEqual([
      '0 ngày',
      '1-30 ngày',
      '31-60 ngày',
      '61-90 ngày',
      '>90 ngày',
    ]);
    expect(res.total).toBe(5);

    const filtered = await engine.getSuppliersDebtColumnOptions(
      'BR-01',
      'maxAgingDays',
      '60',
    );
    expect(filtered.items).toEqual(['31-60 ngày']);
    expect(filtered.total).toBe(1);
  });

  it('should return caseCount options correctly', async () => {
    caseRepo.manager.query.mockResolvedValueOnce([
      { value: '1' },
      { value: '2' },
      { value: '5' },
    ]);

    const res = await engine.getSuppliersDebtColumnOptions(
      'BR-01',
      'caseCount',
    );
    expect(res.items).toEqual(['1', '2', '5']);
    expect(res.total).toBe(3);
  });

  it('should return distinct customer options from db with label formatted', async () => {
    caseRepo.manager.query
      .mockResolvedValueOnce([{ total: '2' }])
      .mockResolvedValueOnce([
        { value: 'CÔNG TY A', extra: 'GR-KHA-001' },
        { value: 'CÔNG TY B', extra: 'CÔNG TY B' },
      ]);

    const res = await engine.getSuppliersDebtColumnOptions('BR-01', 'customer');
    expect(res.items).toEqual([
      { label: 'CÔNG TY A (GR-KHA-001)', value: 'CÔNG TY A' },
      { label: 'CÔNG TY B', value: 'CÔNG TY B' },
    ]);
    expect(res.total).toBe(2);
  });

  it('should query and return suppliers debt grouped by license plate', async () => {
    const mockSummary = [
      {
        total_customers: '2',
        total_cases: '3',
        total_cost: '10000000',
        total_paid: '0',
        total_balance: '10000000',
        total_aging_0_30: '6000000',
        total_aging_31_60: '4000000',
        total_aging_61_90: '0',
        total_aging_over_90: '0',
      },
    ];

    const mockRows = [
      {
        license_plate: '51H02028',
        customer_code: 'GR-KHA-000107',
        customer_name: 'CÔNG TY TNHH ĐẦU TƯ',
        branch_external_id: 'BR-01',
        case_count: 2,
        vehicle_count: 1,
        cost_amount: '6000000',
        paid_amount: '0',
        balance_amount: '6000000',
        latest_date: '2026-08-26T10:56:00.000Z',
        oldest_date: '2026-08-20T10:56:00.000Z',
        max_aging_days: 15,
        aging_0_30: '6000000',
        aging_31_60: '0',
        aging_61_90: '0',
        aging_over_90: '0',
      },
      {
        license_plate: 'CHUA_CO_BKS',
        customer_code: 'GR-KHA-000200',
        customer_name: 'CÁ NHÂN',
        branch_external_id: 'BR-01',
        case_count: 1,
        vehicle_count: 0,
        cost_amount: '4000000',
        paid_amount: '0',
        balance_amount: '4000000',
        latest_date: '2026-08-10T10:56:00.000Z',
        oldest_date: '2026-08-10T10:56:00.000Z',
        max_aging_days: 40,
        aging_0_30: '0',
        aging_31_60: '4000000',
        aging_61_90: '0',
        aging_over_90: '0',
      },
    ];

    caseRepo.manager.query
      .mockResolvedValueOnce(mockSummary)
      .mockResolvedValueOnce(mockRows);

    const result = await engine.getSuppliersDebt({
      branchId: 'BR-01',
      page: 1,
      pageSize: 20,
    });

    expect(result.total).toBe(2);
    expect(result.data.length).toBe(2);
    expect(result.data[0].licensePlate).toBe('51H02028');
    expect(result.data[0].bienSoXe).toBe('51H02028');
    expect(result.data[0].customerCode).toBe('GR-KHA-000107');
    expect(result.data[0].costAmount).toBe(6000000);
    expect(result.data[1].licensePlate).toBe(''); // CHUA_CO_BKS maps to empty string
    expect(result.summary.totalCost).toBe(10000000);
    expect(result.summary.totalAging0_30).toBe(6000000);
  });
  it('trừ cấn trừ PAYMENT: SQL join PAYMENT, paid/balance lấy từ DB, cho phép âm', async () => {
    caseRepo.manager.query
      .mockResolvedValueOnce([
        {
          total_customers: '1',
          total_cost: '1000000',
          total_paid: '1200000',
          total_balance: '-200000',
        },
      ])
      .mockResolvedValueOnce([
        {
          license_plate: '51K33130',
          customer_code: 'KH1',
          customer_name: 'A',
          case_count: 1,
          cost_amount: '1000000',
          paid_amount: '1200000',
          balance_amount: '-200000',
          max_aging_days: 10,
        },
      ]);

    const result = await engine.getSuppliersDebt({
      branchId: 'BR-01',
      page: 1,
      pageSize: 20,
    });

    for (const [sql] of caseRepo.manager.query.mock.calls) {
      expect(sql).toContain(`"settlement_type" = 'PAYMENT'`);
      expect(sql).toContain('<> 0');
    }
    expect(result.data[0].paidAmount).toBe(1200000);
    expect(result.data[0].balanceAmount).toBe(-200000);
    expect(result.data[0].ckCo).toBe(-200000);
    expect(result.summary.totalPaid).toBe(1200000);
    expect(result.summary.totalBalance).toBe(-200000);
  });

  describe('chỉ tính phiếu hoàn thành (tình trạng 3)', () => {
    const STATUS_CONDITION = '"c"."tinh_trang_dich_vu" = 3';

    const expectCompletedOnly = () => {
      const calls = caseRepo.manager.query.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const [sql] of calls) {
        expect(sql).toContain(STATUS_CONDITION);
        expect(sql).toContain('"c"."id" IS NOT NULL');
        expect(sql).not.toContain('"c"."id" IS NULL OR');
      }
    };

    it('danh sách phải trả theo biển số lọc tình trạng = 3', async () => {
      caseRepo.manager.query
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([]);

      await engine.getSuppliersDebt({
        branchId: 'BR-01',
        page: 1,
        pageSize: 20,
      });

      expectCompletedOnly();
    });

    it('options caseCount lọc tình trạng = 3', async () => {
      caseRepo.manager.query.mockResolvedValueOnce([]);

      await engine.getSuppliersDebtColumnOptions('BR-01', 'caseCount');

      expectCompletedOnly();
    });

    it('options khách hàng lọc tình trạng = 3', async () => {
      caseRepo.manager.query
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([]);

      await engine.getSuppliersDebtColumnOptions('BR-01', 'customer');

      expectCompletedOnly();
    });
  });
});
