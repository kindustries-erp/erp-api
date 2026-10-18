import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GarageHubService } from './garage-hub.service';
import { GarageCaseLifecycleHandler } from './handlers/garage-case-lifecycle.handler';
import { GarageCashflowSettleHandler } from './handlers/garage-cashflow-settle.handler';
import { GaragePnlCommissionHandler } from './handlers/garage-pnl-commission.handler';
import { GaragePeriodLedgerHandler } from './handlers/garage-period-ledger.handler';
import { GarageCaseLedgerHandler } from './handlers/garage-case-ledger.handler';
import { KgaraCashflowVoucher } from '../entities/kgara_cashflow_voucher.entity';
import { KgaraOperatingExpense } from '../entities/kgara_operating_expense.entity';

describe('GarageHubService', () => {
  let service: GarageHubService;
  let caseLifecycleHandler: jest.Mocked<GarageCaseLifecycleHandler>;
  let cashflowSettleHandler: jest.Mocked<GarageCashflowSettleHandler>;
  let pnlCommissionHandler: jest.Mocked<GaragePnlCommissionHandler>;
  let voucherRepo: any;
  let opexRepo: any;
  let mockLedgerHandler: { loadLedger: jest.Mock };

  beforeEach(async () => {
    const mockCaseHandler = {
      handleCaseTransition: jest.fn().mockResolvedValue({
        caseId: 'c-1',
        handled: true,
        actionTaken: 'CREATED_EXPECTED',
      }),
      handleReceiptChanged: jest.fn().mockResolvedValue({
        caseId: 'c-1',
        handled: true,
        actionTaken: 'UPDATED_EXPECTED',
      }),
    };

    const mockCashflowHandler = {
      handleCashflowSettled: jest.fn().mockResolvedValue({
        voucherId: 'v-1',
        syncedToOpex: true,
        isCommissionProtected: false,
      }),
    };

    const mockPnlHandler = {
      handlePnlCommissionSync: jest.fn().mockResolvedValue({
        year: 2026,
        month: 10,
        syncedOpex: 2,
        syncedVouchers: 2,
        createdVouchers: 2,
        updatedVouchers: 0,
        deltaVouchers: 0,
      }),
    };

    mockLedgerHandler = {
      loadLedger: jest.fn().mockResolvedValue({
        vouchers: [],
        totals: {
          actualIn: 0,
          expectedIn: 0,
          actualOut: 0,
          plannedOut: 0,
          net: 0,
        },
      }),
    };

    voucherRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    opexRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GarageHubService,
        {
          provide: GarageCaseLifecycleHandler,
          useValue: mockCaseHandler,
        },
        {
          provide: GarageCashflowSettleHandler,
          useValue: mockCashflowHandler,
        },
        {
          provide: GaragePnlCommissionHandler,
          useValue: mockPnlHandler,
        },
        {
          provide: GaragePeriodLedgerHandler,
          useValue: mockLedgerHandler,
        },
        {
          provide: GarageCaseLedgerHandler,
          useValue: {
            loadCaseLedger: jest
              .fn()
              .mockResolvedValue({ c1: { expectedIn: 1, plannedOut: 2 } }),
          },
        },
        {
          provide: getRepositoryToken(KgaraCashflowVoucher),
          useValue: voucherRepo,
        },
        {
          provide: getRepositoryToken(KgaraOperatingExpense),
          useValue: opexRepo,
        },
      ],
    }).compile();

    service = module.get<GarageHubService>(GarageHubService);
    caseLifecycleHandler = module.get(GarageCaseLifecycleHandler);
    cashflowSettleHandler = module.get(GarageCashflowSettleHandler);
    pnlCommissionHandler = module.get(GaragePnlCommissionHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('handleCaseReceiptChanged ủy quyền cho lifecycle handler', async () => {
    const result = await service.handleCaseReceiptChanged('c-1');
    expect(result).toEqual({
      caseId: 'c-1',
      handled: true,
      actionTaken: 'UPDATED_EXPECTED',
    });
  });

  it('getCaseLedger ủy quyền cho handler theo phiếu dịch vụ', async () => {
    const result = await service.getCaseLedger(['c1']);
    expect(result).toEqual({ c1: { expectedIn: 1, plannedOut: 2 } });
  });

  it('getPeriodLedger ủy quyền cho handler sổ quỹ với đúng kỳ và chi nhánh', async () => {
    await service.getPeriodLedger('2026-10-01', '2026-10-31', 'CN1');
    expect(mockLedgerHandler.loadLedger).toHaveBeenCalledWith(
      '2026-10-01',
      '2026-10-31',
      'CN1',
    );
  });

  it('should delegate handleCaseTransition to caseLifecycleHandler', async () => {
    const event = { caseId: 'c-1', newStatus: 3 };
    const res = await service.handleCaseTransition(event as any);

    expect(caseLifecycleHandler.handleCaseTransition).toHaveBeenCalledWith(
      event,
    );
    expect(res.actionTaken).toBe('CREATED_EXPECTED');
  });

  it('should delegate handleCashflowSettled to cashflowSettleHandler', async () => {
    const event = { voucher: { id: 'v-1' } as any };
    const res = await service.handleCashflowSettled(event);

    expect(cashflowSettleHandler.handleCashflowSettled).toHaveBeenCalledWith(
      event,
      undefined,
    );
    expect(res.syncedToOpex).toBe(true);
  });

  it('should delegate handlePnlCommissionSync to pnlCommissionHandler', async () => {
    const event = {
      year: 2026,
      month: 10,
      saleCommission: 1000,
      dvCommission: 2000,
      kyGuiProfitRate: 20,
    };
    const res = await service.handlePnlCommissionSync(event);

    expect(pnlCommissionHandler.handlePnlCommissionSync).toHaveBeenCalledWith(
      event,
    );
    expect(res.createdVouchers).toBe(2);
  });

  it('should compute getHealthOverview correctly', async () => {
    voucherRepo.find.mockResolvedValueOnce([
      { amount: 5000000, transDate: '2026-10-01' }, // Quá hạn
      { amount: 3000000, transDate: '2099-10-01' }, // Chưa quá hạn
    ]);

    opexRepo.find.mockResolvedValueOnce([
      { amount: 4000000 },
      { amount: 6000000 },
    ]);

    voucherRepo.find.mockResolvedValueOnce([
      { amount: 10000000, paymentStatus: 'PENDING' },
    ]);

    const health = await service.getHealthOverview(2026, 10);

    expect(health.expectedReceipts.totalActiveCount).toBe(2);
    expect(health.expectedReceipts.totalActiveAmount).toBe(8000000);
    expect(health.expectedReceipts.overdueCount).toBe(1);
    expect(health.commissionCheck.isBalanced).toBe(true);
    expect(health.commissionCheck.difference).toBe(0);
  });
});
