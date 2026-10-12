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
    expect(engine.mapColumnToDbField('licensePlate')).toContain('bien_so_xe');
    expect(engine.mapColumnToDbField('bienSoXe')).toContain('bien_so_xe');
    expect(engine.mapColumnToDbField('customerName')).toContain(
      'khach_hang_name',
    );
    expect(engine.mapColumnToDbField('customerCode')).toContain(
      'khach_hang_code',
    );
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
});
