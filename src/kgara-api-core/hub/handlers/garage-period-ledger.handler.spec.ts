import { GaragePeriodLedgerHandler } from './garage-period-ledger.handler';

describe('GaragePeriodLedgerHandler', () => {
  const entity = (
    voucherCode: string,
    voucherType: 'RECEIPT' | 'PAYMENT',
    paymentStatus: string | null,
    amount: number,
  ) => ({
    voucherCode,
    voucherType,
    transDate: '2026-10-05',
    paymentStatus,
    paymentContent: '',
    licensePlate: '',
    partnerName: '',
    note: '',
    paymentMethod: '',
    amount,
    case: null,
  });

  it('gán nhóm, bỏ phiếu đã hủy và cộng tổng theo nhóm', async () => {
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest
        .fn()
        .mockResolvedValue([
          entity('PT1', 'RECEIPT', 'PAID', 1000),
          entity('PT2', 'RECEIPT', 'EXPECTED', 300),
          entity('PT3', 'RECEIPT', 'CANCELLED', 999),
          entity('PC1', 'PAYMENT', 'PAID', 400),
          entity('PC2', 'PAYMENT', 'APPROVED', 200),
          entity('PC3', 'PAYMENT', 'CANCELLED', 888),
        ]),
    };
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const handler = new GaragePeriodLedgerHandler(repo as any);

    const ledger = await handler.loadLedger('2026-10-01', '2026-10-31', 'CN1');

    expect(qb.andWhere).toHaveBeenCalledWith('voucher.transDate >= :dayFrom', {
      dayFrom: '2026-10-01',
    });
    expect(ledger.vouchers.map((v) => [v.voucherCode, v.category])).toEqual([
      ['PT1', 'ACTUAL_IN'],
      ['PT2', 'EXPECTED_IN'],
      ['PC1', 'ACTUAL_OUT'],
      ['PC2', 'PLANNED_OUT'],
    ]);
    expect(ledger.totals).toEqual({
      actualIn: 1000,
      expectedIn: 300,
      actualOut: 400,
      plannedOut: 200,
      net: 600,
    });
  });
});
