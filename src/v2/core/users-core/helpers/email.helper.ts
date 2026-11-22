/** Chuẩn hóa email: cắt khoảng trắng và chuyển chữ thường. Dùng trước mọi lần so khớp hoặc ghi. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
