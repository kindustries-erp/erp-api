import {
  GARAGE_FORECAST_RECEIPT_CONTENT,
  GARAGE_PAYMENT_METHODS,
  getGarageContentsForType,
  requiresCase,
  toLegacyPaymentMethod,
} from './garage-cashflow-catalog';

describe('garage-cashflow-catalog', () => {
  it('phiếu thu chỉ có nội dung thu', () => {
    expect(getGarageContentsForType('RECEIPT')).toEqual([
      '1. KH thanh toán',
      '2. Tất toán',
      '3. BH thanh toán',
      '8. Cấn trừ',
      '12. Hoàn ứng',
      '13. Khác',
    ]);
  });

  it('phiếu chi chỉ có nội dung chi', () => {
    expect(getGarageContentsForType('PAYMENT')).toEqual([
      '4. HHBH',
      '5. HH Bán hàng',
      '6. HH Xưởng',
      '7. Ứng trước',
      '8. Cấn trừ',
      '9. Phụ tùng / vật tư',
      '10. Vật tư tiêu hao',
      '11. Chi phí vận hành',
      '13. Khác',
    ]);
  });

  it('nội dung hệ thống dự thu không nằm trong danh sách chọn', () => {
    expect(getGarageContentsForType('RECEIPT')).not.toContain(
      GARAGE_FORECAST_RECEIPT_CONTENT,
    );
  });

  it('chỉ KH thanh toán, BH thanh toán và cấn trừ cần phiếu dịch vụ', () => {
    expect(requiresCase('1. KH thanh toán')).toBe(true);
    expect(requiresCase('3. BH thanh toán')).toBe(true);
    expect(requiresCase('8. Cấn trừ')).toBe(true);
    expect(requiresCase('2. Tất toán')).toBe(false);
    expect(requiresCase('8. Vật tư tiêu hao')).toBe(false);
    expect(requiresCase(null)).toBe(false);
  });

  it('có phương thức Chuyển khoản khác', () => {
    expect(GARAGE_PAYMENT_METHODS).toContain('Chuyển khoản khác');
  });

  it.each([
    ['Chuyển khoản', 'BANK_TRANSFER'],
    ['Chuyển khoản khác', 'BANK_TRANSFER'],
    ['Tiền mặt', 'CASH'],
    ['Quẹt thẻ', 'POS'],
    ['Thẻ', 'POS'],
    ['Thẻ tín dụng', 'OTHER'],
    ['Khác', 'OTHER'],
    ['', 'CASH'],
    [undefined, 'CASH'],
  ])('map settlement %s → %s', (method, expected) => {
    expect(toLegacyPaymentMethod(method)).toBe(expected);
  });
});
