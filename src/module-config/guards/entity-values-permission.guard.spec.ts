import { ForbiddenException } from '@nestjs/common';
import { EntityValuesPermissionGuard } from './entity-values-permission.guard';

const ctx = (entityType: string, sub: string | null = 'u1') =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        user: sub ? { sub } : undefined,
        params: { entityType },
      }),
    }),
  }) as any;

describe('EntityValuesPermissionGuard', () => {
  it('GARAGE_CASE cần garage:update', async () => {
    const rbac: any = { hasPermission: jest.fn().mockResolvedValue(true) };
    await new EntityValuesPermissionGuard(rbac).canActivate(ctx('garage_case'));
    expect(rbac.hasPermission).toHaveBeenCalledWith('u1', 'garage', 'update');
  });

  it('entityType lạ cần custom_fields:manage', async () => {
    const rbac: any = { hasPermission: jest.fn().mockResolvedValue(true) };
    await new EntityValuesPermissionGuard(rbac).canActivate(ctx('SOMETHING'));
    expect(rbac.hasPermission).toHaveBeenCalledWith(
      'u1',
      'custom_fields',
      'manage',
    );
  });

  it('không đủ quyền → 403', async () => {
    const rbac: any = { hasPermission: jest.fn().mockResolvedValue(false) };
    await expect(
      new EntityValuesPermissionGuard(rbac).canActivate(ctx('BOM')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('không có user → 403', async () => {
    const rbac: any = { hasPermission: jest.fn() };
    await expect(
      new EntityValuesPermissionGuard(rbac).canActivate(ctx('BOM', null)),
    ).rejects.toThrow(ForbiddenException);
    expect(rbac.hasPermission).not.toHaveBeenCalled();
  });
});
