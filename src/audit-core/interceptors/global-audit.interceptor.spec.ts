import { isV2Route, resolveAuditModule } from './global-audit.interceptor';

describe('isV2Route (V1 không ghi route v2)', () => {
  it('nhận diện /api/v2 kể cả có query', () => {
    expect(isV2Route('/api/v2/users-management?page=1')).toBe(true);
    expect(isV2Route('/api/v2')).toBe(true);
  });

  it('không nhận route V1 hoặc không có version', () => {
    expect(isV2Route('/api/v1/audit-logs-core')).toBe(false);
    expect(isV2Route('/auth/login')).toBe(false);
    expect(isV2Route('/api/v20/x')).toBe(false);
  });
});

describe('resolveAuditModule', () => {
  it('takes the segment after the v1 version', () => {
    expect(resolveAuditModule('/api/v1/inventory-items')).toBe(
      'inventory-items',
    );
  });

  it('takes the segment after the v2 version', () => {
    expect(resolveAuditModule('/api/v2/invoices?page=2')).toBe('invoices');
  });

  it('ignores query strings', () => {
    expect(resolveAuditModule('/api/v1/erp-invoices/abc?x=1')).toBe(
      'erp-invoices',
    );
  });

  it('falls back to the first segment when no version is present', () => {
    expect(resolveAuditModule('/auth/login')).toBe('auth');
  });

  it('returns UNKNOWN for an empty URL', () => {
    expect(resolveAuditModule('/')).toBe('UNKNOWN');
  });
});
