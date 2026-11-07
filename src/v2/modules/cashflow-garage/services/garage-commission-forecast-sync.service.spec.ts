import { CashflowForecast } from '@/v2/core/cashflow-core';
import { CashflowGarageForecastExt } from '../entities/cashflow-garage-forecast-ext.entity';
import { GarageCommissionForecastSyncService } from './garage-commission-forecast-sync.service';

type Row = Record<string, unknown>;

function makeService(headers: Row[]) {
  const extByHeader = new Map(
    headers.map((h) => [
      h.id as string,
      { forecastId: h.id, pnlCommissionAnchorId: null },
    ]),
  );
  const qb = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(() => Promise.resolve(headers)),
  };
  const manager = {
    createQueryBuilder: jest.fn(() => qb),
    findOneByOrFail: jest.fn((_e: unknown, where: { forecastId: string }) =>
      Promise.resolve(extByHeader.get(where.forecastId)),
    ),
    create: jest.fn((_e: unknown, values: Row) => ({
      id: 'new-id',
      ...values,
    })),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
  };
  const dataSource = {
    transaction: jest.fn((cb: (m: unknown) => Promise<unknown>) => cb(manager)),
  };
  const service = new GarageCommissionForecastSyncService(dataSource as never);
  return { service, manager };
}

const header = (over: Row = {}): Row => ({
  id: 'h-1',
  code: 'PC-GARA-261201-001',
  direction: 'OUT',
  status: 'DRAFT',
  amount: '100',
  plannedDate: '2027-01-10',
  note: null,
  isDeleted: false,
  createdAt: new Date('2026-12-01'),
  ...over,
});

const input = (amount: number) => ({
  year: 2026,
  month: 12,
  type: 'HOA_HONG_SALE' as const,
  amount,
  categoryName: 'Hoa hồng cho Sale (10%)',
  paymentContent: '5. HH Bán hàng',
});

describe('GarageCommissionForecastSyncService', () => {
  it('chưa có phiếu, số tiền > 0: tạo dự chi OUT DRAFT với mốc P&L, ngày dự kiến đầu tháng sau', async () => {
    const { service, manager } = makeService([]);
    const result = await service.syncCommission(input(500));

    expect(result).toEqual({ synced: 1, created: 1, updated: 0, delta: 0 });
    const headerCall = manager.create.mock.calls.find(
      (c) => c[0] === CashflowForecast,
    );
    expect(headerCall?.[1]).toMatchObject({
      direction: 'OUT',
      kind: 'COMMISSION',
      source: 'AUTO',
      status: 'DRAFT',
      amount: '500',
      plannedDate: '2027-01-10',
    });
    const extCall = manager.create.mock.calls.find(
      (c) => c[0] === CashflowGarageForecastExt,
    );
    expect(extCall?.[1]).toMatchObject({
      isAutoCommission: true,
      pnlPeriodYear: 2026,
      pnlPeriodMonth: 12,
      pnlCommissionType: 'HOA_HONG_SALE',
      paymentContent: '5. HH Bán hàng',
    });
  });

  it('chưa có phiếu, số tiền = 0: không tạo gì', async () => {
    const { service, manager } = makeService([]);
    const result = await service.syncCommission(input(0));
    expect(result.created).toBe(0);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('có phiếu chờ, số tiền mới > 0: cập nhật số tiền phiếu chờ', async () => {
    const pending = header({ amount: '100' });
    const { service } = makeService([pending]);
    const result = await service.syncCommission(input(250));

    expect(result).toEqual({ synced: 1, created: 0, updated: 1, delta: 0 });
    expect(pending.amount).toBe('250');
  });

  it('có phiếu chờ, số tiền về 0: hủy phiếu chờ', async () => {
    const pending = header({ status: 'OPEN' });
    const { service } = makeService([pending]);
    await service.syncCommission(input(0));
    expect(pending.status).toBe('CANCELLED');
  });

  it('đã chi 1000, số tiền 1500: tạo phiếu chênh lệch 500, neo vào phiếu đã chi', async () => {
    const paid = header({ id: 'paid-1', status: 'SETTLED', amount: '1000' });
    const { service, manager } = makeService([paid]);
    const result = await service.syncCommission(input(1500));

    expect(result).toEqual({ synced: 1, created: 1, updated: 0, delta: 1 });
    const extCall = manager.create.mock.calls.find(
      (c) => c[0] === CashflowGarageForecastExt,
    );
    expect(extCall?.[1]).toMatchObject({ pnlCommissionAnchorId: 'paid-1' });
    const headerCall = manager.create.mock.calls.find(
      (c) => c[0] === CashflowForecast,
    );
    expect(headerCall?.[1]).toMatchObject({ amount: '500', status: 'DRAFT' });
  });

  it('đã chi 1000, số tiền 1200, có phiếu chờ: cập nhật phiếu chờ thành 200', async () => {
    const paid = header({ id: 'paid-1', status: 'SETTLED', amount: '1000' });
    const pending = header({ id: 'p-1', status: 'DRAFT', amount: '50' });
    const { service } = makeService([paid, pending]);
    const result = await service.syncCommission(input(1200));

    expect(result).toEqual({ synced: 1, created: 0, updated: 1, delta: 0 });
    expect(pending.amount).toBe('200');
  });

  it('đã chi 1000, số tiền 800 (không còn chênh lệch dương): hủy phiếu chờ', async () => {
    const paid = header({ id: 'paid-1', status: 'SETTLED', amount: '1000' });
    const pending = header({ id: 'p-1', status: 'DRAFT', amount: '50' });
    const { service } = makeService([paid, pending]);
    const result = await service.syncCommission(input(800));

    expect(result.created).toBe(0);
    expect(pending.status).toBe('CANCELLED');
  });

  it('đã chi 1000, số tiền 800, không có phiếu chờ: không tạo gì', async () => {
    const paid = header({ id: 'paid-1', status: 'SETTLED', amount: '1000' });
    const { service, manager } = makeService([paid]);
    const result = await service.syncCommission(input(800));

    expect(result.created).toBe(0);
    expect(manager.create).not.toHaveBeenCalled();
  });
});
