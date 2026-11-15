import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditCoreController } from './audit-core.controller';
import { AuditCoreService } from './audit-core.service';

describe('AuditCoreController (V1)', () => {
  const svc = {
    findAll: jest.fn().mockResolvedValue({ data: [] }),
    getColumnOptions: jest.fn().mockResolvedValue({ items: [] }),
    getEntityTimeline: jest.fn().mockResolvedValue([]),
  };
  const ctrl = new AuditCoreController(svc as unknown as AuditCoreService);

  it('giữ route audit-logs-core và chỉ JwtAuthGuard', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AuditCoreController)).toBe(
      'audit-logs-core',
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, AuditCoreController)).toEqual([
      JwtAuthGuard,
    ]);
  });

  it('column-options parse page/pageSize, rơi về mặc định khi sai', async () => {
    await ctrl.getColumnOptions('module', 's', 'x', '0', 'f');
    expect(svc.getColumnOptions).toHaveBeenCalledWith(
      'module',
      's',
      1,
      20,
      'f',
    );
    await ctrl.getColumnOptions('module', undefined, '3', '50');
    expect(svc.getColumnOptions).toHaveBeenLastCalledWith(
      'module',
      undefined,
      3,
      50,
      undefined,
    );
  });

  it('timeline và list chuyển thẳng sang service', async () => {
    expect(await ctrl.getEntityTimeline('t', '1')).toEqual([]);
    expect(svc.getEntityTimeline).toHaveBeenCalledWith('t', '1');
    await ctrl.findAll({});
    expect(svc.findAll).toHaveBeenCalledWith({});
  });
});
