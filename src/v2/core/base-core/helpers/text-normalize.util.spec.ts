import { normalizeVietnamese } from './text-normalize.util';

describe('normalizeVietnamese', () => {
  it('bỏ dấu, chữ thường, gộp khoảng trắng và ký tự đặc biệt', () => {
    expect(normalizeVietnamese('Lọc  dầu (Ô-tô) Đ1')).toBe('loc dau o to d1');
    expect(normalizeVietnamese('  NHỚT 5W-30 / 4L ')).toBe('nhot 5w 30 4l');
  });

  it('chữ dựng sẵn và chữ tổ hợp cho cùng kết quả', () => {
    expect(normalizeVietnamese('Má phanh'.normalize('NFC'))).toBe(
      normalizeVietnamese('Má phanh'.normalize('NFD')),
    );
  });

  it('trả chuỗi rỗng khi không có giá trị', () => {
    expect(normalizeVietnamese(null)).toBe('');
    expect(normalizeVietnamese(undefined)).toBe('');
    expect(normalizeVietnamese('***')).toBe('');
  });
});
