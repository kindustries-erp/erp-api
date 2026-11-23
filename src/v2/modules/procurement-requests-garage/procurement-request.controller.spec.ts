import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { GarageProcurementRequestController } from './controllers/procurement-request.controller';
import { GarageProcurementRequestWorkflowController } from './controllers/procurement-request-workflow.controller';

const perm = (fn: (...args: never[]) => unknown) =>
  Reflect.getMetadata(RBAC_PERMISSIONS_KEY, fn) as Array<{
    resource: string;
    action: string;
  }>;

describe('GarageProcurementRequestController RBAC', () => {
  const c = GarageProcurementRequestController.prototype;
  const w = GarageProcurementRequestWorkflowController.prototype;

  it('approve dùng quyền riêng APPROVE, reject dùng REJECT, không dùng UPDATE', () => {
    expect(perm(w.approve as never)).toEqual([
      {
        resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
        action: ErpAction.APPROVE,
      },
    ]);
    expect(perm(w.reject as never)).toEqual([
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
    expect(perm(w.submit as never)[0].action).toBe(ErpAction.UPDATE);
    expect(perm(w.cancel as never)[0].action).toBe(ErpAction.UPDATE);
  });

  it('revert/refresh field liên kết cần quyền UPDATE', () => {
    for (const handler of [c.revertLink, c.refreshLink]) {
      expect(perm(handler as never)).toEqual([
        {
          resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
          action: ErpAction.UPDATE,
        },
      ]);
    }
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
