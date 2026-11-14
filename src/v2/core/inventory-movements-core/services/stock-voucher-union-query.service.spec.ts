import { BadRequestException } from '@nestjs/common';
import {
  StockVoucherUnionQueryService,
  StockVoucherUnionSource,
} from './stock-voucher-union-query.service';

const cols = {
  id: 'id',
  voucherNo: 'voucher_no',
  voucherDate: 'voucher_date',
  status: 'status',
  partnerName: 'partner_name',
  branchId: 'branch_id',
  totalAmount: 'total_amount',
  remarks: 'remarks',
  createdAt: 'created_at',
};
const sources: StockVoucherUnionSource[] = [
  { type: 'ISSUE', table: 'garage_stock_issues', columns: cols },
  {
    type: 'PURCHASE_RECEIPT',
    table: 'goods_receipts_garage',
    columns: { ...cols, voucherNo: 'receipt_no', partnerName: 'supplier_name' },
  },
];

function build(query: jest.Mock) {
  return new StockVoucherUnionQueryService({ query } as never, sources);
}

describe('StockVoucherUnionQueryService', () => {
  it('rejects unsafe identifiers at construction', () => {
    expect(
      () =>
        new StockVoucherUnionQueryService({} as never, [
          { type: 'ISSUE', table: 'a; DROP TABLE x', columns: cols },
        ]),
    ).toThrow();
  });

  it('builds a UNION ALL list with parameterized filters and pagination', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([
        {
          id: '1',
          type: 'ISSUE',
          voucherNo: 'PX1',
          voucherDate: new Date(),
          status: 'POSTED',
          partnerName: null,
          branchId: null,
          totalAmount: '12.5',
          remarks: null,
          createdAt: new Date(),
        },
      ])
      .mockResolvedValueOnce([{ type: 'ISSUE', count: 3 }]);
    const result = await build(query).findAll({
      page: 2,
      pageSize: 10,
      type: 'ISSUE',
      status: 'POSTED',
      search: '50%',
      sort: '-totalAmount;DROP',
    });
    const [sql, params] = query.mock.calls[1];
    expect(sql).toContain('UNION ALL');
    expect(sql).toContain('goods_receipts_garage');
    expect(sql).not.toContain('DROP');
    expect(params).toEqual(['ISSUE', 'POSTED', '%50\\%%', 10, 10]);
    expect(result.items[0].totalAmount).toBe(12.5);
    expect(result.pagination.total).toBe(1);
  });

  it('counts vouchers per type ignoring the type filter, zero-filled', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ type: 'PURCHASE_RECEIPT', count: 4 }]);
    const result = await build(query).findAll({
      type: 'ISSUE',
      status: 'POSTED',
    });
    const [countSql, countParams] = query.mock.calls[2];
    expect(countSql).toContain('GROUP BY u."type"');
    expect(countParams).toEqual(['POSTED']);
    expect(result.extraData.typeCounts).toEqual({
      PURCHASE_RECEIPT: 4,
      ISSUE: 0,
    });
  });

  it('rejects unknown type and invalid column_filters', async () => {
    const svc = build(jest.fn());
    await expect(svc.findAll({ type: 'NOPE' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(svc.findAll({ column_filters: '{' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('computes totalAmount summaries', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ v: '100' }])
      .mockResolvedValueOnce([{ v: '40' }])
      .mockResolvedValueOnce([{ v: '70' }])
      .mockResolvedValueOnce([]);
    const result = await build(query).findAll({
      page: 2,
      pageSize: 5,
      summary_keys: 'totalAmount',
    });
    expect(result.summaries.totalAmount).toEqual({
      total: 100,
      pageSubtotal: 40,
      cumulative: 70,
    });
  });

  it('serves column options only for whitelisted columns', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ value: 'POSTED' }]);
    const svc = build(query);
    const out = await svc.findColumnOptions({ column: 'status' });
    expect(out.items).toEqual([{ label: 'POSTED', value: 'POSTED' }]);
    await expect(
      svc.findColumnOptions({ column: 'remarks' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
