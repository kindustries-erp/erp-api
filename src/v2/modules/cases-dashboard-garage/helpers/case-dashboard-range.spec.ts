import {
  parseDay,
  periodRangesFor,
  resolveDayRange,
} from './case-dashboard-range';

/** Chạy với TZ=UTC và TZ=Asia/Ho_Chi_Minh: kết quả phải giống nhau. */
describe('case-dashboard-range (ngày VN)', () => {
  it('parseDay là đầu ngày VN', () => {
    expect(parseDay('2026-10-05', 'f').toISOString()).toBe(
      '2026-10-04T17:00:00.000Z',
    );
    expect(() => parseDay('2026-13-01', 'f')).toThrow();
  });

  it('resolveDayRange bao trọn ngày cuối và đảo ngược thì lỗi', () => {
    const r = resolveDayRange('2026-10-05', '2026-10-06', new Date());
    expect(r.start.toISOString()).toBe('2026-10-04T17:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-10-06T16:59:59.999Z');
    expect(() =>
      resolveDayRange('2026-10-06', '2026-10-05', new Date()),
    ).toThrow();
  });

  it('mặc định là tháng VN của now (now = 01:00 VN ngày 1/11 vẫn thuộc tháng 11)', () => {
    const now = new Date('2026-10-31T18:00:00.000Z'); // 01:00 ngày 01/11 giờ VN
    const r = resolveDayRange(undefined, undefined, now);
    expect(r.start.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-11-30T16:59:59.999Z');
  });

  it('periodRangesFor: ngày/tuần (thứ Hai)/tháng theo lịch VN', () => {
    // Thứ Tư 2026-11-18 10:00 VN
    const r = periodRangesFor(new Date('2026-11-18T03:00:00.000Z'));
    expect(r.day.start.toISOString()).toBe('2026-11-17T17:00:00.000Z');
    expect(r.day.end.toISOString()).toBe('2026-11-18T16:59:59.999Z');
    expect(r.week.start.toISOString()).toBe('2026-11-15T17:00:00.000Z'); // thứ Hai 16/11
    expect(r.week.end.toISOString()).toBe('2026-11-22T16:59:59.999Z'); // hết Chủ nhật 22/11
    expect(r.month.start.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(r.month.end.toISOString()).toBe('2026-11-30T16:59:59.999Z');
  });

  it('Chủ nhật thuộc tuần bắt đầu thứ Hai trước đó', () => {
    // Chủ nhật 2026-11-22 08:00 VN
    const r = periodRangesFor(new Date('2026-11-22T01:00:00.000Z'));
    expect(r.week.start.toISOString()).toBe('2026-11-15T17:00:00.000Z');
  });
});
