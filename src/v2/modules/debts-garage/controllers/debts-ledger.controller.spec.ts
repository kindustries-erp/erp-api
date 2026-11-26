import { BadRequestException } from '@nestjs/common';
import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { DebtsLedgerController } from './debts-ledger.controller';

function make() {
  const ledger = {
    findPage: jest.fn().mockResolvedValue({ items: [] }),
    findAllocations: jest.fn().mockResolvedValue([]),
  };
  const parties = { assignParty: jest.fn().mockResolvedValue({}) };
  const controller = new DebtsLedgerController(
    ledger as never,
    parties as never,
  );
  return { controller, ledger, parties };
}

const perm = (name: string) =>
  Reflect.getMetadata(
    RBAC_PERMISSIONS_KEY,
    (DebtsLedgerController.prototype as unknown as Record<string, () => void>)[
      name
    ],
  );

describe('DebtsLedgerController', () => {
  it('RBAC: đọc cần GARAGE_DEBTS:READ, gán hãng cần GARAGE_DEBTS:UPDATE', () => {
    const r = [{ resource: ErpResource.GARAGE_DEBTS, action: ErpAction.READ }];
    expect(perm('list')).toEqual(r);
    expect(perm('allocations')).toEqual(r);
    expect(perm('assignParty')).toEqual([
      { resource: ErpResource.GARAGE_DEBTS, action: ErpAction.UPDATE },
    ]);
  });

  it('không gửi chi nhánh → service nhận undefined', async () => {
    const { controller, ledger, parties } = make();
    await controller.list({} as never, undefined);
    expect(ledger.findPage.mock.calls[0][0].branchId).toBeUndefined();
    await controller.assignParty('id', { partyCode: 'X' }, undefined);
    expect(parties.assignParty).toHaveBeenCalledWith(undefined, 'id', {
      partyCode: 'X',
    });
  });

  it('chuyển chi nhánh từ header xuống service', async () => {
    const { controller, ledger, parties } = make();
    await controller.list({ page: 1 } as never, 'b1');
    expect(ledger.findPage).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'b1', page: 1 }),
    );
    await controller.assignParty('d1', { partyCode: 'PVI' }, 'b1');
    expect(parties.assignParty).toHaveBeenCalledWith('b1', 'd1', {
      partyCode: 'PVI',
    });
  });
});
