import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import { CashflowForecast } from '@/v2/core/cashflow-core';
import { GarageForecastCommandService } from './garage-forecast-command.service';

const ACTOR = { id: 'user-1', roles: [] as string[] };

function buildManager(opts: {
  row?: CashflowForecast | null;
  allocated?: number;
}) {
  const qb = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(opts.row ?? null),
  };
  return {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((_entity: unknown, values: object) => ({ ...values })),
    save: jest.fn(async (_entity: unknown, value: unknown) => value),
    count: jest.fn().mockResolvedValue(opts.allocated ?? 0),
  };
}

function buildService(
  opts: {
    row?: CashflowForecast | null;
    allocated?: number;
  } = {},
) {
  const manager = buildManager(opts);
  const dataSource = {
    transaction: jest.fn(async (cb: (m: typeof manager) => Promise<unknown>) =>
      cb(manager),
    ),
  } as unknown as DataSource;
  const events = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as ApprovalEventService;
  const hook = { name: 'probe', afterCreate: jest.fn() };
  const service = new GarageForecastCommandService(dataSource, events, [hook]);
  return { service, manager, hook };
}

function forecast(overrides: Partial<CashflowForecast> = {}): CashflowForecast {
  return Object.assign(new CashflowForecast(), {
    id: 'f-1',
    direction: 'OUT',
    kind: 'OTHER',
    status: 'OPEN',
    amount: '100.00',
    requiresApproval: false,
    isDeleted: false,
    createdBy: 'user-2',
    ...overrides,
  });
}

describe('GarageForecastCommandService', () => {
  describe('createForecast', () => {
    it('dự chi mua hàng tính tiền từ dòng hàng và truyền dòng cho hook', async () => {
      const { service, hook } = buildService();
      const created = await service.createForecast(ACTOR, {
        direction: 'OUT',
        kind: 'PURCHASE',
        amount: 999,
        lines: [
          { itemName: 'Lọc dầu', qtyRequested: 2, unitPrice: 150000 },
          { itemName: 'Dầu nhớt', qtyRequested: 1.5, unitPrice: 100000 },
        ],
      });
      expect(created.amount).toBe(450000);
      expect(created.status).toBe('DRAFT');
      expect(created.requiresApproval).toBe(true);
      expect(created.code).toMatch(/^DC-GARA-\d{8}-[0-9A-F]{6}$/);
      expect(hook.afterCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            lines: [
              expect.objectContaining({ itemName: 'Lọc dầu', amount: 300000 }),
              expect.objectContaining({ itemName: 'Dầu nhớt', amount: 150000 }),
            ],
          }),
        }),
      );
    });

    it('dự chi mua hàng không có dòng hàng → 400', async () => {
      const { service } = buildService();
      await expect(
        service.createForecast(ACTOR, {
          direction: 'OUT',
          kind: 'PURCHASE',
          lines: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('dự thu mua hàng (IN + PURCHASE) → 400', async () => {
      const { service } = buildService();
      await expect(
        service.createForecast(ACTOR, {
          direction: 'IN',
          kind: 'PURCHASE',
          lines: [{ itemName: 'x', qtyRequested: 1, unitPrice: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('loại khác PURCHASE mà gửi dòng hàng → 400', async () => {
      const { service } = buildService();
      await expect(
        service.createForecast(ACTOR, {
          direction: 'OUT',
          kind: 'OTHER',
          amount: 10,
          lines: [{ itemName: 'x', qtyRequested: 1, unitPrice: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('dự thu không cần duyệt → OPEN ngay', async () => {
      const { service } = buildService();
      const created = await service.createForecast(ACTOR, {
        direction: 'IN',
        kind: 'CASE_RECEIVABLE',
        amount: 500,
      });
      expect(created.status).toBe('OPEN');
      expect(created.requiresApproval).toBe(false);
    });

    it('dòng hàng có số lượng 0 → 400', async () => {
      const { service } = buildService();
      await expect(
        service.createForecast(ACTOR, {
          direction: 'OUT',
          kind: 'PURCHASE',
          lines: [{ itemName: 'x', qtyRequested: 0, unitPrice: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('chặn hủy khi đã có phân bổ thanh toán → 409', async () => {
      const { service } = buildService({
        row: forecast({ status: 'OPEN' }),
        allocated: 1,
      });
      await expect(
        service.transition('f-1', 'cancel', ACTOR, 'Hủy'),
      ).rejects.toThrow(ConflictException);
    });

    it('cho hủy khi chưa có phân bổ', async () => {
      const { service, manager } = buildService({
        row: forecast({ status: 'OPEN' }),
        allocated: 0,
      });
      const result = await service.transition('f-1', 'cancel', ACTOR, 'Hủy');
      expect(result.status).toBe('CANCELLED');
      expect(manager.count).toHaveBeenCalledWith(expect.anything(), {
        where: { forecastId: 'f-1' },
      });
    });
  });
});
