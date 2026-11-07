import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import { CashflowForecast } from '../entities/cashflow-forecast.entity';
import { AbstractCashflowForecastCommandService } from './abstract-cashflow-forecast-command.service';

class TestForecastCommand extends AbstractCashflowForecastCommandService<CashflowForecast> {
  protected readonly headerEntity = CashflowForecast;
  protected readonly docType = 'CASHFLOW_FORECAST';
}

const CREATOR = 'user-creator';
const APPROVER = 'user-approver';

function draftRow(requiresApproval: boolean): CashflowForecast {
  return Object.assign(new CashflowForecast(), {
    id: 'f-1',
    status: 'DRAFT',
    requiresApproval,
    approverId: null,
    isDeleted: false,
    createdBy: CREATOR,
  });
}

function buildService(row: CashflowForecast) {
  const qb = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(row),
  };
  const manager = {
    createQueryBuilder: jest.fn(() => qb),
    save: jest.fn(async (_e: unknown, v: unknown) => v),
  };
  const dataSource = {
    transaction: jest.fn(async (cb: (m: typeof manager) => Promise<unknown>) =>
      cb(manager),
    ),
  } as unknown as DataSource;
  const events = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as ApprovalEventService;
  return new TestForecastCommand(dataSource, events, []);
}

describe('gửi duyệt: người duyệt', () => {
  it('chứng từ cần duyệt: bắt buộc có người duyệt', async () => {
    const service = buildService(draftRow(true));
    await expect(
      service.transition('f-1', 'submit', { id: CREATOR, roles: [] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('chọn chính mình làm người duyệt → 400', async () => {
    const service = buildService(draftRow(true));
    await expect(
      service.transition('f-1', 'submit', { id: CREATOR, roles: [] }, null, {
        approverId: CREATOR,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('chọn người duyệt khác: lưu approverId và chuyển PENDING_APPROVAL', async () => {
    const row = draftRow(true);
    const service = buildService(row);
    const result = await service.transition(
      'f-1',
      'submit',
      { id: CREATOR, roles: [] },
      null,
      { approverId: APPROVER },
    );
    expect(result.approverId).toBe(APPROVER);
    expect(result.status).toBe('PENDING_APPROVAL');
  });

  it('chứng từ không cần duyệt: không lưu người duyệt', async () => {
    const row = draftRow(false);
    row.approverId = 'stale';
    const service = buildService(row);
    const result = await service.transition(
      'f-1',
      'submit',
      { id: CREATOR, roles: [] },
      null,
      { approverId: APPROVER },
    );
    expect(result.approverId).toBeNull();
  });
});
