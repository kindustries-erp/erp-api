import type { Request } from 'express';

/** Ngữ cảnh của request, đủ để ghi một dòng audit. Dựng ở controller, truyền xuống service. */
export interface UserAuditContext {
  actorUserId: string | null;
  actorEmail: string | null;
  route: string | null;
  httpMethod: string | null;
  uiScreen: string | null;
  uiAction: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export type UserRequest = Request & { user?: { sub?: string; email?: string } };

const header = (request: UserRequest, name: string): string | null => {
  const value = request.headers?.[name];
  return typeof value === 'string' ? value : null;
};

export function buildAuditContext(request: UserRequest): UserAuditContext {
  return {
    actorUserId: request.user?.sub ?? null,
    actorEmail: request.user?.email ?? null,
    route: request.originalUrl ?? null,
    httpMethod: request.method ?? null,
    uiScreen: header(request, 'x-ui-screen'),
    uiAction: header(request, 'x-ui-action'),
    ipAddress: request.ip ?? null,
    userAgent: header(request, 'user-agent'),
    requestId: header(request, 'x-request-id'),
  };
}
