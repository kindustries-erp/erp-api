import {
  getGMT7YearMonthString,
  getGMT7YearMonthDayString,
  toVietnamExcelDate,
} from './date.util';

describe('date.util', () => {
  describe('getGMT7YearMonthString', () => {
    it('returns YYYYMM in Asia/Ho_Chi_Minh', () => {
      // 2026-03-31 18:00:00 UTC is 2026-04-01 01:00:00 in Vietnam
      const date = new Date('2026-03-31T18:00:00Z');
      expect(getGMT7YearMonthString(date)).toBe('202604');
    });

    it('returns empty string for invalid date', () => {
      expect(getGMT7YearMonthString('invalid-date')).toBe('');
    });
  });

  describe('getGMT7YearMonthDayString', () => {
    it('returns YYYYMMDD in Asia/Ho_Chi_Minh', () => {
      const date = new Date('2026-03-31T18:00:00Z');
      expect(getGMT7YearMonthDayString(date)).toBe('20260401');
    });
  });

  describe('toVietnamExcelDate', () => {
    it('handles null, undefined, empty, and invalid dates gracefully', () => {
      expect(toVietnamExcelDate(null)).toBeNull();
      expect(toVietnamExcelDate(undefined)).toBeNull();
      expect(toVietnamExcelDate('')).toBeNull();
      expect(toVietnamExcelDate('invalid')).toBeNull();
    });

    it('correctly maps UTC timestamp to Vietnam calendar date and time in UTC components', () => {
      // 2026-03-14 14:01:32 UTC corresponds to 21:01:32 in Vietnam (+7)
      const input = '2026-03-14T14:01:32.000Z';
      const result = toVietnamExcelDate(input);

      expect(result).not.toBeNull();
      expect(result!.getUTCFullYear()).toBe(2026);
      expect(result!.getUTCMonth()).toBe(2); // 0-based, March is 2
      expect(result!.getUTCDate()).toBe(14);
      expect(result!.getUTCHours()).toBe(21);
      expect(result!.getUTCMinutes()).toBe(1);
      expect(result!.getUTCSeconds()).toBe(32);
    });

    it('handles dates across midnight boundary (+7 hours crossing next day)', () => {
      // 2026-03-13 18:30:00 UTC is 2026-03-14 01:30:00 in Vietnam
      const input = new Date('2026-03-13T18:30:00.000Z');
      const result = toVietnamExcelDate(input);

      expect(result).not.toBeNull();
      expect(result!.getUTCFullYear()).toBe(2026);
      expect(result!.getUTCMonth()).toBe(2);
      expect(result!.getUTCDate()).toBe(14);
      expect(result!.getUTCHours()).toBe(1);
      expect(result!.getUTCMinutes()).toBe(30);
      expect(result!.getUTCSeconds()).toBe(0);
    });
  });
});
