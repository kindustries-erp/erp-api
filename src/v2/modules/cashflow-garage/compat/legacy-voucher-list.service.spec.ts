import { tabStatusCondition } from './legacy-voucher-list.service';

describe('legacy voucher list helpers', () => {
  describe('tabStatusCondition', () => {
    it('tab dự kiến: loại trạng thái đã settled và đã hủy', () => {
      expect(tabStatusCondition('forecast', undefined)).toBe(
        "f.status NOT IN ('SETTLED', 'CANCELLED')",
      );
      expect(tabStatusCondition(undefined, 'FORECAST')).toBe(
        "f.status NOT IN ('SETTLED', 'CANCELLED')",
      );
    });

    it('tab thực tế: chỉ settled', () => {
      expect(tabStatusCondition('vouchers', undefined)).toBe(
        "f.status = 'SETTLED'",
      );
      expect(tabStatusCondition(undefined, 'ACTUAL')).toBe(
        "f.status = 'SETTLED'",
      );
    });

    it('ưu tiên dự kiến khi gửi cả hai, không lọc khi tab all', () => {
      expect(tabStatusCondition('forecast', 'ACTUAL')).toBe(
        "f.status NOT IN ('SETTLED', 'CANCELLED')",
      );
      expect(tabStatusCondition('all', 'ALL')).toBeNull();
      expect(tabStatusCondition(undefined, undefined)).toBeNull();
    });
  });
});
