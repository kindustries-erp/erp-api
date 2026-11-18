import {
  applyDecorators,
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Observable } from 'rxjs';

/** Tiền tố cố định để đếm lời gọi khi xét cổng gỡ V1 (grep trong log). */
export const DEPRECATED_V1_FILE_WRITE_TAG = 'DEPRECATED_V1_FILE_WRITE';

/** Ghi log cảnh báo mỗi lời gọi route V1 ghi file: route, method và user id. Không đổi hợp đồng route. */
@Injectable()
export class DeprecatedV1FileWriteInterceptor implements NestInterceptor {
  private readonly logger = new Logger('DeprecatedV1FileWrite');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method?: string;
      route?: { path?: string };
      originalUrl?: string;
      user?: { sub?: string };
    }>();
    this.logger.warn(
      `${DEPRECATED_V1_FILE_WRITE_TAG} ${req.method ?? '?'} ${req.route?.path ?? req.originalUrl ?? '?'} user=${req.user?.sub ?? 'unknown'}`,
    );
    return next.handle();
  }
}

/**
 * Đánh dấu route V1 ghi file là deprecated (Swagger) và log lời gọi.
 * Thay thế: `/api/v2/invoices/:id/attachments` (module `file-attachments`).
 */
export const DeprecatedV1FileWrite = (summary: string) =>
  applyDecorators(
    ApiOperation({
      deprecated: true,
      summary: `[Deprecated, dùng /api/v2/invoices/:id/attachments] ${summary}`,
    }),
    UseInterceptors(DeprecatedV1FileWriteInterceptor),
  );
