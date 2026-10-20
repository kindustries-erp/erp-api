import { GarageCaseLedgerHandler } from './garage-case-ledger.handler';

describe('GarageCaseLedgerHandler', () => {
  const build = (rows: unknown[]) => {
    const qb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    return { qb, handler: new GarageCaseLedgerHandler(repo as any) };
  };

  it('cộng dự thu và dự chi theo phiếu dịch vụ; bỏ phiếu đã hủy và đã thu/đã chi', async () => {
    const { handler } = build([
      {
        caseId: 'c1',
        voucherType: 'RECEIPT',
        paymentStatus: 'EXPECTED',
        amount: 300,
      },
      {
        caseId: 'c1',
        voucherType: 'PAYMENT',
        paymentStatus: 'PENDING',
        amount: 100,
      },
      {
        caseId: 'c1',
        voucherType: 'PAYMENT',
        paymentStatus: 'APPROVED',
        amount: 50,
      },
      {
        caseId: 'c1',
        voucherType: 'PAYMENT',
        paymentStatus: 'PAID',
        amount: 999,
      },
      {
        caseId: 'c1',
        voucherType: 'RECEIPT',
        paymentStatus: 'CANCELLED',
        amount: 888,
      },
      {
        caseId: 'c2',
        voucherType: 'RECEIPT',
        paymentStatus: 'PAID',
        amount: 500,
      },
    ]);

    expect(await handler.loadCaseLedger(['c1', 'c2'])).toEqual({
      c1: { expectedIn: 300, plannedOut: 150 },
    });
  });

  it('chia lô theo case id, không gọi truy vấn khi danh sách rỗng', async () => {
    const { qb, handler } = build([]);
    expect(await handler.loadCaseLedger([])).toEqual({});
    expect(qb.getRawMany).not.toHaveBeenCalled();

    const many = Array.from({ length: 4500 }, (_, i) => `c${i}`);
    await handler.loadCaseLedger(many);
    expect(qb.getRawMany).toHaveBeenCalledTimes(3);
  });
});
