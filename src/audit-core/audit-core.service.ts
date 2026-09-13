import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ErpAuditLog } from './entities/erp-audit-log.entity';
import { AuditLogCoreQueryDto } from './dto/audit-log-core-query.dto';
import { sanitizeAuditPayload } from './utils/audit-payload.sanitizer';
import {
  applyMultiKeywordFilter,
  applyMultiKeywordMultiFieldFilter,
} from '../common/utils/query-builder.util';

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
    @Optional()
    private readonly configService?: ConfigService,
  ) {}

  public get isEnabled(): boolean {
    if (this.configService) {
      return this.configService.get<string>('ENABLE_AUDIT_LOG') !== 'false';
    }
    return process.env.ENABLE_AUDIT_LOG !== 'false';
  }

  onModuleInit() {
    if (this.isEnabled) {
      this.startFlushTimer();
    }
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
    if (!this.isEnabled) {
      return;
    }
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
    if (this.isFlushing || this.buffer.length === 0 || !this.isEnabled) {
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

  private mapColumnToSqlField(column: string): string | null {
    switch (column) {
      case 'actorEmail':
        return 'log.actorEmail';
      case 'actionType':
        return 'log.actionType';
      case 'module':
        return 'log.module';
      case 'entityType':
        return 'log.entityType';
      case 'entityId':
        return 'log.entityId';
      case 'httpMethod':
        return 'log.httpMethod';
      case 'status':
        return 'log.status';
      case 'uiScreen':
        return 'log.uiScreen';
      case 'createdAt':
        return 'log.createdAt';
      default:
        return null;
    }
  }

  async getColumnOptions(
    column: string,
    search?: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
  ) {
    if (!this.isEnabled) {
      return { items: [], total: 0, next: null };
    }

    const rawSqlField = this.mapColumnToSqlField(column);
    if (!rawSqlField) {
      return { items: [], total: 0, next: null };
    }

    const qb = this.auditRepository.createQueryBuilder('log');

    // Cross-column filters
    if (filtersStr) {
      try {
        const filters: Record<string, string[]> =
          typeof filtersStr === 'string' ? JSON.parse(filtersStr) : filtersStr;
        Object.entries(filters).forEach(([key, values], idx) => {
          if (key !== column && Array.isArray(values) && values.length > 0) {
            // 1. Support __ALL_MATCHING__
            if (values[0] === '__ALL_MATCHING__') {
              const searchStr = (values[1] || '').trim();
              if (searchStr) {
                const sqlField = this.mapColumnToSqlField(key);
                if (sqlField) {
                  applyMultiKeywordFilter(
                    qb,
                    sqlField,
                    searchStr,
                    `c_opt_flt_all_${idx}`,
                  );
                }
              }
              return;
            }

            const sqlField = this.mapColumnToSqlField(key);
            if (sqlField) {
              const hasBlank = values.includes('__BLANK__');
              const nonBlankValues = values.filter((v) => v !== '__BLANK__');
              const pName = `c_opt_flt_${idx}`;

              if (hasBlank && nonBlankValues.length > 0) {
                qb.andWhere(
                  new Brackets((sqb) => {
                    sqb
                      .where(`${sqlField} IN (:...${pName})`, {
                        [pName]: nonBlankValues,
                      })
                      .orWhere(
                        `(${sqlField} IS NULL OR CAST(${sqlField} AS text) = '')`,
                      );
                  }),
                );
              } else if (hasBlank) {
                qb.andWhere(
                  `(${sqlField} IS NULL OR CAST(${sqlField} AS text) = '')`,
                );
              } else if (nonBlankValues.length > 0) {
                qb.andWhere(`${sqlField} IN (:...${pName})`, {
                  [pName]: nonBlankValues,
                });
              }
            }
          }
        });
      } catch (e) {
        // Ignore JSON error
      }
    }

    qb.select(`${rawSqlField}`, 'value');
    qb.addSelect('COUNT(*)', 'count');
    qb.andWhere(
      `${rawSqlField} IS NOT NULL AND CAST(${rawSqlField} AS text) != ''`,
    );

    if (search && search.trim()) {
      applyMultiKeywordFilter(qb, rawSqlField, search.trim(), 'col_opt_search');
    }

    qb.groupBy(`${rawSqlField}`);
    qb.orderBy(`${rawSqlField}`, 'ASC');

    const countQb = qb.clone();
    const totalRaw = await countQb.getRawMany();
    const total = totalRaw.length;

    qb.offset((page - 1) * pageSize).limit(pageSize);
    const rows = await qb.getRawMany();

    const items = rows.map((r) => ({
      label: String(r.value),
      value: String(r.value),
    }));

    const next = page * pageSize < total ? page + 1 : null;
    return { items, total, next };
  }

  async findAll(query: AuditLogCoreQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Number(query.pageSize) || 20);

    if (!this.isEnabled) {
      return { data: [], total: 0, page, pageSize };
    }

    const qb = this.auditRepository.createQueryBuilder('log');

    if (query.module) {
      qb.andWhere('log.module = :module', { module: query.module });
    }
    if (query.actionType) {
      const types = query.actionType.split(',').map((t) => t.trim());
      qb.andWhere('log.actionType IN (:...actionTypes)', {
        actionTypes: types,
      });
    }
    if (query.entityType) {
      qb.andWhere('log.entityType = :entityType', {
        entityType: query.entityType,
      });
    }
    if (query.entityId) {
      qb.andWhere('log.entityId = :entityId', { entityId: query.entityId });
    }
    if (query.actorUserId) {
      qb.andWhere('log.actorUserId = :actorUserId', {
        actorUserId: query.actorUserId,
      });
    }
    if (query.status) {
      qb.andWhere('log.status = :status', { status: query.status });
    }

    const dateFrom = query.dateFrom || query.date_from;
    const dateTo = query.dateTo || query.date_to;

    if (dateFrom) {
      qb.andWhere('log.createdAt >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      const dTo = dateTo.length === 10 ? `${dateTo} 23:59:59.999` : dateTo;
      qb.andWhere('log.createdAt <= :dateTo', { dateTo: dTo });
    }

    if (query.search && query.search.trim()) {
      applyMultiKeywordMultiFieldFilter(
        qb,
        [
          'log.actorEmail',
          'log.entityId',
          'log.message',
          'log.route',
          'log.actionType',
          'log.module',
        ],
        query.search.trim(),
        'global_search',
      );
    }

    // Column Search
    if (query.column_search) {
      try {
        const searches: Record<string, string> =
          typeof query.column_search === 'string'
            ? JSON.parse(query.column_search)
            : query.column_search;
        Object.entries(searches).forEach(([key, val], idx) => {
          if (val && typeof val === 'string' && val.trim()) {
            const sqlField = this.mapColumnToSqlField(key);
            if (sqlField) {
              applyMultiKeywordFilter(
                qb,
                sqlField,
                val.trim(),
                `col_search_${idx}`,
              );
            }
          }
        });
      } catch (e) {
        // Ignore
      }
    }

    // Column Filters
    if (query.column_filters) {
      try {
        const filters: Record<string, string[]> =
          typeof query.column_filters === 'string'
            ? JSON.parse(query.column_filters)
            : query.column_filters;
        Object.entries(filters).forEach(([key, values], idx) => {
          if (Array.isArray(values) && values.length > 0) {
            // 1. Support __ALL_MATCHING__
            if (values[0] === '__ALL_MATCHING__') {
              const searchStr = (values[1] || '').trim();
              if (searchStr) {
                const sqlField = this.mapColumnToSqlField(key);
                if (sqlField) {
                  applyMultiKeywordFilter(
                    qb,
                    sqlField,
                    searchStr,
                    `col_filter_all_${idx}`,
                  );
                }
              }
              return;
            }

            const sqlField = this.mapColumnToSqlField(key);
            if (sqlField) {
              const hasBlank = values.includes('__BLANK__');
              const nonBlankValues = values.filter((v) => v !== '__BLANK__');
              const pName = `col_filter_${idx}`;

              if (hasBlank && nonBlankValues.length > 0) {
                qb.andWhere(
                  new Brackets((sqb) => {
                    sqb
                      .where(`${sqlField} IN (:...${pName})`, {
                        [pName]: nonBlankValues,
                      })
                      .orWhere(
                        `(${sqlField} IS NULL OR CAST(${sqlField} AS text) = '')`,
                      );
                  }),
                );
              } else if (hasBlank) {
                qb.andWhere(
                  `(${sqlField} IS NULL OR CAST(${sqlField} AS text) = '')`,
                );
              } else if (nonBlankValues.length > 0) {
                qb.andWhere(`${sqlField} IN (:...${pName})`, {
                  [pName]: nonBlankValues,
                });
              }
            }
          }
        });
      } catch (e) {
        // Ignore
      }
    }

    // Sorts
    if (query.sorts) {
      const sortList = Array.isArray(query.sorts) ? query.sorts : [query.sorts];
      let hasOrder = false;
      sortList.forEach((s) => {
        if (typeof s === 'string' && s.trim()) {
          const isDesc = s.startsWith('-');
          const fieldKey = isDesc ? s.substring(1) : s;
          const sqlField = this.mapColumnToSqlField(fieldKey);
          if (sqlField) {
            qb.addOrderBy(sqlField, isDesc ? 'DESC' : 'ASC');
            hasOrder = true;
          }
        }
      });
      if (!hasOrder) {
        qb.orderBy('log.createdAt', 'DESC');
      }
    } else {
      qb.orderBy('log.createdAt', 'DESC');
    }

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize };
  }

  async getEntityTimeline(entityType: string, entityId: string) {
    if (!this.isEnabled) {
      return [];
    }

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
