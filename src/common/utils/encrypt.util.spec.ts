import { encryptText, decryptText, safeDecrypt } from './encrypt.util';

describe('EncryptUtil', () => {
  it('should encrypt and decrypt a string accurately', () => {
    const raw = 'my_super_secret_password_123!@#';
    const encrypted = encryptText(raw);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toEqual(raw);
    expect(encrypted.startsWith('enc:')).toBe(true);

    const decrypted = decryptText(encrypted);
    expect(decrypted).toEqual(raw);
  });

  it('should handle empty or null string gracefully', () => {
    expect(encryptText('')).toEqual('');
    expect(decryptText('')).toEqual('');
    expect(safeDecrypt('')).toEqual('');
    expect(safeDecrypt(null)).toEqual('');
    expect(safeDecrypt(undefined)).toEqual('');
  });

  it('should throw error when decrypting invalid format with decryptText', () => {
    expect(() => decryptText('plain_text_without_prefix')).toThrow(
      'Invalid encrypted format',
    );
    expect(() => decryptText('enc:invalidpayloadwithoutcolon')).toThrow(
      'Invalid encrypted payload format',
    );
  });

  it('safeDecrypt should return plain text directly for legacy unencrypted strings', () => {
    const plain = 'legacy_plain_password';
    expect(safeDecrypt(plain)).toEqual(plain);
  });

  it('safeDecrypt should return decrypted string when valid enc: is provided', () => {
    const raw = 'vietnam_gdt_tax_pass_2026';
    const encrypted = encryptText(raw);
    expect(safeDecrypt(encrypted)).toEqual(raw);
  });

  it('safeDecrypt should fallback to raw string if encrypted payload is corrupted', () => {
    const corrupted = 'enc:0123456789abcdef:invalidhex';
    expect(safeDecrypt(corrupted)).toEqual(corrupted);
  });
});
