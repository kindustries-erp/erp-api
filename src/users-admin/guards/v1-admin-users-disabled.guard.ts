import { CanActivate, GoneException, Injectable } from '@nestjs/common';

/** Biến môi trường bật lại API V1 `/api/v1/admin/users` (mặc định tắt). */
export const ENABLE_V1_ADMIN_USERS_ENV = 'ENABLE_V1_ADMIN_USERS';

/**
 * API quản lý tài khoản V1 đã được thay bằng `/api/v2/users-management`.
 * Mặc định trả 410 Gone; đặt `ENABLE_V1_ADMIN_USERS=true` để bật lại (đường lùi).
 * Code V1 được giữ nguyên, chỉ ngắt kết nối.
 */
@Injectable()
export class V1AdminUsersDisabledGuard implements CanActivate {
  canActivate(): boolean {
    if (process.env[ENABLE_V1_ADMIN_USERS_ENV] === 'true') return true;
    throw new GoneException(
      'API /api/v1/admin/users đã ngừng. Dùng /api/v2/users-management.',
    );
  }
}
