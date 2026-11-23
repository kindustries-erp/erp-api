import { ErpAction, ErpResource } from '../enums';
import type { RbacPermissionGrant } from '../contracts/rbac-access.contract';
import { RbacAccessService } from './rbac-access.service';

class StubRbacAccessService extends RbacAccessService {
  constructor(private readonly grants: RbacPermissionGrant[]) {
    super();
  }
  getUserPermissions(): Promise<RbacPermissionGrant[]> {
    return Promise.resolve(this.grants);
  }
  getUserRoleNames(): Promise<string[]> {
    return Promise.resolve([]);
  }
  findUserIdsWithPermissions(): Promise<string[]> {
    return Promise.resolve([]);
  }
}

describe('RbacAccessService (logic thuần)', () => {
  const read = {
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    action: ErpAction.READ,
  };
  const update = {
    resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
    action: ErpAction.UPDATE,
  };

  it('hasPermission khớp đúng cặp resource:action', async () => {
    const svc = new StubRbacAccessService([read]);
    await expect(
      svc.hasPermission('u', read.resource, read.action),
    ).resolves.toBe(true);
    await expect(
      svc.hasPermission('u', update.resource, update.action),
    ).resolves.toBe(false);
  });

  it('quyền SUPER_ADMIN và action ALL khớp mọi yêu cầu', async () => {
    const svc = new StubRbacAccessService([
      { resource: ErpResource.SUPER_ADMIN, action: ErpAction.ALL },
    ]);
    await expect(svc.hasPermission('u', 'bat-ky', 'bat-ky')).resolves.toBe(
      true,
    );
  });

  it('hasAnyPermission / hasAllPermissions: rỗng là true, any và all khác nhau', async () => {
    const svc = new StubRbacAccessService([read]);
    await expect(svc.hasAnyPermission('u', [])).resolves.toBe(true);
    await expect(svc.hasAllPermissions('u', [])).resolves.toBe(true);
    await expect(svc.hasAnyPermission('u', [read, update])).resolves.toBe(true);
    await expect(svc.hasAllPermissions('u', [read, update])).resolves.toBe(
      false,
    );
  });
});
