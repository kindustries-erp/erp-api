import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpAuditLog } from './entities/erp-audit-log.entity';
import { AuditLogCoreQueryDto } from './dto/audit-log-core-query.dto';
import { sanitizeAuditPayload } from './utils/audit-payload.sanitizer';

export interface RecordActionInput {
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorEmployeeId?: string | null;
  actionType: string;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  route?: string | null;
  httpMethod?: string | null;
  status?: 'SUCCESS' | 'FAIL';
  message?: string | null;
  uiScreen?: string | null;
  uiAction?: string | null;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
  errorSnapshot?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

@Injectable()
export class AuditCoreService
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  private readonly logger = new Logger(AuditCoreService.name);
  private buffer: Partial<ErpAuditLog>[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  private readonly BATCH_SIZE = 50;
  private readonly FLUSH_INTERVAL_MS = 2000;

  constructor(
    @InjectRepository(ErpAuditLog)
    private readonly auditRepository: Repository<ErpAuditLog>,
  ) {}

  onModuleInit() {
    this.startFlushTimer();
  }

  async onModuleDestroy() {
    this.stopFlushTimer();
    await this.flush();
  }

  async onApplicationShutdown() {
    this.stopFlushTimer();
    await this.flush();
  }

  private startFlushTimer() {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.FLUSH_INTERVAL_MS);
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  private stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Non-blocking record action. Sanitizes payload and pushes to in-memory buffer.
   */
  async recordAction(input: RecordActionInput): Promise<void> {
    try {
      const sanitizedBefore = input.beforeSnapshot
        ? sanitizeAuditPayload(input.beforeSnapshot)
        : null;
      const sanitizedAfter = input.afterSnapshot
        ? sanitizeAuditPayload(input.afterSnapshot)
        : null;
      const sanitizedError = input.errorSnapshot
        ? sanitizeAuditPayload(input.errorSnapshot)
        : null;

      const logEntry: Partial<ErpAuditLog> = {
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
        message: input.message ? input.message.slice(0, 2000) : null,
        uiScreen: input.uiScreen ?? null,
        uiAction: input.uiAction ?? null,
        beforeSnapshot: sanitizedBefore,
        afterSnapshot: sanitizedAfter,
        errorSnapshot: sanitizedError,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ? input.userAgent.slice(0, 500) : null,
      };

      this.buffer.push(logEntry);

      if (this.buffer.length >= this.BATCH_SIZE) {
        void this.flush();
      }
    } catch (e: any) {
      this.logger.warn(`Failed to buffer audit log: ${e.message}`);
    }
  }

  /**
   * Flush pending audit logs in buffer to PostgreSQL database.
   */
  async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) {
      return;
    }

    this.isFlushing = true;
    const itemsToFlush = this.buffer.splice(0, this.buffer.length);

    try {
      await this.auditRepository
        .createQueryBuilder()
        .insert()
        .into(ErpAuditLog)
        .values(itemsToFlush as any)
        .execute();
    } catch (err: any) {
      this.logger.error(
        `Failed to flush ${itemsToFlush.length} audit logs to database: ${err.message}`,
      );
      // Re-queue items if buffer is not full
      if (this.buffer.length < 500) {
        this.buffer.unshift(...itemsToFlush);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  async findAll(query: AuditLogCoreQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const qb = this.auditRepository.createQueryBuilder('log');

    if (query.module)
      qb.andWhere('log.module = :module', { module: query.module });
    if (query.actionType) {
      const types = query.actionType.split(',').map((t) => t.trim());
      qb.andWhere('log.actionType IN (:...actionTypes)', {
        actionTypes: types,
      });
    }
    if (query.entityType)
      qb.andWhere('log.entityType = :entityType', {
        entityType: query.entityType,
      });
    if (query.entityId)
      qb.andWhere('log.entityId = :entityId', { entityId: query.entityId });
    if (query.actorUserId)
      qb.andWhere('log.actorUserId = :actorUserId', {
        actorUserId: query.actorUserId,
      });
    if (query.status)
      qb.andWhere('log.status = :status', { status: query.status });
    if (query.dateFrom)
      qb.andWhere('log.createdAt >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo) {
      const dTo =
        query.dateTo.length === 10
          ? `${query.dateTo} 23:59:59.999`
          : query.dateTo;
      qb.andWhere('log.createdAt <= :dateTo', { dateTo: dTo });
    }
    if (query.search) {
      qb.andWhere(
        '(log.actorEmail ILIKE :search OR log.entityId ILIKE :search OR log.message ILIKE :search OR log.route ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('log.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize };
  }

  async getEntityTimeline(entityType: string, entityId: string) {
    return this.auditRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Helper to compute before vs after diff for display in drawers
   */
  buildDiff(beforePayload: any, afterPayload: any) {
    const before =
      beforePayload && typeof beforePayload === 'object' ? beforePayload : {};
    const after =
      afterPayload && typeof afterPayload === 'object' ? afterPayload : {};
    const keys = Array.from(
      new Set([...Object.keys(before), ...Object.keys(after)]),
    ).sort();
    const diff: Record<string, { before: any; after: any }> = {};
    for (const key of keys) {
      const beforeValue = before[key] ?? null;
      const afterValue = after[key] ?? null;
      if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
        diff[key] = { before: beforeValue, after: afterValue };
      }
    }
    return diff;
  }
}
