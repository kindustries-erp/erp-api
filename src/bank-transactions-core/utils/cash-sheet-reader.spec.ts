import { normalizeCashPlate } from './cash-sheet-reader';

describe('normalizeCashPlate', () => {
  it('bỏ "(CỌC)", khoảng trắng và chuyển chữ hoa', () => {
    expect(normalizeCashPlate('50E21965 (CỌC)')).toBe('50E21965');
    expect(normalizeCashPlate('50h 41036')).toBe('50H41036');
    expect(normalizeCashPlate('50H87060 ( cọc)')).toBe('50H87060');
  });

  it('trả chuỗi rỗng với nội dung không phải biển số', () => {
    expect(normalizeCashPlate('Số dư đầu kỳ')).toBe('');
    expect(normalizeCashPlate('BRVT hoàn tạm ứng')).toBe('');
    expect(normalizeCashPlate('')).toBe('');
  });

  it('nhận biển 4 hoặc 5 chữ số cuối', () => {
    expect(normalizeCashPlate('34A67451')).toBe('34A67451');
    expect(normalizeCashPlate('37H1728')).toBe('37H1728');
  });
});
