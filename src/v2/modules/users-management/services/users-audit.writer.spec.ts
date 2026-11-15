import { Logger } from '@nestjs/common';
import type { AuditCoreService } from '@/audit-core/audit-core.service';
import type { UserAuditContext } from '../helpers/audit-context';
import { UsersAuditWriter } from './users-audit.writer';

const ctx: UserAuditContext = {
  actorUserId: 'admin-1',
  actorEmail: 'admin@liouni.com',
  route: '/api/v2/users-management',
  httpMethod: 'POST',
  uiScreen: 'users',
  uiAction: null,
  ipAddress: '1.2.3.4',
  userAgent: 'jest',
  requestId: 'r1',
};

describe('UsersAuditWriter', () => {
  let recordAction: jest.Mock;
  let writer: UsersAuditWriter;

  beforeEach(() => {
    recordAction = jest.fn().mockResolvedValue(undefined);
    writer = new UsersAuditWriter({
      recordAction,
    } as unknown as AuditCoreService);
  });

  it('ghi đúng một dòng audit với module users, entity users_management và ngữ cảnh request', async () => {
    await writer.write(ctx, {
      actionType: 'CREATE_USER',
      entityId: 'u1',
      afterSnapshot: { id: 'u1' },
    });

    expect(recordAction).toHaveBeenCalledTimes(1);
    expect(recordAction).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'users',
        entityType: 'users_management',
        entityId: 'u1',
        actionType: 'CREATE_USER',
        actorUserId: 'admin-1',
        requestId: 'r1',
        status: 'SUCCESS',
        afterSnapshot: { id: 'u1' },
        beforeSnapshot: null,
      }),
    );
  });

  it('lỗi ghi audit sau commit chỉ được log, không ném (tránh 500 cho thao tác đã thành công)', async () => {
    const logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    recordAction.mockRejectedValue(new Error('db down'));

    await expect(
      writer.write(ctx, { actionType: 'RESET_PASSWORD', entityId: 'u1' }),
    ).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('RESET_PASSWORD'),
      expect.any(String),
    );
    logError.mockRestore();
  });
});
