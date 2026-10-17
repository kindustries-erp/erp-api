import { GaragePeriodTimelineQueries } from './garage-period-timeline-queries.service';

describe('GaragePeriodTimelineQueries', () => {
  const query = jest.fn();
  const caseRepo = { manager: { query } };
  let service: GaragePeriodTimelineQueries;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GaragePeriodTimelineQueries(caseRepo as any);
  });

  describe('loadRevenueTimeline', () => {
    it('gom theo ngày hoàn thành, truyền kỳ (ngày cuối tính hết ngày), không lọc chi nhánh', async () => {
      query.mockResolvedValue([
        { day: '2026-10-05', revenue: '1000', cogs: '600' },
        { day: '2026-10-06', revenue: '0', cogs: '0' },
      ]);

      const rows = await service.loadRevenueTimeline(
        '2026-10-01',
        '2026-10-31',
      );

      expect(rows).toEqual([
        { date: '2026-10-05', revenue: 1000, cogs: 600 },
        { date: '2026-10-06', revenue: 0, cogs: 0 },
      ]);
      const [sql, params] = query.mock.calls[0];
      expect(params).toEqual(['2026-10-01', '2026-10-31 23:59:59.999']);
      expect(sql).toContain('GROUP BY 1');
      expect(sql).toContain('"c"."exclude_from_reports" IS NOT TRUE');
      expect(sql).not.toContain('branch_external_id');
      // chống SQL injection: giá trị đi qua tham số, không nối chuỗi
      expect(sql).not.toContain('2026-10-01');
    });

    it('thiếu kỳ thì không truy vấn', async () => {
      expect(
        await service.loadRevenueTimeline(undefined, '2026-10-31'),
      ).toEqual([]);
      expect(
        await service.loadRevenueTimeline('2026-10-01', undefined),
      ).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('loadDebtTimeline', () => {
    const mockQueries = () =>
      query.mockImplementation(async (sql: string) =>
        sql.includes('PAYMENT')
          ? [
              { day: '2026-10-06', total: '300', paid: '100' },
              { day: '2026-10-07', total: '50', paid: '0' },
            ]
          : [
              { day: '2026-10-05', total: '1000', paid: '400' },
              { day: '2026-10-06', total: '2000', paid: '2000' },
            ],
      );

    it('gộp phải thu và phải trả theo ngày, sắp tăng dần', async () => {
      mockQueries();
      const rows = await service.loadDebtTimeline('2026-10-01', '2026-10-31');

      expect(rows).toEqual([
        {
          date: '2026-10-05',
          arTotal: 1000,
          arPaid: 400,
          apTotal: 0,
          apPaid: 0,
        },
        {
          date: '2026-10-06',
          arTotal: 2000,
          arPaid: 2000,
          apTotal: 300,
          apPaid: 100,
        },
        { date: '2026-10-07', arTotal: 0, arPaid: 0, apTotal: 50, apPaid: 0 },
      ]);
    });

    it('kỳ trước mốc ghi nhận công nợ thì cắt về 01/07/2026', async () => {
      mockQueries();
      await service.loadDebtTimeline('2026-01-01', '2026-10-31');
      for (const [, params] of query.mock.calls) {
        expect(params[0]).toBe('2026-07-01');
      }
    });

    it('có chi nhánh thì lọc cả phải thu lẫn phải trả bằng tham số', async () => {
      mockQueries();
      await service.loadDebtTimeline('2026-10-01', '2026-10-31', 'CN1');
      expect(query).toHaveBeenCalledTimes(2);
      for (const [sql, params] of query.mock.calls) {
        expect(params).toEqual([
          '2026-10-01',
          '2026-10-31 23:59:59.999',
          'CN1',
        ]);
        expect(sql).toContain('branch_external_id');
        expect(sql).not.toContain('CN1');
      }
    });

    it('phải trả dùng join cấn trừ PAYMENT theo vụ việc', async () => {
      mockQueries();
      await service.loadDebtTimeline('2026-10-01', '2026-10-31');
      const payableSql = query.mock.calls
        .map(([sql]) => sql as string)
        .find((sql) => sql.includes('PAYMENT'));
      expect(payableSql).toContain('"kgara_case_settlements"');
    });

    it('thiếu kỳ thì không truy vấn', async () => {
      expect(await service.loadDebtTimeline(undefined, undefined)).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });
  });
});
