import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { ErpProcurementOrderController } from './controllers/procurement-order.controller';

const perm = (fn: (...args: never[]) => unknown) =>
  Reflect.getMetadata(RBAC_PERMISSIONS_KEY, fn) as Array<{
    resource: string;
    action: string;
  }>;

describe('ErpProcurementOrderController RBAC', () => {
  const c = ErpProcurementOrderController.prototype;

  it('duyệt và từ chối dùng quyền riêng, không gộp vào UPDATE', () => {
    expect(perm(c.approve as never)).toEqual([
      { resource: ErpResource.PROCUREMENT_ORDERS, action: ErpAction.APPROVE },
    ]);
    expect(perm(c.reject as never)).toEqual([
      { resource: ErpResource.PROCUREMENT_ORDERS, action: ErpAction.REJECT },
    ]);
  });

  it('nhận hàng và nghiệm thu đều cần UPDATE trên đúng resource PO', () => {
    expect(perm(c.receive as never)[0]).toMatchObject({
      resource: ErpResource.PROCUREMENT_ORDERS,
      action: ErpAction.UPDATE,
    });
    expect(perm(c.accept as never)[0]).toMatchObject({
      resource: ErpResource.PROCUREMENT_ORDERS,
      action: ErpAction.UPDATE,
    });
    expect(perm(c.voidAcceptance as never)[0].action).toBe(ErpAction.UPDATE);
  });
});
