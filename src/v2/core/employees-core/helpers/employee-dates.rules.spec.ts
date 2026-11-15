import { BadRequestException } from '@nestjs/common';
import { assertEmployeeDates } from './employee-dates.rules';

const NOW = new Date('2026-11-15T00:00:00.000Z');

describe('assertEmployeeDates', () => {
  it('cho phép ngày sinh ở quá khứ, kể cả ca biên 1990-05-01', () => {
    expect(() =>
      assertEmployeeDates(
        { birthDate: new Date('1990-04-30T17:00:00.000Z') },
        NOW,
      ),
    ).not.toThrow();
  });

  it('chặn ngày sinh ở tương lai', () => {
    expect(() =>
      assertEmployeeDates(
        { birthDate: new Date('2027-01-01T00:00:00.000Z') },
        NOW,
      ),
    ).toThrow(BadRequestException);
  });

  it('chặn ngày nghỉ trước ngày vào làm', () => {
    expect(() =>
      assertEmployeeDates(
        {
          startDate: new Date('2026-05-01T00:00:00.000Z'),
          leaveDate: new Date('2026-04-01T00:00:00.000Z'),
        },
        NOW,
      ),
    ).toThrow(BadRequestException);
  });

  it('cho phép ngày nghỉ bằng ngày vào làm hoặc thiếu một trong hai', () => {
    const d = new Date('2026-05-01T00:00:00.000Z');
    expect(() =>
      assertEmployeeDates({ startDate: d, leaveDate: d }, NOW),
    ).not.toThrow();
    expect(() => assertEmployeeDates({ leaveDate: d }, NOW)).not.toThrow();
  });
});
