import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditCoreService } from '../audit-core.service';
import {
  AUDIT_LOG_META_KEY,
  AuditLogOptions,
} from '../decorators/audit-log.decorator';

@Injectable()
export class GlobalAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditCoreService: AuditCoreService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest();
    const { method, url } = req;

    const auditMeta = this.reflector.getAllAndOverride<AuditLogOptions>(
      AUDIT_LOG_META_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Bỏ qua nếu tính năng Audit Log bị tắt qua cấu hình ENABLE_AUDIT_LOG=false
    if (!this.auditCoreService.isEnabled) {
      return next.handle();
    }

    // Bỏ qua nếu có cờ skip
    if (auditMeta?.skip) {
      return next.handle();
    }

    // Mặc định bỏ qua các Request GET, OPTIONS, HEAD trừ khi có gắn @AuditLog decorator chỉ định
    // để tránh làm phình to Database với hàng trăm nghìn log đọc dữ liệu (polling, tables, dashboards)
    if (['GET', 'OPTIONS', 'HEAD'].includes(method) && !auditMeta) {
      return next.handle();
    }

    const defaultModule = resolveAuditModule(url);

    const actionType = auditMeta?.actionType || method;
    const moduleName = auditMeta?.module || defaultModule;
    const entityType = auditMeta?.entityType || null;

    let entityId = null;
    if (req.params && req.params.id) {
      entityId = req.params.id;
    }

    return next.handle().pipe(
      tap({
        next: (resData) => {
          let afterSnapshot = req.afterSnapshot || null;
          if (!afterSnapshot && ['POST', 'PUT', 'PATCH'].includes(method)) {
            afterSnapshot = { ...req.body };
            if (afterSnapshot.password) delete afterSnapshot.password;
          }
          if (
            !afterSnapshot &&
            ['POST', 'PUT', 'PATCH'].includes(method) &&
            typeof resData === 'object' &&
            resData !== null
          ) {
            afterSnapshot = resData.data || resData;
            if (afterSnapshot?.password) delete afterSnapshot.password;
          }

          const beforeSnapshot = req.beforeSnapshot || null;

          this.logAction(
            req,
            'SUCCESS',
            null,
            actionType,
            moduleName,
            entityType,
            entityId,
            beforeSnapshot,
            afterSnapshot,
          );
        },
        error: (err) => {
          let afterSnapshot = req.body ? { ...req.body } : null;
          if (afterSnapshot?.password) delete afterSnapshot.password;

          this.logAction(
            req,
            'FAIL',
            err,
            actionType,
            moduleName,
            entityType,
            entityId,
            req.beforeSnapshot || null,
            afterSnapshot,
          );
        },
      }),
    );
  }

  private logAction(
    req: any,
    status: 'SUCCESS' | 'FAIL',
    err: any,
    actionType: string,
    moduleName: string,
    entityType: string | null,
    entityId: string | null,
    beforeSnapshot?: any,
    afterSnapshot?: any,
  ) {
    try {
      const user = req.user;

      this.auditCoreService.recordAction({
        actorUserId: user?.sub || null,
        actorEmail: user?.email || null,
        actionType,
        module: moduleName,
        entityType,
        entityId,
        route: req.url,
        httpMethod: req.method,
        status,
        message: err ? err.message : null,
        beforeSnapshot,
        afterSnapshot,
        errorSnapshot: err ? { message: err.message, stack: err.stack } : null,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      });
    } catch (e) {
      // Không để lỗi ghi log làm gián đoạn luồng nghiệp vụ chính
    }
  }
}

/**
 * Lấy tên module từ URL: segment ngay sau version (`/api/v1/x`, `/api/v2/x`) → `x`.
 * Không có version thì lấy segment đầu tiên.
 */
export function resolveAuditModule(url: string): string {
  const parts = url.split('?')[0].split('/').filter(Boolean);
  const versionIndex = parts.findIndex((part) => /^v\d+$/.test(part));
  if (versionIndex >= 0 && parts.length > versionIndex + 1) {
    return parts[versionIndex + 1];
  }
  return parts[0] ?? 'UNKNOWN';
}
