import {
  sanitizeAuditPayload,
  isSensitiveKey,
} from './audit-payload.sanitizer';

describe('AuditPayloadSanitizer', () => {
  describe('isSensitiveKey', () => {
    it('identifies sensitive keys accurately', () => {
      expect(isSensitiveKey('password')).toBe(true);
      expect(isSensitiveKey('user_password')).toBe(true);
      expect(isSensitiveKey('accessToken')).toBe(true);
      expect(isSensitiveKey('refresh_token')).toBe(true);
      expect(isSensitiveKey('apiKey')).toBe(true);
      expect(isSensitiveKey('secret')).toBe(true);
      expect(isSensitiveKey('authorization')).toBe(true);
      expect(isSensitiveKey('credit_card')).toBe(true);
      expect(isSensitiveKey('cvv')).toBe(true);
      expect(isSensitiveKey('username')).toBe(false);
      expect(isSensitiveKey('email')).toBe(false);
      expect(isSensitiveKey('item_name')).toBe(false);
    });
  });

  describe('sanitizeAuditPayload', () => {
    it('masks sensitive fields in nested objects', () => {
      const payload = {
        name: 'Nguyen Van A',
        email: 'a@liouni.com',
        auth: {
          password: 'SecretPassword123',
          token: 'jwt.token.here',
          nested: {
            apiKey: 'sk-123456789',
            normalField: 'hello',
          },
        },
      };

      const result = sanitizeAuditPayload(payload);

      expect(result.name).toBe('Nguyen Van A');
      expect(result.email).toBe('a@liouni.com');
      expect(result.auth.password).toBe('[REDACTED]');
      expect(result.auth.token).toBe('[REDACTED]');
      expect(result.auth.nested.apiKey).toBe('[REDACTED]');
      expect(result.auth.nested.normalField).toBe('hello');
    });

    it('truncates excessively long strings (e.g. Base64 dumps)', () => {
      const longString = 'A'.repeat(6000);
      const payload = {
        avatar: longString,
      };

      const result = sanitizeAuditPayload(payload, { maxStringLength: 5000 });

      expect(result.avatar.length).toBeLessThan(5100);
      expect(result.avatar).toContain('[TRUNCATED 1000 chars]');
    });

    it('summarizes large arrays to prevent payload bloat', () => {
      const largeArray = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        item: `Item ${i}`,
      }));
      const payload = {
        items: largeArray,
      };

      const result = sanitizeAuditPayload(payload, { maxArrayLength: 10 });

      expect(result.items.length).toBe(11); // 10 items + notice
      expect(result.items[10]._notice).toContain(
        'Truncated 40 additional items',
      );
    });

    it('handles null, undefined and primitive types gracefully', () => {
      expect(sanitizeAuditPayload(null)).toBeNull();
      expect(sanitizeAuditPayload(undefined)).toBeUndefined();
      expect(sanitizeAuditPayload(12345)).toBe(12345);
      expect(sanitizeAuditPayload(true)).toBe(true);
    });
  });
});
