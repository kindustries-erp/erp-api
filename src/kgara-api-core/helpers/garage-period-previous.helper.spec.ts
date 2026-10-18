import { previousPeriodRange } from './garage-period-previous.helper';

const BASELINE = '2026-07-01';

describe('previousPeriodRange', () => {
  it('kỳ trọn tháng → tháng liền trước theo lịch', () => {
    expect(previousPeriodRange('2026-10-01', '2026-10-31', BASELINE)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(previousPeriodRange('2026-09-01', '2026-09-30', BASELINE)).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('kỳ trọn quý → 3 tháng liền trước', () => {
    expect(previousPeriodRange('2026-10-01', '2026-12-31', BASELINE)).toEqual({
      from: '2026-07-01',
      to: '2026-09-30',
    });
  });

  it('kỳ 7 ngày → 7 ngày liền trước', () => {
    expect(previousPeriodRange('2026-10-12', '2026-10-18', BASELINE)).toEqual({
      from: '2026-10-05',
      to: '2026-10-11',
    });
  });

  it('kỳ không trọn tháng: khoảng cùng độ dài nối ngay trước', () => {
    expect(previousPeriodRange('2026-10-12', '2026-10-18', BASELINE)).toEqual({
      from: '2026-10-05',
      to: '2026-10-11',
    });
  });

  it('thiếu from/to hoặc kỳ trước trước mốc ghi nhận thì không so sánh', () => {
    expect(
      previousPeriodRange(undefined, '2026-10-31', BASELINE),
    ).toBeUndefined();
    expect(
      previousPeriodRange('2026-10-01', undefined, BASELINE),
    ).toBeUndefined();
    expect(
      previousPeriodRange('2026-07-01', '2026-07-31', BASELINE),
    ).toBeUndefined();
    expect(
      previousPeriodRange('2026-07-03', '2026-07-05', BASELINE),
    ).toBeUndefined();
  });
});
