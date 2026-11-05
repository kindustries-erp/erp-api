import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac';
import { GarageProcurementOrderController } from './controllers/procurement-order.controller';

const perm = (fn: (...args: never[]) => unknown) =>
  Reflect.getMetadata(RBAC_PERMISSIONS_KEY, fn) as Array<{
    resource: string;
    action: string;
  }>;

describe('GarageProcurementOrderController RBAC', () => {
  const c = GarageProcurementOrderController.prototype;

  it('duyệt và từ chối dùng quyền riêng, không gộp vào UPDATE', () => {
    expect(perm(c.approve as never)).toEqual([
      {
        resource: ErpResource.GARAGE_PROCUREMENT_ORDERS,
        action: ErpAction.APPROVE,
      },
    ]);
    expect(perm(c.reject as never)).toEqual([
      {
        resource: ErpResource.GARAGE_PROCUREMENT_ORDERS,
        action: ErpAction.REJECT,
      },
    ]);
  });

  it('nghiệm thu và hủy nghiệm thu cần UPDATE trên đúng resource PO', () => {
    expect(perm(c.accept as never)[0]).toMatchObject({
      resource: ErpResource.GARAGE_PROCUREMENT_ORDERS,
      action: ErpAction.UPDATE,
    });
    expect(perm(c.voidAcceptance as never)[0].action).toBe(ErpAction.UPDATE);
  });

  it('xóa mềm dùng DELETE, xóa cứng dùng PURGE trên cùng resource PO', () => {
    expect(perm(c.remove as never)).toEqual([
      {
        resource: ErpResource.GARAGE_PROCUREMENT_ORDERS,
        action: ErpAction.DELETE,
      },
    ]);
    expect(perm(c.hardRemove as never)).toEqual([
      {
        resource: ErpResource.GARAGE_PROCUREMENT_ORDERS,
        action: ErpAction.PURGE,
      },
    ]);
  });
});
