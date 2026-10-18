import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { GarageCashflowSettleHandler } from './garage-cashflow-settle.handler';
import { KgaraCashflowVoucher } from '../../entities/kgara_cashflow_voucher.entity';
import * as opexSyncHelper from '../../helpers/garage-cashflow-opex-sync.helper';

describe('GarageCashflowSettleHandler', () => {
  let handler: GarageCashflowSettleHandler;
  let mockManager: Partial<EntityManager>;
  let mockDataSource: Partial<DataSource>;

  beforeEach(async () => {
    mockManager = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      delete: jest.fn(),
    };

    const mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: mockManager,
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GarageCashflowSettleHandler,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    handler = module.get<GarageCashflowSettleHandler>(
      GarageCashflowSettleHandler,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should sync to opex when voucher is PAYMENT and PAID with 10. Vật tư tiêu hao', async () => {
    const syncSpy = jest
      .spyOn(opexSyncHelper, 'syncOpexFromVoucher')
      .mockResolvedValue(undefined);

    const voucher = {
      id: 'v-1',
      voucherCode: 'PC-GARA-001',
      voucherType: 'PAYMENT',
      paymentStatus: 'PAID',
      paymentContent: '10. Vật tư tiêu hao',
      amount: 1500000,
      transDate: '2026-10-18',
    } as KgaraCashflowVoucher;

    const result = await handler.handleCashflowSettled({ voucher });

    expect(syncSpy).toHaveBeenCalled();
    expect(result.syncedToOpex).toBe(true);
    expect(result.isCommissionProtected).toBe(false);
  });

  it('should mark as commission protected when voucher is 6. HH Xưởng', async () => {
    const voucher = {
      id: 'v-2',
      voucherCode: 'PC-GARA-002',
      voucherType: 'PAYMENT',
      paymentStatus: 'PAID',
      paymentContent: '6. HH Xưởng',
      amount: 2000000,
      transDate: '2026-10-18',
    } as KgaraCashflowVoucher;

    const result = await handler.handleCashflowSettled({ voucher });

    expect(result.isCommissionProtected).toBe(true);
    expect(result.syncedToOpex).toBe(false);
  });
});
