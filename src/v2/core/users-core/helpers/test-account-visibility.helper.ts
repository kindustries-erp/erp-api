/**
 * Tài khoản E2E và role test chỉ hiển thị cho admin@liouni.com.
 * Đây là nguồn duy nhất của danh sách ẩn; mọi lọc users/role đều đi qua file này.
 */
export const TEST_ACCOUNT_VIEWER_EMAIL = 'admin@liouni.com';

/** Email chuẩn hóa chữ thường (khớp `normalizeEmail`). */
export const HIDDEN_TEST_EMAILS: readonly string[] = [
  'ai-test-tao@example.com',
  'ai-test-admin@example.com',
];

/** Tên role test, khớp đúng `core_roles.name`. */
export const HIDDEN_TEST_ROLE_NAMES: readonly string[] = [
  'Test Admin',
  'Test Tạo',
  'E2E Loans Test',
];

/** Người xem có quyền thấy dữ liệu test. Thiếu email hoặc email khác đều coi là không có quyền. */
export function canViewTestAccounts(
  viewerEmail: string | null | undefined,
): boolean {
  return (viewerEmail ?? '').trim().toLowerCase() === TEST_ACCOUNT_VIEWER_EMAIL;
}

export function isHiddenTestEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return HIDDEN_TEST_EMAILS.includes(email.trim().toLowerCase());
}

export function isHiddenTestRoleName(name: string | null | undefined): boolean {
  if (!name) return false;
  return HIDDEN_TEST_ROLE_NAMES.includes(name);
}
