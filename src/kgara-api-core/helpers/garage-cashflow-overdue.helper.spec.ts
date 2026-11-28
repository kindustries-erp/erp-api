import {
  applyGarageOverdueFilter,
  GARAGE_OVERDUE_BUCKETS,
  overdueDateRange,
} from './garage-cashflow-overdue.helper';

// 18:00 UTC ngày 27 đã là 01:00 ngày 28 giờ Việt Nam.
const NOW = new Date('2026-11-27T18:00:00Z');
const TODAY = Date.UTC(2026, 10, 28);

const dateOfAge = (days: number) =>
  new Date(TODAY - days * 86_400_000).toISOString().slice(0, 10);

const bucketsOfAge = (days: number) => {
  const date = dateOfAge(days);
  return GARAGE_OVERDUE_BUCKETS.filter((bucket) => {
    const { from, to } = overdueDateRange(bucket, NOW);
    return (!from || date >= from) && (!to || date <= to);
  });
};

describe('overdueDateRange', () => {
  it.each([
    [-5, 'NOT_DUE'],
    [0, 'NOT_DUE'],
    [1, 'D1_30'],
    [30, 'D1_30'],
    [31, 'D31_90'],
    [90, 'D31_90'],
    [91, 'D90_PLUS'],
    [400, 'D90_PLUS'],
  ])('quá hạn %i ngày thuộc đúng một nhóm %s', (age, bucket) => {
    expect(bucketsOfAge(age)).toEqual([bucket]);
  });

  it('tính hôm nay theo giờ Việt Nam', () => {
    expect(overdueDateRange('NOT_DUE', NOW)).toEqual({ from: '2026-11-28' });
  });
});

describe('applyGarageOverdueFilter', () => {
  const run = (values: string[], statusColumn = 'payment_status') => {
    const qb = { andWhere: jest.fn() };
    applyGarageOverdueFilter(qb as any, values, {
      alias: 'voucher',
      statusColumn,
      now: NOW,
    });
    return qb.andWhere;
  };

  it('giới hạn trong phiếu dự thu, dự chi và gộp nhiều nhóm bằng OR', () => {
    const andWhere = run(['D1_30', 'D90_PLUS']);
    expect(andWhere.mock.calls[0][0]).toContain(
      "voucher.payment_status = 'EXPECTED'",
    );
    expect(andWhere.mock.calls[1][0]).toContain(') OR (');
    expect(andWhere.mock.calls[1][1]).toEqual({
      overdue_D1_30_from: '2026-10-29',
      overdue_D1_30_to: '2026-11-27',
      overdue_D90_PLUS_to: '2026-08-29',
    });
  });

  it('dùng cột trạng thái của v2 khi được chỉ định', () => {
    expect(run(['NOT_DUE'], 'status').mock.calls[0][0]).toContain(
      "voucher.status = 'EXPECTED'",
    );
  });

  it('không lọc khi không có nhóm hợp lệ', () => {
    expect(run([])).not.toHaveBeenCalled();
    expect(run(['__ALL_MATCHING__', 'abc'])).not.toHaveBeenCalled();
  });
});
