import { BadRequestException } from '@nestjs/common';
import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { AUDIT_LOG_META_KEY } from '@/v2/core/audit-core/decorators/audit-log.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { CashflowVoucherCommandsController } from './cashflow-voucher-commands.controller';
import { DebtAllocationsController } from './debt-allocations.controller';
import { requireIdempotencyKey } from './flow-controller.helper';

const req = { user: { sub: 'u1' } };
const ID = '11111111-1111-4111-8111-111111111111';

function makeVoucher() {
  const flow = {
    recordVoucher: jest.fn().mockResolvedValue({}),
    updateVoucher: jest.fn().mockResolvedValue({}),
    changeVoucherStatus: jest.fn().mockResolvedValue({}),
  };
  return { c: new CashflowVoucherCommandsController(flow as never), flow };
}
function makeAlloc() {
  const flow = {
    allocate: jest.fn().mockResolvedValue({}),
    reverseAllocation: jest.fn().mockResolvedValue({}),
  };
  return { c: new DebtAllocationsController(flow as never), flow };
}
const meta = (Cls: { prototype: object }, name: string, key: string) =>
  Reflect.getMetadata(key, (Cls.prototype as Record<string, () => void>)[name]);

describe('CashflowVoucherCommandsController', () => {
  it('RBAC: tạo CREATE, sửa/duyệt UPDATE, hủy DELETE trên GARAGE_CASHFLOW; mọi lệnh ghi có audit', () => {
    const want: Record<string, ErpAction> = {
      create: ErpAction.CREATE,
      update: ErpAction.UPDATE,
      changeStatus: ErpAction.UPDATE,
      cancel: ErpAction.DELETE,
    };
    for (const [name, action] of Object.entries(want)) {
      expect(
        meta(CashflowVoucherCommandsController, name, RBAC_PERMISSIONS_KEY),
      ).toEqual([{ resource: ErpResource.GARAGE_CASHFLOW, action }]);
      expect(
        meta(CashflowVoucherCommandsController, name, AUDIT_LOG_META_KEY),
      ).toMatchObject({
        module: 'GARAGE_CASHFLOW',
      });
    }
  });

  it('thiếu chi nhánh thì 400, không chạm flow', () => {
    const { c, flow } = makeVoucher();
    const none = undefined as never;
    expect(() => c.create({} as never, none, req)).toThrow(BadRequestException);
    expect(() => c.update(ID, {}, none, req)).toThrow(BadRequestException);
    expect(() => c.changeStatus(ID, { status: 'PAID' }, none, req)).toThrow(
      BadRequestException,
    );
    expect(() => c.cancel(ID, none, req)).toThrow(BadRequestException);
    expect(flow.recordVoucher).not.toHaveBeenCalled();
  });

  it('chuyển chi nhánh và người thao tác; hủy dùng trạng thái CANCELLED', async () => {
    const { c, flow } = makeVoucher();
    await c.create({ amount: 1 } as never, 'B1', req);
    expect(flow.recordVoucher).toHaveBeenCalledWith('B1', { amount: 1 }, 'u1');
    await c.cancel(ID, 'B1', req);
    expect(flow.changeVoucherStatus).toHaveBeenCalledWith(
      'B1',
      ID,
      'CANCELLED',
      'u1',
    );
    await c.changeStatus(ID, { status: 'PAID' }, 'B1', {
      user: undefined,
    } as never);
    expect(flow.changeVoucherStatus).toHaveBeenLastCalledWith(
      'B1',
      ID,
      'PAID',
      null,
    );
  });
});

describe('DebtAllocationsController', () => {
  it('RBAC GARAGE_DEBTS:UPDATE và audit cho phân bổ và đảo', () => {
    for (const name of ['allocate', 'reverse']) {
      expect(
        meta(DebtAllocationsController, name, RBAC_PERMISSIONS_KEY),
      ).toEqual([
        { resource: ErpResource.GARAGE_DEBTS, action: ErpAction.UPDATE },
      ]);
      expect(
        meta(DebtAllocationsController, name, AUDIT_LOG_META_KEY),
      ).toMatchObject({ module: 'GARAGE_DEBTS' });
    }
  });

  it('bắt buộc Idempotency-Key và chi nhánh, không chạm flow khi thiếu', () => {
    const { c, flow } = makeAlloc();
    expect(() => c.allocate({} as never, undefined, 'B1', req)).toThrow(
      BadRequestException,
    );
    expect(() => c.allocate({} as never, 'k', undefined as never, req)).toThrow(
      BadRequestException,
    );
    expect(() => c.reverse(ID, '  ', 'B1', req)).toThrow(BadRequestException);
    expect(flow.allocate).not.toHaveBeenCalled();
    expect(flow.reverseAllocation).not.toHaveBeenCalled();
  });

  it('chuyển khóa, chi nhánh, người thao tác xuống flow', async () => {
    const { c, flow } = makeAlloc();
    await c.allocate({ debtId: ID, amount: 5 } as never, ' key1 ', 'B1', req);
    expect(flow.allocate).toHaveBeenCalledWith(
      'B1',
      { debtId: ID, amount: 5 },
      'key1',
      'u1',
    );
    await c.reverse(ID, 'r1', 'B1', req);
    expect(flow.reverseAllocation).toHaveBeenCalledWith('B1', ID, 'r1', 'u1');
  });

  it('requireIdempotencyKey: tối đa 128 ký tự', () => {
    expect(requireIdempotencyKey('a'.repeat(128))).toHaveLength(128);
    expect(() => requireIdempotencyKey('a'.repeat(129))).toThrow(
      BadRequestException,
    );
  });
});
