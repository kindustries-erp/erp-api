import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GaragePnlCommissionHandler } from './garage-pnl-commission.handler';
import { KgaraOperatingExpense } from '../../entities/kgara_operating_expense.entity';
import { KgaraCashflowVoucher } from '../../entities/kgara_cashflow_voucher.entity';
import { PnlCommissionEvent } from '../garage-hub.types';

describe('GaragePnlCommissionHandler', () => {
  let handler: GaragePnlCommissionHandler;
  let opexRepo: jest.Mocked<Repository<KgaraOperatingExpense>>;
  let voucherRepo: jest.Mocked<Repository<KgaraCashflowVoucher>>;

  beforeEach(async () => {
    const mockOpexRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'opex-1' })),
      save: jest.fn().mockImplementation(async (entity) => ({ ...entity })),
    };

    const mockVoucherRepo = {
      find: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'v-1' })),
      save: jest.fn().mockImplementation(async (entity) => ({ ...entity })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GaragePnlCommissionHandler,
        {
          provide: getRepositoryToken(KgaraOperatingExpense),
          useValue: mockOpexRepo,
        },
        {
          provide: getRepositoryToken(KgaraCashflowVoucher),
          useValue: mockVoucherRepo,
        },
      ],
    }).compile();

    handler = module.get<GaragePnlCommissionHandler>(
      GaragePnlCommissionHandler,
    );
    opexRepo = module.get(getRepositoryToken(KgaraOperatingExpense));
    voucherRepo = module.get(getRepositoryToken(KgaraCashflowVoucher));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create new PENDING vouchers when no previous vouchers exist', async () => {
    opexRepo.findOne.mockResolvedValue(null);
    voucherRepo.find.mockResolvedValue([]);

    const event: PnlCommissionEvent = {
      year: 2026,
      month: 10,
      saleCommission: 5000000,
      dvCommission: 8000000,
      kyGuiProfitRate: 40,
    };

    const result = await handler.handlePnlCommissionSync(event);

    expect(opexRepo.save).toHaveBeenCalledTimes(2);
    expect(voucherRepo.create).toHaveBeenCalledTimes(2);
    expect(voucherRepo.save).toHaveBeenCalledTimes(2);
    expect(result.createdVouchers).toBe(2);
    expect(result.syncedOpex).toBe(2);
  });

  it('should lock PAID voucher and create delta voucher when commission increases', async () => {
    opexRepo.findOne.mockResolvedValue({ id: 'opex-1' } as any);

    const paidVoucher = {
      id: 'v-paid',
      amount: 5000000,
      paymentStatus: 'PAID',
      pnlCommissionType: 'HOA_HONG_DV',
    } as KgaraCashflowVoucher;

    voucherRepo.find.mockResolvedValue([paidVoucher]);

    const event: PnlCommissionEvent = {
      year: 2026,
      month: 10,
      saleCommission: 0,
      dvCommission: 7000000, // Tăng thêm 2 triệu delta
      kyGuiProfitRate: 0,
    };

    const result = await handler.handlePnlCommissionSync(event);

    expect(voucherRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2000000, // Delta đúng 2,000,000 đ
        paymentStatus: 'PENDING',
        pnlCommissionAnchorId: 'v-paid',
      }),
    );
    expect(result.deltaVouchers).toBe(1);
  });

  it('should cancel pending voucher if delta <= 0', async () => {
    opexRepo.findOne.mockResolvedValue({ id: 'opex-1' } as any);

    const paidVoucher = {
      id: 'v-paid',
      amount: 5000000,
      paymentStatus: 'PAID',
    } as KgaraCashflowVoucher;

    const pendingVoucher = {
      id: 'v-pending',
      amount: 1000000,
      paymentStatus: 'PENDING',
    } as KgaraCashflowVoucher;

    voucherRepo.find.mockResolvedValue([paidVoucher, pendingVoucher]);

    const event: PnlCommissionEvent = {
      year: 2026,
      month: 10,
      saleCommission: 0,
      dvCommission: 4000000, // Giảm xuống thấp hơn số đã trả
      kyGuiProfitRate: 0,
    };

    await handler.handlePnlCommissionSync(event);

    // Phiếu pending phải được đóng dấu CANCELLED, không hard delete
    expect(voucherRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'v-pending',
        paymentStatus: 'CANCELLED',
      }),
    );
  });
});
