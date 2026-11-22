import {
  generateRefreshToken,
  hashToken,
  parseExpiresInSeconds,
} from './token.helper';

describe('token.helper', () => {
  it('hashToken ổn định, 64 ký tự hex và không trùng token thô', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken('abc')).not.toBe('abc');
  });

  it('hashToken khớp SHA-256 chuẩn (tương thích hash v1)', () => {
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('generateRefreshToken sinh 96 ký tự hex, không lặp', () => {
    const a = generateRefreshToken();
    expect(a).toMatch(/^[0-9a-f]{96}$/);
    expect(generateRefreshToken()).not.toBe(a);
  });

  it.each([
    ['8h', 28800],
    ['30d', 2592000],
    ['15m', 900],
    ['3600', 3600],
    ['45s', 45],
    ['bậy', 28800],
    ['', 28800],
  ])('parseExpiresInSeconds(%s) = %i', (input, expected) => {
    expect(parseExpiresInSeconds(input)).toBe(expected);
  });
});
