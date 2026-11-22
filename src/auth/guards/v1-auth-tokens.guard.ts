import {
  CanActivate,
  ExecutionContext,
  GoneException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';

/** Biến môi trường bật lại các endpoint V1 phát refresh token (mặc định tắt). */
export const ENABLE_V1_AUTH_TOKENS_ENV = 'ENABLE_V1_AUTH_TOKENS';

/**
 * Endpoint V1 `login`, `refresh`, `impersonate` phát refresh token vào `core_refresh_tokens`.
 * Đã thay bằng `/api/v2/auth-sessions/*` (bảng `auth_sessions`). Mặc định trả 410 Gone;
 * đặt `ENABLE_V1_AUTH_TOKENS=true` để bật lại (đường lùi, vd khi web cũ còn chạy).
 * Token V1 đã phát vẫn đổi được sang phiên V2 qua `/api/v2/auth-sessions/refresh`.
 * Code V1 giữ nguyên, chỉ ngắt kết nối.
 */
@Injectable()
export class V1AuthTokensGuard implements CanActivate {
  private readonly logger = new Logger(V1AuthTokensGuard.name);

  canActivate(context: ExecutionContext): boolean {
    if (process.env[ENABLE_V1_AUTH_TOKENS_ENV] !== 'true') {
      throw new GoneException(
        'API đăng nhập V1 đã ngừng. Dùng /api/v2/auth-sessions.',
      );
    }
    const req = context.switchToHttp().getRequest<Request>();
    const userAgent = String(req.headers?.['user-agent'] ?? '-').slice(0, 80);
    this.logger.warn(
      `Endpoint V1 phát token còn được gọi: ${req.method} ${req.path} UA="${userAgent}"`,
    );
    return true;
  }
}
