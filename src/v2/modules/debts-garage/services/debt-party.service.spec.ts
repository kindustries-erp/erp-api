import { ConflictException, NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DebtPartyService } from './debt-party.service';

type Row = Record<string, any>;

function setup(row: Row | null) {
  const save = jest.fn(async (r: Row) => r);
  const repo = {
    save,
    createQueryBuilder: () => ({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: async () => row,
    }),
  };
  const ds = {
    transaction: (cb: (m: unknown) => unknown) =>
      cb({ getRepository: () => repo }),
  } as unknown as DataSource;
  return { service: new DebtPartyService(ds), save };
}

const debt = (over: Row = {}) => ({
  id: 'd1',
  branchExternalId: 'b1',
  direction: 'RECEIVABLE',
  partyType: 'INSURER',
  partyCode: 'BH_CHUA_XAC_DINH',
  originalAmount: '300.00',
  settledAmount: '0.00',
  balanceAmount: '300.00',
  status: 'OPEN',
  excluded: false,
  origin: 'SYNC',
  version: 1,
  ...over,
});

describe('DebtPartyService', () => {
  it('gán hãng bảo hiểm, không đụng số tiền', async () => {
    const { service, save } = setup(debt());
    const out = await service.assignParty('b1', 'd1', {
      partyCode: ' PVI ',
      partyName: 'Bảo hiểm PVI',
      partnerId: '3f1c8d52-6b0a-4c3e-9d4a-1a2b3c4d5e6f',
    });
    expect(out).toMatchObject({
      partyCode: 'PVI',
      partyName: 'Bảo hiểm PVI',
      originalAmount: 300,
      balanceAmount: 300,
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('không có dòng (hoặc khác chi nhánh) thì 404', async () => {
    const { service } = setup(null);
    await expect(
      service.assignParty('b1', 'd1', { partyCode: 'X' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('không gán cho khách hàng, không gán cho dòng đã VOID', async () => {
    await expect(
      setup(debt({ partyType: 'CUSTOMER' })).service.assignParty('b1', 'd1', {
        partyCode: 'X',
      }),
    ).rejects.toThrow(ConflictException);
    await expect(
      setup(debt({ status: 'VOID' })).service.assignParty('b1', 'd1', {
        partyCode: 'X',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
