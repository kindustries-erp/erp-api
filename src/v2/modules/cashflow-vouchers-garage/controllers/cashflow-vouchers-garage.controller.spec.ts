import { BadRequestException } from '@nestjs/common';
import {
  RBAC_ANY_PERMISSIONS_KEY,
  RBAC_PERMISSIONS_KEY,
} from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { CashflowVouchersGarageController } from './cashflow-vouchers-garage.controller';

function make() {
  const query = {
    findPage: jest.fn().mockResolvedValue({ items: [] }),
    findColumnOptions: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockResolvedValue({}),
  };
  const insight = {
    getDashboard: jest.fn().mockResolvedValue({}),
    findPotentialDuplicates: jest.fn().mockResolvedValue({}),
  };
  return {
    controller: new CashflowVouchersGarageController(
      query as never,
      insight as never,
    ),
    query,
    insight,
  };
}

const proto = CashflowVouchersGarageController.prototype as unknown as Record<
  string,
  () => void
>;

describe('CashflowVouchersGarageController', () => {
  it('đọc cần GARAGE_CASHFLOW:READ; duplicate-check cần CREATE hoặc UPDATE', () => {
    const read = [
      { resource: ErpResource.GARAGE_CASHFLOW, action: ErpAction.READ },
    ];
    for (const name of ['list', 'columnOptions', 'dashboard', 'detail']) {
      expect(Reflect.getMetadata(RBAC_PERMISSIONS_KEY, proto[name])).toEqual(
        read,
      );
    }
    const any = Reflect.getMetadata(
      RBAC_ANY_PERMISSIONS_KEY,
      proto.duplicateCheck,
    ) as Array<{ action: string }>;
    expect(any.map((p) => p.action).sort()).toEqual(
      [ErpAction.CREATE, ErpAction.UPDATE].sort(),
    );
  });

  it('không gửi chi nhánh → service nhận undefined (mọi chi nhánh)', async () => {
    const { controller, query, insight } = make();
    await controller.list({} as never, undefined);
    expect(query.findPage.mock.calls[0][0].branchId).toBeUndefined();
    await controller.dashboard(undefined);
    expect(insight.getDashboard.mock.calls[0][0]).toBeUndefined();
    await controller.detail('id', undefined);
    expect(query.findOne).toHaveBeenCalledWith(undefined, 'id');
  });

  it('chuyển chi nhánh và kỳ xuống service', async () => {
    const { controller, query, insight } = make();
    await controller.list({ page: 2 } as never, 'b1');
    expect(query.findPage).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'b1', page: 2 }),
    );
    await controller.dashboard('b1', '2026-11-01', '2026-11-30');
    expect(insight.getDashboard).toHaveBeenCalledWith('b1', {
      from: '2026-11-01',
      to: '2026-11-30',
    });
    await controller.detail('11111111-1111-4111-8111-111111111111', 'b1');
    expect(query.findOne).toHaveBeenCalledWith(
      'b1',
      '11111111-1111-4111-8111-111111111111',
    );
  });
});
