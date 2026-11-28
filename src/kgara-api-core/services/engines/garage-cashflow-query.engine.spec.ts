import { GarageCashflowQueryEngine } from './garage-cashflow-query.engine';

function createMockQueryBuilder(rows: any[] = [], total: number = rows.length) {
  const qb: any = {
    leftJoin: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
    getRawOne: jest.fn().mockResolvedValue({ cnt: String(total) }),
    getRawMany: jest.fn().mockResolvedValue([]),
    expressionMap: {
      groupBys: [],
      selects: [],
      orderBys: {},
    },
  };
  return qb;
}

describe('GarageCashflowQueryEngine', () => {
  let engine: GarageCashflowQueryEngine;
  let mockRepo: any;
  let qb: any;

  beforeEach(() => {
    qb = createMockQueryBuilder([
      {
        id: 'voucher-1',
        voucherCode: 'PT-GARA-261012-001',
        voucherType: 'RECEIPT',
        amount: 2000000,
        transDate: '2026-10-12',
        createdAt: new Date('2026-10-12T10:00:00Z'),
        updatedAt: new Date('2026-10-12T10:00:00Z'),
      },
    ]);

    mockRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      manager: {
        query: jest
          .fn()
          .mockResolvedValue([{ voucher_id: 'voucher-1', payer_type: 'BH' }]),
      },
    };

    engine = new GarageCashflowQueryEngine(mockRepo);
  });

  describe('listVouchers - Default Sorting', () => {
    it('applies transDate DESC as primary order by when sorts is undefined', async () => {
      const result = await engine.listVouchers({});

      expect(qb.orderBy).toHaveBeenCalledWith('voucher.transDate', 'DESC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('voucher.createdAt', 'DESC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('voucher.voucherCode', 'DESC');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].payerType).toBe('BH');
      expect(result.total).toBe(1);
    });

    it('applies transDate DESC when sorts is empty string', async () => {
      await engine.listVouchers({ sorts: '' });

      expect(qb.orderBy).toHaveBeenCalledWith('voucher.transDate', 'DESC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('voucher.createdAt', 'DESC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('voucher.voucherCode', 'DESC');
    });
  });

  describe('listVouchers - Custom Sorting & Tie-Breakers', () => {
    it('applies custom sort by -amount and preserves secondary tie-breakers', async () => {
      await engine.listVouchers({ sorts: '-amount' });

      expect(qb.addOrderBy).toHaveBeenCalledWith('voucher.amount', 'DESC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('voucher.createdAt', 'DESC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('voucher.voucherCode', 'DESC');
    });

    it('applies custom sort by transDate ASC with propertyPath mapping', async () => {
      await engine.listVouchers({ sorts: 'transDate' });

      expect(qb.addOrderBy).toHaveBeenCalledWith('voucher.transDate', 'ASC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('voucher.createdAt', 'DESC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('voucher.voucherCode', 'DESC');
    });

    it('maps partnerName to entity propertyPath voucher.partnerName', async () => {
      await engine.listVouchers({ sorts: 'partnerName' });

      expect(qb.addOrderBy).toHaveBeenCalledWith('voucher.partnerName', 'ASC');
    });

    it('maps licensePlate to entity propertyPath voucher.licensePlate', async () => {
      await engine.listVouchers({ sorts: '-licensePlate' });

      expect(qb.addOrderBy).toHaveBeenCalledWith(
        'voucher.licensePlate',
        'DESC',
      );
    });

    it('handles sorts[] as string (e.g. sorts[]=-transDate)', async () => {
      await engine.listVouchers({ 'sorts[]': '-transDate' });

      expect(qb.addOrderBy).toHaveBeenCalledWith('voucher.transDate', 'DESC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('voucher.createdAt', 'DESC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('voucher.voucherCode', 'DESC');
    });

    it('handles sorts[] as array (e.g. sorts[]=["-amount", "transDate"])', async () => {
      await engine.listVouchers({ 'sorts[]': ['-amount', 'transDate'] });

      expect(qb.addOrderBy).toHaveBeenCalledWith('voucher.amount', 'DESC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('voucher.transDate', 'ASC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('voucher.createdAt', 'DESC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('voucher.voucherCode', 'DESC');
    });
  });

  describe('listVouchers - Pagination & Zero-Entity Leaking', () => {
    it('computes correct offset and limit', async () => {
      await engine.listVouchers({ page: 3, pageSize: 50 });

      expect(qb.skip).toHaveBeenCalledWith(100);
      expect(qb.take).toHaveBeenCalledWith(50);
    });

    it('returns DTO mapped data without raw entity leaking', async () => {
      const result = await engine.listVouchers({});

      expect(result.data[0]).toHaveProperty(
        'voucherCode',
        'PT-GARA-261012-001',
      );
      expect(result.data[0]).toHaveProperty('amount', 2000000);
      expect(result.data[0]).toHaveProperty('transDate', '2026-10-12');
    });
  });

  describe('listVouchers - Tab & Forecast Filtering', () => {
    it('applies forecast filter when tab is forecast', async () => {
      await engine.listVouchers({ tab: 'forecast' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        "( (voucher.voucher_type = 'RECEIPT' AND voucher.payment_status = 'EXPECTED') OR (voucher.voucher_type = 'PAYMENT' AND voucher.payment_status IN ('PENDING', 'APPROVED')) )",
      );
    });

    it('applies actual filter when tab is vouchers', async () => {
      await engine.listVouchers({ tab: 'vouchers' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        "( (voucher.voucher_type = 'RECEIPT' AND (voucher.payment_status IS NULL OR voucher.payment_status NOT IN ('EXPECTED', 'CANCELLED'))) OR (voucher.voucher_type = 'PAYMENT' AND (voucher.payment_status IS NULL OR voucher.payment_status = 'PAID')) )",
      );
    });

    it('does not apply tab filter when tab is all or undefined', async () => {
      await engine.listVouchers({});

      const calls = qb.andWhere.mock.calls;
      const hasTabClause = calls.some((c: any[]) => c[0]?.includes('EXPECTED'));
      expect(hasTabClause).toBe(false);
    });
  });

  describe('listVouchers - amount columns thu/chi with __BLANK__', () => {
    const whereSql = (): string[] =>
      qb.andWhere.mock.calls.map((c: any[]) => String(c[0]));

    beforeEach(() => qb.andWhere.mockClear());

    it('blank-only Tiền vào means PAYMENT vouchers', async () => {
      await engine.listVouchers({
        column_filters: JSON.stringify({ thu: ['__BLANK__'] }),
      });
      const clause = whereSql().find((s) => s.includes('<> '));
      expect(clause).toContain("voucher.voucher_type <> 'RECEIPT'");
      expect(clause).not.toContain('amount IN');
    });

    it('blank-only Tiền ra means RECEIPT vouchers', async () => {
      await engine.listVouchers({
        column_filters: JSON.stringify({ chi: ['__BLANK__'] }),
      });
      const clause = whereSql().find((s) => s.includes('<> '));
      expect(clause).toContain("voucher.voucher_type <> 'PAYMENT'");
    });

    it('combines blank with specific amounts using OR', async () => {
      await engine.listVouchers({
        column_filters: JSON.stringify({ thu: ['__BLANK__', '1000', '2000'] }),
      });
      const clause = whereSql().find((s) => s.includes('IN'));
      expect(clause).toContain(
        "voucher.voucher_type = 'RECEIPT' AND voucher.amount IN",
      );
      expect(clause).toContain("voucher.voucher_type <> 'RECEIPT'");
      expect(clause).toContain(' OR ');
      const params = qb.andWhere.mock.calls.find((c: any[]) =>
        String(c[0]).includes('IN'),
      )[1];
      expect(params).toEqual({ fthuAmounts: [1000, 2000] });
    });

    it('keeps range a..b restricted to the column voucher type', async () => {
      await engine.listVouchers({
        column_filters: JSON.stringify({ chi: ['100..500'] }),
      });
      const clause = whereSql().find((s) => s.includes('>='));
      expect(clause).toContain("voucher.voucher_type = 'PAYMENT'");
      expect(clause).toContain('voucher.amount <= :fchiTo');
      expect(clause).not.toContain('<>');
    });
  });

  describe('listVouchers - column filters (__ALL_MATCHING__ & paymentStatus)', () => {
    const whereSql = (): string[] =>
      qb.andWhere.mock.calls.map((c: any[]) => String(c[0]));

    it('drops __ALL_MATCHING__ sentinel so it never reaches SQL', async () => {
      await engine.listVouchers({
        column_filters: JSON.stringify({
          paymentStatus: ['__ALL_MATCHING__', ''],
        }),
      });

      expect(whereSql().some((s) => s.includes('__ALL_MATCHING__'))).toBe(
        false,
      );
      expect(JSON.stringify(qb.andWhere.mock.calls)).not.toContain(
        '__ALL_MATCHING__',
      );
    });

    it('maps forecast statuses (EXPECTED, PENDING, APPROVED) per voucher type', async () => {
      await engine.listVouchers({
        column_filters: JSON.stringify({
          paymentStatus: ['EXPECTED', 'PENDING', 'APPROVED'],
        }),
      });

      const clause = whereSql().find((s) => s.includes("'EXPECTED'"));
      expect(clause).toBeDefined();
      expect(clause).toContain("voucher.payment_status = 'PENDING'");
      expect(clause).toContain("voucher.payment_status = 'APPROVED'");
      expect(clause).toContain("voucher.voucher_type = 'PAYMENT'");
    });

    it('maps voucher statuses RECEIPT_PAID and PAYMENT_PAID separately', async () => {
      await engine.listVouchers({
        column_filters: JSON.stringify({
          paymentStatus: ['RECEIPT_PAID'],
        }),
      });
      const receiptOnly = whereSql().find((s) => s.includes('NOT IN'));
      expect(receiptOnly).toContain("voucher.voucher_type = 'RECEIPT'");
      expect(receiptOnly).not.toContain("voucher.payment_status = 'PAID'");

      qb.andWhere.mockClear();
      await engine.listVouchers({
        column_filters: JSON.stringify({ paymentStatus: ['PAYMENT_PAID'] }),
      });
      const paymentOnly = whereSql().find((s) =>
        s.includes("voucher.payment_status = 'PAID'"),
      );
      expect(paymentOnly).toContain("voucher.voucher_type = 'PAYMENT'");
    });

    it('keeps legacy PAID value working as both paid groups', async () => {
      await engine.listVouchers({
        column_filters: JSON.stringify({ paymentStatus: ['PAID'] }),
      });

      const clause = whereSql().find((s) => s.includes('NOT IN'));
      expect(clause).toContain("voucher.voucher_type = 'PAYMENT'");
      expect(clause).toContain("voucher.payment_status = 'PAID'");
    });
  });
});
