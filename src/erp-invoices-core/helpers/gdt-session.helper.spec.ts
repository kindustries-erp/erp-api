import { GdtCookieJar } from './gdt-session.helper';

describe('GdtCookieJar', () => {
  it('should parse single and multiple Set-Cookie headers correctly', () => {
    const jar = new GdtCookieJar();
    const mockHeader =
      'df9a7b9f11f13b2b359e1a94557637ae=f0a1d51f2fcd2beaf16aa51a40edb25c; path=/; HttpOnly, TS0114b13e=011c0ae7403df08f; Path=/; Domain=.hoadondientu.gdt.gov.vn';

    jar.parseAndSave(mockHeader);

    expect(jar.get('df9a7b9f11f13b2b359e1a94557637ae')).toBe(
      'f0a1d51f2fcd2beaf16aa51a40edb25c',
    );
    expect(jar.get('TS0114b13e')).toBe('011c0ae7403df08f');
    expect(jar.has('path')).toBe(false);
    expect(jar.has('domain')).toBe(false);
    expect(jar.size()).toBe(2);

    const header = jar.getCookieHeader();
    expect(header).toContain(
      'df9a7b9f11f13b2b359e1a94557637ae=f0a1d51f2fcd2beaf16aa51a40edb25c',
    );
    expect(header).toContain('TS0114b13e=011c0ae7403df08f');
  });

  it('should update existing cookies with newer values', () => {
    const jar = new GdtCookieJar('TS0114b13e=old_value; other=123');
    expect(jar.get('TS0114b13e')).toBe('old_value');
    expect(jar.get('other')).toBe('123');

    jar.parseAndSave('TS0114b13e=new_value; path=/');
    expect(jar.get('TS0114b13e')).toBe('new_value');
    expect(jar.get('other')).toBe('123');
  });
});
