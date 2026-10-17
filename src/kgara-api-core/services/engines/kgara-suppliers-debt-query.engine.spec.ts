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

  it('agingBucket: giữ xe có phiếu số dư khác 0 trong mốc (HAVING COUNT > 0)', async () => {
    caseRepo.manager.query
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([]);

    await engine.getSuppliersDebt({
      branchId: 'BR-01',
      page: 1,
      pageSize: 20,
      column_filters: JSON.stringify({ agingBucket: ['31-60'] }),
    });

    const calls = caseRepo.manager.query.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [sql] of calls) {
      expect(sql).toContain('HAVING');
      expect(sql).toContain('BETWEEN 31 AND 60 AND');
      expect(sql).toContain('<> 0 THEN 1 END) > 0');
    }
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

  it('should sort by all aging buckets with the requested directions', async () => {
    caseRepo.manager.query
      .mockResolvedValueOnce([{ total_customers: '0' }])
      .mockResolvedValueOnce([]);

    await engine.getSuppliersDebt({
      branchId: 'BR-01',
      page: 1,
      pageSize: 20,
      sorts: ['aging0_30', '-aging31_60', 'aging61_90', '-agingOver90'],
    });

    const dataQuery = caseRepo.manager.query.mock.calls[1][0];
    expect(dataQuery).toContain(
      'ORDER BY "aging_0_30" ASC, "aging_31_60" DESC, "aging_61_90" ASC, "aging_over_90" DESC',
    );
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

  describe('bộ lọc phân khoảng balanceAmount và paidAmount', () => {
    it('trả về đúng danh sách options phân khoảng tiền tệ cho balanceAmount', async () => {
      const res = await engine.getSuppliersDebtColumnOptions(
        'BR-01',
        'balanceAmount',
      );
      expect(res.items).toHaveLength(5);
      expect(res.items[0]).toEqual({
        label: '0 đ (Đã thanh toán hết)',
        value: '0',
      });
      expect(res.items[1]).toEqual({
        label: '< 10.000.000 đ',
        value: '0-10m',
      });
      expect(res.items[4]).toEqual({
        label: '> 50.000.000 đ',
        value: '>50m',
      });

      const filtered = await engine.getSuppliersDebtColumnOptions(
        'BR-01',
        'balanceAmount',
        '50',
      );
      expect(filtered.items).toHaveLength(2);
      expect(filtered.items.map((i: any) => i.value)).toEqual([
        '20m-50m',
        '>50m',
      ]);
    });

    it('trả về đúng danh sách options phân khoảng tiền tệ cho paidAmount', async () => {
      const res = await engine.getSuppliersDebtColumnOptions(
        'BR-01',
        'paidAmount',
      );
      expect(res.items).toHaveLength(5);
      expect(res.items[0]).toEqual({
        label: '0 đ (Chưa chi)',
        value: '0',
      });
      expect(res.items[1]).toEqual({
        label: '< 10.000.000 đ',
        value: '0-10m',
      });

      const filtered = await engine.getSuppliersDebtColumnOptions(
        'BR-01',
        'paidAmount',
        'chưa chi',
      );
      expect(filtered.items).toHaveLength(1);
      expect(filtered.items[0].value).toBe('0');
    });

    it('áp dụng điều kiện HAVING chính xác khi lọc column_filters cho balanceAmount và paidAmount', async () => {
      caseRepo.manager.query
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([]);

      await engine.getSuppliersDebt({
        branchId: 'BR-01',
        page: 1,
        pageSize: 20,
        column_filters: JSON.stringify({
          balanceAmount: ['0-10m', '>50m'],
          paidAmount: ['0'],
        }),
      });

      const calls = caseRepo.manager.query.mock.calls;
      for (const [sql] of calls) {
        expect(sql).toContain('HAVING');
        expect(sql).toContain('10000000');
        expect(sql).toContain('50000000');
      }
    });

    it('áp dụng điều kiện HAVING chính xác khi lọc column_search cho balanceAmount và paidAmount', async () => {
      caseRepo.manager.query
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([]);

      await engine.getSuppliersDebt({
        branchId: 'BR-01',
        page: 1,
        pageSize: 20,
        column_search: JSON.stringify({
          balanceAmount: '5000000',
          paidAmount: '2000000',
        }),
      });

      const calls = caseRepo.manager.query.mock.calls;
      for (const [sql, params] of calls) {
        expect(sql).toContain('HAVING');
        expect(params).toContain(5000000);
        expect(params).toContain(2000000);
      }
    });
  });
});
