import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { AuditLogController } from './audit-log.controller';

describe('AuditLogController', () => {
  it('route gốc là api/v2/audit-logs, chỉ JwtAuthGuard (giữ hành vi V1)', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AuditLogController)).toBe(
      'api/v2/audit-logs',
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, AuditLogController)).toEqual([
      JwtAuthGuard,
    ]);
  });

  it('route tĩnh column-options khai báo trước route có tham số', () => {
    const proto = AuditLogController.prototype;
    const paths = ['list', 'columnOptions', 'timeline'].map((name) =>
      Reflect.getMetadata(
        PATH_METADATA,
        proto[name as keyof AuditLogController],
      ),
    );
    expect(paths).toEqual([
      '/',
      'column-options',
      ':entityType/:entityId/timeline',
    ]);
  });
});
