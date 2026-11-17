import { extensionOf, sanitizeFileName } from './sanitize-filename.helper';

describe('sanitizeFileName', () => {
  it('giữ tên hợp lệ và đuôi chữ thường', () => {
    expect(sanitizeFileName('Hoa-don_01.PDF')).toBe('Hoa-don_01.pdf');
  });

  it('chặn path traversal và đường dẫn', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('C:\\x\\..\\y.pdf')).toBe('y.pdf');
  });

  it('bỏ ký tự điều khiển và ký tự đặc biệt', () => {
    expect(sanitizeFileName('a\u0000b\nc<>:"|?*.png')).toBe(
      'abc_.png'.replace('c_', 'c'),
    );
  });

  it('giữ chữ có dấu', () => {
    expect(sanitizeFileName('Hóa đơn tháng 10.pdf')).toBe(
      'Hóa_đơn_tháng_10.pdf',
    );
  });

  it('đuôi kép chỉ giữ đuôi cuối, phần trước thành tên', () => {
    expect(sanitizeFileName('a.php.pdf')).toBe('a.php.pdf');
    expect(sanitizeFileName('x.tar.gz')).toBe('x.tar.gz');
  });

  it('cắt tên quá dài', () => {
    const out = sanitizeFileName(`${'a'.repeat(500)}.pdf`);
    expect(out.length).toBeLessThanOrEqual(131);
    expect(out.endsWith('.pdf')).toBe(true);
  });

  it('rỗng hoặc toàn ký tự bị loại thì dùng tên mặc định', () => {
    expect(sanitizeFileName('')).toBe('file');
    expect(sanitizeFileName(null)).toBe('file');
    expect(sanitizeFileName('???.pdf')).toBe('file.pdf');
  });

  it('khôi phục tên UTF-8 bị đọc thành latin1', () => {
    const mojibake = Buffer.from('Hóa đơn.pdf', 'utf8').toString('latin1');
    expect(sanitizeFileName(mojibake)).toBe('Hóa_đơn.pdf');
  });

  it('extensionOf trả đuôi đã chuẩn hóa', () => {
    expect(extensionOf('A.PDF')).toBe('pdf');
    expect(extensionOf('noext')).toBe('');
  });
});
