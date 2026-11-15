import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditWriterService } from './audit-writer.service';

function setup(enabled: 'true' | 'false' = 'true') {
  const execute = jest.fn().mockResolvedValue({});
  const values = jest.fn().mockReturnValue({ execute });
  const into = jest.fn().mockReturnValue({ values });
  const insert = jest.fn().mockReturnValue({ into });
  const repository = {
    createQueryBuilder: jest.fn().mockReturnValue({ insert }),
  } as unknown as Repository<AuditLog>;
  const config = {
    get: jest.fn((key: string) =>
      key === 'ENABLE_AUDIT_LOG' ? enabled : undefined,
    ),
  } as unknown as ConfigService;
  const writer = new AuditWriterService(repository, config);
  return { writer, execute, values, into };
}

describe('AuditWriterService', () => {
  it('đệm trong RAM rồi insert vào bảng audit_logs khi flush', async () => {
    const { writer, execute, values, into } = setup();
    expect(writer.isEnabled).toBe(true);
    await writer.recordAction({
      actionType: 'CREATE',
      module: 'users',
      actorEmail: 'test@liouni.com',
      afterSnapshot: { password: 'secretPassword', name: 'User 1' },
    });
    expect(execute).not.toHaveBeenCalled();

    await writer.flush();

    expect(into).toHaveBeenCalledWith(AuditLog);
    expect(execute).toHaveBeenCalledTimes(1);
    const rows = values.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0].afterSnapshot).toEqual({
      password: '[REDACTED]',
      name: 'User 1',
    });
  });

  it('không đệm và không ghi khi ENABLE_AUDIT_LOG=false', async () => {
    const { writer, execute } = setup('false');
    expect(writer.isEnabled).toBe(false);
    await writer.recordAction({ actionType: 'CREATE', module: 'users' });
    await writer.flush();
    expect(execute).not.toHaveBeenCalled();
  });
});
