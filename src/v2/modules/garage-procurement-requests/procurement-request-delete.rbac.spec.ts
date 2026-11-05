import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction } from '@/rbac-core/enums/erp-action.enum';
import { ErpResource } from '@/rbac-core/enums/erp-resource.enum';
import { GarageProcurementRequestController } from './controllers/procurement-request.controller';

const perm = (fn: (...args: never[]) => unknown) =>
  Reflect.getMetadata(RBAC_PERMISSIONS_KEY, fn) as Array<{
    resource: string;
    action: string;
  }>;

describe('GarageProcurementRequestController delete RBAC', () => {
  const c = GarageProcurementRequestController.prototype;

  it('xóa mềm đề nghị nháp dùng DELETE, xóa cứng dùng PURGE', () => {
    expect(perm(c.softDelete as never)).toEqual([
      {
        resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
        action: ErpAction.DELETE,
      },
    ]);
    expect(perm(c.hardDelete as never)).toEqual([
      {
        resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
        action: ErpAction.PURGE,
      },
    ]);
  });
});
