import {
  normalizePlate,
  shiftIsoDate,
} from './legacy-voucher-duplicate.service';

describe('legacy voucher duplicate helpers', () => {
  it('normalizePlate bỏ ký tự đặc biệt và viết hoa', () => {
    expect(normalizePlate('29a-123.45')).toBe('29A12345');
    expect(normalizePlate(null)).toBe('');
    expect(normalizePlate(undefined)).toBe('');
  });

  it('shiftIsoDate cộng/trừ ngày theo UTC, qua tháng và năm', () => {
    expect(shiftIsoDate('2026-10-05', -7)).toBe('2026-09-28');
    expect(shiftIsoDate('2026-01-03', -7)).toBe('2025-12-27');
    expect(shiftIsoDate('2026-12-29', 7)).toBe('2027-01-05');
  });
});
