import type { Request } from 'express';
import type { AuthRequestMeta } from '../services/auth-profile.service';

export type AuthRequest = Request & { user: { sub: string; email?: string } };

export function clientMeta(req: Request): {
  userAgent?: string;
  ipAddress?: string;
} {
  return {
    userAgent: req.headers['user-agent'] ?? undefined,
    ipAddress: req.ip ?? undefined,
  };
}

export function requestMeta(req: Request): AuthRequestMeta {
  const requestId = req.headers['x-request-id'];
  return {
    ip: req.ip ?? undefined,
    userAgent: req.headers['user-agent'] ?? undefined,
    requestId: typeof requestId === 'string' ? requestId : undefined,
    route: req.originalUrl,
    method: req.method,
  };
}
