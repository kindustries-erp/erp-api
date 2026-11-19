import {
  computeDiscountCaseFix,
  planForecastChange,
} from './kgara-discount-receivable.helper';

describe('kgara-discount-receivable.helper', () => {
  describe('computeDiscountCaseFix', () => {
    it('phiếu GR-PDV2608-0060: net 5.309.550, đã thu 4.769.550 → còn 540.000', () => {
      expect(
        computeDiscountCaseFix({
          tienCoThue: 5309550,
          storedPaid: 0,
          hasReceipt: true,
          receipts: 4769550,
        }),
      ).toEqual({ paid: 4769550, remaining: 540000 });
    });

    it('không có settlement: dùng tien_da_thanh_toan đã lưu', () => {
      expect(
        computeDiscountCaseFix({
          tienCoThue: 6026400,
          storedPaid: 540000,
          hasReceipt: false,
          receipts: 0,
        }),
      ).toEqual({ paid: 540000, remaining: 5486400 });
    });

    it('trả dư thì còn phải thu kẹp ở 0', () => {
      expect(
        computeDiscountCaseFix({
          tienCoThue: 1000,
          storedPaid: 0,
          hasReceipt: true,
          receipts: 1500,
        }),
      ).toEqual({ paid: 1500, remaining: 0 });
    });

    it('chuỗi số từ pg được chuyển đúng', () => {
      expect(
        computeDiscountCaseFix({
          tienCoThue: '5309550.00' as unknown as number,
          storedPaid: '0' as unknown as number,
          hasReceipt: true,
          receipts: '4769550.00' as unknown as number,
        }),
      ).toEqual({ paid: 4769550, remaining: 540000 });
    });
  });

  describe('planForecastChange', () => {
    it('còn 0 thì xóa dự thu', () => {
      expect(planForecastChange(0, 1086250)).toBe('DELETE');
    });

    it('khác số hiện tại thì cập nhật', () => {
      expect(planForecastChange(540000, 1086250)).toBe('UPDATE');
    });

    it('bằng số hiện tại thì giữ nguyên', () => {
      expect(planForecastChange(540000, 540000)).toBe('NOOP');
    });
  });
});
