import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import type { CashflowForecastHook } from '../contracts/cashflow-core.hooks';
import { CashflowForecast } from '../entities/cashflow-forecast.entity';
import { AbstractCashflowForecastCommandService } from './abstract-cashflow-forecast-command.service';

class TestForecastCommand extends AbstractCashflowForecastCommandService<CashflowForecast> {
  protected readonly headerEntity = CashflowForecast;
  protected readonly docType = 'CASHFLOW_FORECAST';
}

const CREATOR = 'user-creator';
const APPROVER = 'user-approver';
const OTHER = 'user-other';

function buildForecast(
  overrides: Partial<CashflowForecast> = {},
): CashflowForecast {
  return Object.assign(new CashflowForecast(), {
    id: 'f-1',
    code: 'DC-GARA-0001',
    direction: 'OUT',
    kind: 'PURCHASE',
    source: 'MANUAL',
    amount: '1000000.00',
    status: 'PENDING_APPROVAL',
    requiresApproval: true,
    isDeleted: false,
    createdBy: CREATOR,
    submittedBy: CREATOR,
    approverId: null,
    ...overrides,
  });
}

function buildManager(row: CashflowForecast | null) {
  const qb = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(row),
  };
  return {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((_entity: unknown, values: object) => ({ ...values })),
    save: jest.fn(async (_entity: unknown, value: unknown) => value),
  };
}

function buildService(
  row: CashflowForecast | null,
  hooks: CashflowForecastHook<CashflowForecast>[] = [],
) {
  const manager = buildManager(row);
  const dataSource = {
    transaction: jest.fn(async (cb: (m: typeof manager) => Promise<unknown>) =>
      cb(manager),
    ),
  } as unknown as DataSource;
  const events = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as ApprovalEventService;
  const service = new TestForecastCommand(dataSource, events, hooks);
  return { service, manager, events };
}

describe('AbstractCashflowForecastCommandService', () => {
  describe('createDraft', () => {
    it('tạo DRAFT khi cần duyệt', async () => {
      const { service, manager } = buildService(null);
      const created = await service.createDraft(
        { id: CREATOR, roles: [] },
        {
          direction: 'OUT',
          kind: 'PURCHASE',
          amount: 100,
          requiresApproval: true,
        },
      );
      expect(created.status).toBe('DRAFT');
      expect(created.createdBy).toBe(CREATOR);
      expect(manager.save).toHaveBeenCalledTimes(1);
    });

    it('tạo OPEN ngay khi không cần duyệt (dự thu mặc định)', async () => {
      const { service } = buildService(null);
      const created = await service.createDraft(
        { id: CREATOR, roles: [] },
        {
          direction: 'IN',
          kind: 'CASE_RECEIVABLE',
          amount: 100,
          requiresApproval: false,
        },
      );
      expect(created.status).toBe('OPEN');
    });
  });

  describe('hooks', () => {
    it('afterCreate chạy với cùng manager trong transaction', async () => {
      const afterCreate = jest.fn();
      const { service, manager } = buildService(null, [
        { name: 'probe', afterCreate },
      ]);
      await service.createDraft(
        { id: CREATOR, roles: [] },
        { direction: 'IN', kind: 'OTHER', amount: 10, requiresApproval: false },
      );
      expect(afterCreate).toHaveBeenCalledTimes(1);
      expect(afterCreate.mock.calls[0][0].manager).toBe(manager);
    });

    it('afterTransition nhận from/to và chạy sau khi ghi nhật ký', async () => {
      const order: string[] = [];
      const afterTransition = jest.fn(() => {
        order.push('hook');
      });
      const { service, events } = buildService(
        buildForecast({ status: 'DRAFT', submittedBy: null }),
        [{ name: 'probe', afterTransition }],
      );
      (events.record as jest.Mock).mockImplementation(async () => {
        order.push('event');
      });
      await service.transition(
        'f-1',
        'submit',
        { id: CREATOR, roles: [] },
        null,
        { approverId: APPROVER },
      );
      expect(order).toEqual(['event', 'hook']);
      expect(afterTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'submit',
          from: 'DRAFT',
          to: 'PENDING_APPROVAL',
        }),
      );
    });

    it('lỗi từ hook làm hỏng cả thao tác', async () => {
      const { service } = buildService(
        buildForecast({ status: 'DRAFT', submittedBy: null }),
        [
          {
            name: 'failing',
            afterTransition: () => {
              throw new Error('hook lỗi');
            },
          },
        ],
      );
      await expect(
        service.transition('f-1', 'submit', { id: CREATOR, roles: [] }, null, {
          approverId: APPROVER,
        }),
      ).rejects.toThrow('hook lỗi');
    });
  });

  describe('transition', () => {
    it('gửi duyệt từ DRAFT, ghi người gửi và nhật ký', async () => {
      const row = buildForecast({ status: 'DRAFT', submittedBy: null });
      const { service, events } = buildService(row);
      const result = await service.transition(
        'f-1',
        'submit',
        { id: CREATOR, roles: [] },
        null,
        { approverId: APPROVER },
      );
      expect(result.status).toBe('PENDING_APPROVAL');
      expect(result.submittedBy).toBe(CREATOR);
      expect(events.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          docType: 'CASHFLOW_FORECAST',
          fromStatus: 'DRAFT',
          toStatus: 'PENDING_APPROVAL',
        }),
      );
    });

    it('chặn gửi duyệt khi đang OPEN (409)', async () => {
      const { service } = buildService(buildForecast({ status: 'OPEN' }));
      await expect(
        service.transition('f-1', 'submit', { id: CREATOR, roles: [] }),
      ).rejects.toThrow(ConflictException);
    });

    it('chặn người tạo tự duyệt (403)', async () => {
      const { service } = buildService(buildForecast());
      await expect(
        service.transition('f-1', 'approve', { id: CREATOR, roles: [] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('duyệt thành OPEN bởi người khác và ghi người duyệt', async () => {
      const { service } = buildService(buildForecast());
      const result = await service.transition('f-1', 'approve', {
        id: APPROVER,
        roles: [],
      });
      expect(result.status).toBe('OPEN');
      expect(result.approvedBy).toBe(APPROVER);
    });

    it('chỉ người được chỉ định mới duyệt được', async () => {
      const { service } = buildService(buildForecast({ approverId: APPROVER }));
      await expect(
        service.transition('f-1', 'approve', { id: OTHER, roles: [] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('từ chối bắt buộc có lý do', async () => {
      const { service } = buildService(buildForecast());
      await expect(
        service.transition('f-1', 'reject', { id: APPROVER, roles: [] }, '  '),
      ).rejects.toThrow();
    });

    it('từ chối có lý do thì về REJECTED và lưu lý do', async () => {
      const { service } = buildService(buildForecast());
      const result = await service.transition(
        'f-1',
        'reject',
        { id: APPROVER, roles: [] },
        'Thiếu chứng từ',
      );
      expect(result.status).toBe('REJECTED');
      expect(result.rejectReason).toBe('Thiếu chứng từ');
    });

    it('không hủy khi đang PENDING_APPROVAL (409)', async () => {
      const { service } = buildService(buildForecast());
      await expect(
        service.transition('f-1', 'cancel', { id: CREATOR, roles: [] }, 'Hủy'),
      ).rejects.toThrow(ConflictException);
    });

    it('không tìm thấy chứng từ (404)', async () => {
      const { service } = buildService(null);
      await expect(
        service.transition('missing', 'submit', { id: CREATOR, roles: [] }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
