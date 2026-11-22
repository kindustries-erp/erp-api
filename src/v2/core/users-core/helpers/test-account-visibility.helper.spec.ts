import {
  canViewTestAccounts,
  HIDDEN_TEST_EMAILS,
  HIDDEN_TEST_ROLE_NAMES,
  isHiddenTestEmail,
  isHiddenTestRoleName,
} from './test-account-visibility.helper';

describe('test-account-visibility.helper', () => {
  it('chỉ admin@liouni.com được xem tài khoản test (không phân biệt hoa thường, bỏ khoảng trắng)', () => {
    expect(canViewTestAccounts('admin@liouni.com')).toBe(true);
    expect(canViewTestAccounts('  Admin@Liouni.com ')).toBe(true);
    expect(canViewTestAccounts('ai-test-tao@example.com')).toBe(false);
    expect(canViewTestAccounts('ai-test-admin@example.com')).toBe(false);
    expect(canViewTestAccounts('other@liouni.com')).toBe(false);
  });

  it('thiếu email thì coi là không có quyền', () => {
    expect(canViewTestAccounts(null)).toBe(false);
    expect(canViewTestAccounts(undefined)).toBe(false);
    expect(canViewTestAccounts('')).toBe(false);
  });

  it('ẩn đúng 2 email test, không ẩn tài khoản khác', () => {
    expect(HIDDEN_TEST_EMAILS).toEqual([
      'ai-test-tao@example.com',
      'ai-test-admin@example.com',
    ]);
    expect(isHiddenTestEmail('AI-TEST-TAO@example.com')).toBe(true);
    expect(isHiddenTestEmail('ai-test-duyet@example.com')).toBe(false);
    expect(isHiddenTestEmail(null)).toBe(false);
  });

  it('ẩn đúng 3 role test theo tên', () => {
    expect(HIDDEN_TEST_ROLE_NAMES).toEqual([
      'Test Admin',
      'Test Tạo',
      'E2E Loans Test',
    ]);
    expect(isHiddenTestRoleName('Test Tạo')).toBe(true);
    expect(isHiddenTestRoleName('Xưởng')).toBe(false);
    expect(isHiddenTestRoleName(undefined)).toBe(false);
  });
});
