import { Injectable, Logger } from '@nestjs/common';
import { AuditWriterService } from '@/v2/modules/audit-logs/services/audit-writer.service';
import type { UserAuditContext } from '../helpers/audit-context';

export type UserAuditAction =
  | 'CREATE_USER'
  | 'UPDATE_USER'
  | 'ACTIVATE_USER'
  | 'DEACTIVATE_USER'
  | 'RESET_PASSWORD'
  | 'LINK_EMPLOYEE'
  | 'UNLINK_EMPLOYEE';

export interface UserAuditInput {
  actionType: UserAuditAction;
  entityId: string;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
  message?: string | null;
}

/** Ghi đúng một dòng audit cho mỗi thao tác (v1 ghi hai dòng). Snapshot không chứa mật khẩu. */
@Injectable()
export class UsersAuditWriter {
  private readonly logger = new Logger(UsersAuditWriter.name);

  constructor(private readonly auditWriter: AuditWriterService) {}

  /**
   * Audit ghi SAU khi transaction đã commit. Thao tác đã thành công nên lỗi ghi audit chỉ được log lớn,
   * không trả 500 (client sẽ retry và gặp 409 trên một thao tác đã xong).
   */
  async write(ctx: UserAuditContext, input: UserAuditInput): Promise<void> {
    try {
      await this.record(ctx, input);
    } catch (error) {
      this.logger.error(
        `Không ghi được audit ${input.actionType} cho ${input.entityId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private record(ctx: UserAuditContext, input: UserAuditInput): Promise<void> {
    return this.auditWriter.recordAction({
      actorUserId: ctx.actorUserId,
      actorEmail: ctx.actorEmail,
      actionType: input.actionType,
      module: 'users',
      entityType: 'users_management',
      entityId: input.entityId,
      route: ctx.route,
      httpMethod: ctx.httpMethod,
      status: 'SUCCESS',
      message: input.message ?? null,
      uiScreen: ctx.uiScreen,
      uiAction: ctx.uiAction,
      beforeSnapshot: input.beforeSnapshot ?? null,
      afterSnapshot: input.afterSnapshot ?? null,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
  }
}
