import {
  formatVoucherCode,
  voucherCodePrefix,
} from './garage-voucher-code.helper';

describe('garage-voucher-code.helper', () => {
  it('tiền tố PT/PC-GARA-yymmdd theo ngày thu chi', () => {
    expect(voucherCodePrefix('RECEIPT', '2026-11-17')).toBe('PT-GARA-261117');
    expect(voucherCodePrefix('PAYMENT', '2026-01-05T10:00:00Z')).toBe(
      'PC-GARA-260105',
    );
  });

  it('số thứ tự 3 chữ số, vượt 999 thì dài thêm', () => {
    expect(formatVoucherCode('PT-GARA-261117', 7)).toBe('PT-GARA-261117-007');
    expect(formatVoucherCode('PT-GARA-261117', 1000)).toBe(
      'PT-GARA-261117-1000',
    );
  });
});
