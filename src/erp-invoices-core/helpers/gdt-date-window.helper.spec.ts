import {
  buildDateWindows,
  clampWindowDays,
  getVietnamTodayIso,
  shiftIsoDate,
  splitDateWindow,
} from './gdt-date-window.helper';

describe('gdt-date-window.helper', () => {
  describe('buildDateWindows', () => {
    it('should split a range into windows of at most N days', () => {
      expect(buildDateWindows('2026-09-01', '2026-09-25', 10)).toEqual([
        { from: '2026-09-01', to: '2026-09-10' },
        { from: '2026-09-11', to: '2026-09-20' },
        { from: '2026-09-21', to: '2026-09-25' },
      ]);
    });

    it('should cover the month boundary without gaps or overlaps', () => {
      const windows = buildDateWindows('2026-09-25', '2026-10-05', 5);

      expect(windows).toEqual([
        { from: '2026-09-25', to: '2026-09-29' },
        { from: '2026-09-30', to: '2026-10-04' },
        { from: '2026-10-05', to: '2026-10-05' },
      ]);
    });

    it('should cover the year boundary', () => {
      expect(buildDateWindows('2026-12-30', '2027-01-02', 10)).toEqual([
        { from: '2026-12-30', to: '2027-01-02' },
      ]);
    });

    it('should return a single window when range fits', () => {
      expect(buildDateWindows('2026-10-01', '2026-10-01', 10)).toEqual([
        { from: '2026-10-01', to: '2026-10-01' },
      ]);
    });

    it('should return empty when from is after to', () => {
      expect(buildDateWindows('2026-10-02', '2026-10-01', 10)).toEqual([]);
    });

    it('should clamp window size to 1..31', () => {
      expect(buildDateWindows('2026-10-01', '2026-10-03', 0)).toHaveLength(3);
      expect(buildDateWindows('2026-10-01', '2026-10-03', 100)).toHaveLength(1);
    });
  });

  describe('splitDateWindow', () => {
    it('should halve a window into two contiguous parts', () => {
      expect(splitDateWindow({ from: '2026-09-01', to: '2026-09-10' })).toEqual(
        [
          { from: '2026-09-01', to: '2026-09-05' },
          { from: '2026-09-06', to: '2026-09-10' },
        ],
      );
    });

    it('should return null for a single-day window', () => {
      expect(
        splitDateWindow({ from: '2026-09-30', to: '2026-09-30' }),
      ).toBeNull();
    });
  });

  describe('shiftIsoDate', () => {
    it('should move across month and year boundaries', () => {
      expect(shiftIsoDate('2026-10-01', -2)).toBe('2026-09-29');
      expect(shiftIsoDate('2026-12-31', 1)).toBe('2027-01-01');
    });
  });

  describe('clampWindowDays', () => {
    it('should fall back to max for non-finite input', () => {
      expect(clampWindowDays(Number.NaN)).toBe(31);
    });
  });

  describe('getVietnamTodayIso', () => {
    it('should use Vietnam calendar day, not UTC day', () => {
      // 2026-09-30 17:30 UTC = 2026-10-01 00:30 Việt Nam
      const now = new Date('2026-09-30T17:30:00Z');

      expect(getVietnamTodayIso(now)).toBe('2026-10-01');
    });
  });
});
