import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import * as jwt from 'jsonwebtoken';

/**
 * Guard bảo vệ route bằng cách validate Directus access_token.
 * Gọi GET /users/me với Bearer token — nếu Directus trả 200 thì hợp lệ.
 * Sau khi xác thực, gắn thông tin user vào request.user.
 *
 * Nếu token là impersonation token (JWT backend-signed), guard sẽ
 * fetch thông tin target user bằng admin token và gắn vào request.user.
 *
 * Cách dùng: @UseGuards(DirectusAuthGuard)
 */
@Injectable()
export class DirectusAuthGuard implements CanActivate {
  private readonly logger = new Logger(DirectusAuthGuard.name);

  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this._extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Không tìm thấy access token');
    }

    // Thử verify như impersonation token trước
    const impersonationSecret = this.config.get<string>(
      'JWT_IMPERSONATION_SECRET',
    );
    let impersonationPayload: any = null;
    if (impersonationSecret) {
      try {
        const payload = jwt.verify(token, impersonationSecret) as any;
        if (payload?.type === 'impersonation') {
          impersonationPayload = payload;
        }
      } catch {
        // Không phải impersonation token → tiếp tục flow Directus bình thường
      }
    }

    if (impersonationPayload) {
      // Impersonation flow: fetch target user bằng admin token
      const directusUrl = this.config.getOrThrow<string>('DIRECTUS_URL');
      const adminToken = this.config.getOrThrow<string>('DIRECTUS_ADMIN_TOKEN');

      let targetUser: any;
      try {
        const response = await fetch(
          `${directusUrl}/users/${impersonationPayload.sub}?fields=id,email,first_name,last_name,role,status`,
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );

        if (!response.ok) {
          throw new Error(`Directus trả ${response.status}`);
        }

        const body = (await response.json()) as { data: any };
        targetUser = body.data;
      } catch (err: any) {
        this.logger.warn(
          `Không thể fetch target user khi impersonate: ${err?.message}`,
        );
        throw new UnauthorizedException(
          'Impersonation token không hợp lệ hoặc user đích không tồn tại',
        );
      }

      (request as any).user = {
        id: targetUser.id,
        email: targetUser.email,
        first_name: targetUser.first_name,
        last_name: targetUser.last_name,
        role: targetUser.role,
        _impersonatedBy: impersonationPayload.originalUserId,
        _effectiveDirectusToken: adminToken,
      };

      return true;
    }

    // Normal Directus token flow
    const directusUrl = this.config.getOrThrow<string>('DIRECTUS_URL');

    let me: any;
    try {
      const response = await fetch(`${directusUrl}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Directus trả ${response.status}`);
      }

      const body = (await response.json()) as { data: any };
      me = body.data;
    } catch (err: any) {
      this.logger.warn(`Token không hợp lệ: ${err?.message}`);
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }

    // Gắn user info vào request để các handler sau có thể dùng
    (request as any).user = {
      id: me.id,
      email: me.email,
      first_name: me.first_name,
      last_name: me.last_name,
      role: me.role,
    };

    return true;
  }

  private _extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice(7).trim() || null;
  }
}
