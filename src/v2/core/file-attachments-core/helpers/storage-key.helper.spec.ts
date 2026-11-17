import { buildStorageKey } from './storage-key.helper';

describe('buildStorageKey', () => {
  const now = new Date('2026-11-05T10:00:00Z');

  it('đúng mẫu files/{owner}/{yyyy}/{mm}/{uuid}_{tên}', () => {
    expect(buildStorageKey('INVOICE', 'Hoa don.PDF', now, 'u-1')).toBe(
      'files/invoice/2026/11/u-1_Hoa_don.pdf',
    );
  });

  it('tên độc hại không thoát khỏi thư mục', () => {
    const key = buildStorageKey('INVOICE', '../../x.pdf', now, 'u-2');
    expect(key).toBe('files/invoice/2026/11/u-2_x.pdf');
    expect(key).not.toContain('..');
  });

  it('hai lần gọi sinh khóa khác nhau', () => {
    expect(buildStorageKey('INVOICE', 'a.pdf')).not.toBe(
      buildStorageKey('INVOICE', 'a.pdf'),
    );
  });

  it('ownerType rỗng sau khi làm sạch thì báo lỗi', () => {
    expect(() => buildStorageKey('!!!', 'a.pdf')).toThrow();
  });
});
