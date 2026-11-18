import { BadRequestException } from '@nestjs/common';
import { parseDebtDate } from './garage-debt-date.helper';

describe('parseDebtDate', () => {
  it('chấp nhận YYYY-MM-DD và ISO không múi giờ, trả lại nguyên chuỗi', () => {
    expect(parseDebtDate('2026-08-01', 'date_from')).toBe('2026-08-01');
    expect(parseDebtDate('2026-08-01T10:00:00', 'date_to')).toBe(
      '2026-08-01T10:00:00',
    );
    expect(parseDebtDate('2026-08-01T10:00:00.123', 'date_to')).toBe(
      '2026-08-01T10:00:00.123',
    );
  });

  it('rỗng hoặc undefined trả undefined', () => {
    expect(parseDebtDate(undefined, 'date_from')).toBeUndefined();
    expect(parseDebtDate(null, 'date_from')).toBeUndefined();
    expect(parseDebtDate('', 'date_from')).toBeUndefined();
  });

  it('sai định dạng → BadRequestException', () => {
    expect(() => parseDebtDate('01/08/2026', 'date_from')).toThrow(
      BadRequestException,
    );
    expect(() => parseDebtDate('abc', 'date_to')).toThrow(BadRequestException);
    expect(() => parseDebtDate("2026-08-01' OR 1=1", 'date_to')).toThrow(
      BadRequestException,
    );
  });

  it('ngày không tồn tại → BadRequestException', () => {
    expect(() => parseDebtDate('2026-02-31', 'date_from')).toThrow(
      BadRequestException,
    );
    expect(() => parseDebtDate('2026-13-01', 'date_from')).toThrow(
      BadRequestException,
    );
  });
});
