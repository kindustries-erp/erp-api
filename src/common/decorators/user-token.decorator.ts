import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const UserToken = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    // Khi đang impersonate, dùng admin token để gọi Directus thay cho impersonation JWT
    const effectiveToken = (request as any).user?._effectiveDirectusToken;
    if (effectiveToken) return effectiveToken;
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return null;
  },
);
