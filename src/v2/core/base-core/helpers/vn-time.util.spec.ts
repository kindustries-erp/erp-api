import {
  fromVnWall,
  toVnWall,
  vnDateSql,
  vnDayBound,
  vnDayEnd,
  vnDayStart,
} from './vn-time.util';

describe('vn-time.util', () => {
  it('đầu và cuối ngày VN theo instant UTC', () => {
    expect(vnDayStart('2026-10-05')?.toISOString()).toBe(
      '2026-10-04T17:00:00.000Z',
    );
    expect(vnDayEnd('2026-10-05')?.toISOString()).toBe(
      '2026-10-05T16:59:59.999Z',
    );
  });

  it('từ chối định dạng/ngày không hợp lệ', () => {
    expect(vnDayStart('2026-02-31')).toBeNull();
    expect(vnDayStart('05/10/2026')).toBeNull();
  });

  it('vnDayBound: ngày thuần thành instant, ISO có giờ giữ nguyên', () => {
    expect((vnDayBound('2026-10-05', 'start') as Date).toISOString()).toBe(
      '2026-10-04T17:00:00.000Z',
    );
    expect((vnDayBound('2026-10-05', 'end') as Date).toISOString()).toBe(
      '2026-10-05T16:59:59.999Z',
    );
    expect(vnDayBound('2026-10-05T01:00:00Z', 'start')).toBe(
      '2026-10-05T01:00:00Z',
    );
  });

  it('toVnWall/fromVnWall đảo nhau', () => {
    const i = new Date('2026-10-05T20:00:00.000Z'); // 03:00 ngày 6 giờ VN
    expect(toVnWall(i).getUTCDate()).toBe(6);
    expect(fromVnWall(toVnWall(i)).toISOString()).toBe(i.toISOString());
  });

  it('vnDateSql dùng AT TIME ZONE Asia/Ho_Chi_Minh', () => {
    expect(vnDateSql('"c"."issued_at"')).toBe(
      `TO_CHAR(("c"."issued_at") AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')`,
    );
  });
});
