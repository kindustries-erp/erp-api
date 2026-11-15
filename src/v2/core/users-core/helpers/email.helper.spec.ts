import { normalizeEmail } from './email.helper';

describe('normalizeEmail', () => {
  it('cắt khoảng trắng và chuyển chữ thường', () => {
    expect(normalizeEmail('  Admin@Liouni.COM ')).toBe('admin@liouni.com');
  });

  it('giữ nguyên email đã chuẩn', () => {
    expect(normalizeEmail('a@b.co')).toBe('a@b.co');
  });
});
