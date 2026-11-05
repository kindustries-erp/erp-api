import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac';
import { GarageProcurementRequestController } from './controllers/procurement-request.controller';

const perm = (fn: (...args: never[]) => unknown) =>
  Reflect.getMetadata(RBAC_PERMISSIONS_KEY, fn) as Array<{
    resource: string;
    action: string;
  }>;

describe('GarageProcurementRequestController RBAC', () => {
  const c = GarageProcurementRequestController.prototype;

  it('approve dùng quyền riêng APPROVE, reject dùng REJECT, không dùng UPDATE', () => {
    expect(perm(c.approve as never)).toEqual([
      {
        resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
        action: ErpAction.APPROVE,
      },
    ]);
    expect(perm(c.reject as never)).toEqual([
      {
        resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
        action: ErpAction.REJECT,
      },
    ]);
  });

  it('tạo cần CREATE, đọc cần READ, gửi và hủy cần UPDATE', () => {
    expect(perm(c.create as never)[0].action).toBe(ErpAction.CREATE);
    expect(perm(c.list as never)[0].action).toBe(ErpAction.READ);
    expect(perm(c.columnOptions as never)[0].action).toBe(ErpAction.READ);
    expect(perm(c.findOne as never)[0].action).toBe(ErpAction.READ);
    expect(perm(c.submit as never)[0].action).toBe(ErpAction.UPDATE);
    expect(perm(c.cancel as never)[0].action).toBe(ErpAction.UPDATE);
  });

  it('nhật ký duyệt và bản nháp PO chỉ cần READ', () => {
    expect(perm(c.approvalEvents as never)).toEqual([
      {
        resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
        action: ErpAction.READ,
      },
    ]);
    expect(perm(c.poDraft as never)).toEqual([
      {
        resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
        action: ErpAction.READ,
      },
    ]);
  });
});
