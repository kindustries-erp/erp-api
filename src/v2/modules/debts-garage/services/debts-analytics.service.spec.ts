import type { DataSource } from 'typeorm';
import { GARAGE_DEBT_BASELINE_DATE } from '../helpers/garage-debt-sql.helper';
import { DebtsAnalyticsService } from './debts-analytics.service';

function makeService() {
  const query = jest.fn((_sql: string, _params?: unknown[]) =>
    Promise.resolve([] as Record<string, unknown>[]),
  );
  const service = new DebtsAnalyticsService({ query } as unknown as DataSource);
  return { service, query };
}

describe('DebtsAnalyticsService', () => {
  it('chạy 5 truy vấn, tất cả lọc chi nhánh bằng tham số và bỏ phiếu loại khỏi công nợ', async () => {
    const { service, query } = makeService();

    await service.getAnalytics({ branchId: 'b1' });

    expect(query).toHaveBeenCalledTimes(5);
    for (const [sql, params] of query.mock.calls) {
      expect(params).toEqual([GARAGE_DEBT_BASELINE_DATE, 'b1']);
      expect(sql).toContain('= $2');
      expect(sql).toContain('c.kgara_deleted_at IS NULL');
      expect(sql).toContain('c.exclude_from_debt IS NOT TRUE');
      expect(sql).not.toContain('b1');
    }
  });

  it('dateFrom trước mốc bị thay bằng mốc; dateTo chỉ có ngày thì lấy hết ngày', async () => {
    const { service, query } = makeService();

    await service.getAnalytics({
      branchId: 'b1',
      dateFrom: '2020-01-01',
      dateTo: '2026-09-30',
    });

    for (const [sql, params] of query.mock.calls) {
      expect(params).toEqual([
        GARAGE_DEBT_BASELINE_DATE,
        'b1',
        '2026-09-30 23:59:59.999',
      ]);
      expect(sql).toContain('<= $3');
    }
  });

  it('dateFrom sau mốc được giữ; không có dữ liệu vẫn trả cấu trúc đầy đủ', async () => {
    const { service, query } = makeService();

    const res = await service.getAnalytics({
      branchId: 'b1',
      dateFrom: '2026-10-01',
    });

    expect(query.mock.calls[0][1]).toEqual(['2026-10-01', 'b1']);
    expect(res).toEqual(expect.any(Object));
    expect(Object.keys(res).length).toBeGreaterThan(0);
  });
});
