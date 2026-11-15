import {
  Logger,
  OnApplicationShutdown,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { BaseAuditLogEntity } from '../entities/base-audit-log.entity';
import {
  AUDIT_BATCH_SIZE,
  AUDIT_FLUSH_INTERVAL_MS,
  AUDIT_REQUEUE_LIMIT,
  RecordActionInput,
} from '../types/audit.types';
import { sanitizeAuditPayload } from '../utils/audit-payload.sanitizer';

export type AuditLogRow = Partial<BaseAuditLogEntity>;

const MAX_MESSAGE = 2000;
const MAX_USER_AGENT = 500;

/**
 * Bộ ghi nhật ký có đệm RAM (abstract): gom tối đa 50 bản ghi hoặc flush mỗi 2 giây,
 * không chặn request. Module cụ thể cung cấp `isEnabled` và `insertBatch`.
 */
export abstract class AbstractAuditWriterService
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  protected readonly logger = new Logger(this.constructor.name);
  private buffer: AuditLogRow[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  /** Cờ bật/tắt (`ENABLE_AUDIT_LOG`). */
  abstract get isEnabled(): boolean;

  /** Ghi một lô xuống DB. Ném lỗi để lớp nền đưa lô trở lại hàng đợi. */
  protected abstract insertBatch(rows: AuditLogRow[]): Promise<void>;

  onModuleInit(): void {
    if (this.isEnabled) this.startFlushTimer();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopFlushTimer();
    await this.flush();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopFlushTimer();
    await this.flush();
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, AUDIT_FLUSH_INTERVAL_MS);
    this.flushTimer.unref?.();
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /** Không chặn: làm sạch payload rồi đẩy vào bộ đệm. */
  async recordAction(input: RecordActionInput): Promise<void> {
    if (!this.isEnabled) return;
    try {
      this.buffer.push(this.toRow(input));
      if (this.buffer.length >= AUDIT_BATCH_SIZE) void this.flush();
    } catch (e) {
      this.logger.warn(
        `Failed to buffer audit log: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private toRow(input: RecordActionInput): AuditLogRow {
    const sanitize = (value?: Record<string, unknown> | null) =>
      value ? (sanitizeAuditPayload(value) as Record<string, unknown>) : null;
    return {
      requestId: input.requestId ?? null,
      actorUserId: input.actorUserId ?? null,
      actorEmail: input.actorEmail ?? null,
      actorEmployeeId: input.actorEmployeeId ?? null,
      actionType: input.actionType,
      module: input.module,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      route: input.route ?? null,
      httpMethod: input.httpMethod ?? null,
      status: input.status ?? 'SUCCESS',
      message: input.message ? input.message.slice(0, MAX_MESSAGE) : null,
      uiScreen: input.uiScreen ?? null,
      uiAction: input.uiAction ?? null,
      beforeSnapshot: sanitize(input.beforeSnapshot),
      afterSnapshot: sanitize(input.afterSnapshot),
      errorSnapshot: sanitize(input.errorSnapshot),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent
        ? input.userAgent.slice(0, MAX_USER_AGENT)
        : null,
    };
  }

  /** Ghi các bản ghi đang đệm xuống DB. Lỗi: đưa lại hàng đợi nếu còn chỗ. */
  async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0 || !this.isEnabled) return;
    this.isFlushing = true;
    const items = this.buffer.splice(0, this.buffer.length);
    try {
      await this.insertBatch(items);
    } catch (err) {
      this.logger.error(
        `Failed to flush ${items.length} audit logs to database: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      if (this.buffer.length < AUDIT_REQUEUE_LIMIT) {
        this.buffer.unshift(...items);
      }
    } finally {
      this.isFlushing = false;
    }
  }
}
