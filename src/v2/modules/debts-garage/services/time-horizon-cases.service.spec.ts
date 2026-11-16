import type { DataSource } from 'typeorm';
import { TimeHorizonCasesService } from './time-horizon-cases.service';

function makeService() {
  const query = jest.fn((sql: string, _params?: unknown[]) => {
    if (sql.includes('COUNT(c.id)::int AS cnt') && sql.includes('AS total')) {
      return Promise.resolve([
        { total: '300', paid: '100', balance: '200', cnt: 45 },
      ]);
    }
    if (sql.includes('GROUP BY 1')) {
      return Promise.resolve([
        { code: 'KH1', name: 'An', balance: '50', cnt: 2 },
      ]);
    }
    return Promise.resolve([
      {
        id: 'c1',
        soChungTu: 'PS1',
        totalAmount: '300',
        paidAmount: '100',
        balanceAmount: '200',
        agingDays: 5,
        status: 'Kết thúc',
        description: '',
      },
    ]);
  });
  const service = new TimeHorizonCasesService({
    query,
  } as unknown as DataSource);
  return { service, query };
}

describe('TimeHorizonCasesService', () => {
  it('trả items, pagination và summary trong extraData', async () => {
    const { service } = makeService();

    const res = await service.findCases({
      horizon: 'nextMonthDue',
      branchId: 'b1',
      page: 2,
      pageSize: 20,
    });

    expect(res.items[0]).toMatchObject({ id: 'c1', balanceAmount: 200 });
    expect(res.pagination).toMatchObject({ page: 2, pageSize: 20, total: 45 });
    expect(res.extraData.summary).toMatchObject({
      horizonLabel: 'Trong hạn chuẩn (≤ 30 ngày)',
      receivableAmount: 200,
    });
    expect(res.extraData.summary.topPartners[0].sharePercentage).toBe(25);
  });

  it('chi nhánh luôn là tham số, sort lạ rơi về agingDays, pageSize bị kẹp', async () => {
    const { service, query } = makeService();

    await service.findCases({
      horizon: 'nextWeekDue',
      branchId: 'b1',
      sortBy: 'x; DROP TABLE',
      pageSize: 9999,
    });

    const dataCall = query.mock.calls.find(([sql]) =>
      String(sql).includes('ORDER BY'),
    );
    expect(dataCall?.[1]).toContain('b1');
    expect(String(dataCall?.[0])).toContain('ORDER BY "agingDays" DESC');
    expect(String(dataCall?.[0])).toContain('LIMIT 200');
    expect(String(dataCall?.[0])).not.toContain('DROP');
  });
});
