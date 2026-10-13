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
});
