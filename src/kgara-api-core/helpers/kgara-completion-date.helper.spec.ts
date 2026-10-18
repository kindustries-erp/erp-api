import { resolveCompletionDate } from './kgara-completion-date.helper';

describe('resolveCompletionDate', () => {
  const date = new Date('2026-10-09T15:55:00');

  it('giữ ngày khi phiếu Kết thúc (3)', () => {
    expect(resolveCompletionDate(3, date)).toBe(date);
  });

  it.each([0, 1, 2, 9])('xóa ngày khi tình trạng là %s', (status) => {
    expect(resolveCompletionDate(status, date)).toBeNull();
  });

  it('xóa ngày khi tình trạng null hoặc undefined', () => {
    expect(resolveCompletionDate(null, date)).toBeNull();
    expect(resolveCompletionDate(undefined, date)).toBeNull();
  });

  it('giữ null khi phiếu Kết thúc nhưng không có ngày', () => {
    expect(resolveCompletionDate(3, null)).toBeNull();
  });

  it('chấp nhận tình trạng dạng chuỗi', () => {
    expect(resolveCompletionDate('3', date)).toBe(date);
    expect(resolveCompletionDate('1', date)).toBeNull();
  });
});
