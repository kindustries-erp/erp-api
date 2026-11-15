import { Injectable } from '@nestjs/common';
import { buildAuditDiff, RecordActionInput } from '@/v2/core/audit-core';
import { AuditLogQueryService } from '@/v2/modules/audit-logs/services/audit-log-query.service';
import { AuditWriterService } from '@/v2/modules/audit-logs/services/audit-writer.service';
import { AuditLogCoreQueryDto } from './dto/audit-log-core-query.dto';

export type { RecordActionInput };

/**
 * Lớp tương thích V1: giữ chữ ký cũ cho các caller (auth, users-admin, garage-cashflow...) và
 * ủy quyền toàn bộ ghi/đọc sang module v2 `audit-logs` (một bộ đệm ghi duy nhất, bảng `audit_logs`).
 */
@Injectable()
export class AuditCoreService {
  constructor(
    private readonly writer: AuditWriterService,
    private readonly query: AuditLogQueryService,
  ) {}

  get isEnabled(): boolean {
    return this.writer.isEnabled;
  }

  recordAction(input: RecordActionInput): Promise<void> {
    return this.writer.recordAction(input);
  }

  flush(): Promise<void> {
    return this.writer.flush();
  }

  async findAll(query: AuditLogCoreQueryDto) {
    const { rows, total, page, pageSize } = await this.query.findPage(query);
    return { data: rows, total, page, pageSize };
  }

  async getColumnOptions(
    column: string,
    search?: string,
    page: number = 1,
    pageSize: number = 20,
    filters?: string,
  ) {
    const result = await this.query.findColumnOptions({
      column,
      search,
      page,
      pageSize,
      filters,
    });
    const next = page * pageSize < result.total ? page + 1 : null;
    return { items: result.items, total: result.total, next };
  }

  getEntityTimeline(entityType: string, entityId: string) {
    return this.query.findTimeline(entityType, entityId);
  }

  buildDiff(beforePayload: unknown, afterPayload: unknown) {
    return buildAuditDiff(beforePayload, afterPayload);
  }
}
