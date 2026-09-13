import { Injectable } from '@nestjs/common';
import { AuditCoreService } from '../audit-core/audit-core.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly auditCoreService: AuditCoreService) {}

  async logEvent(input: {
    userToken?: string;
    module: string;
    entityType: string;
    entityId: string;
    entityNo?: string | null;
    action: string;
    eventGroup?: string;
    note?: string | null;
    reason?: string | null;
    beforePayload?: any;
    afterPayload?: any;
    meta?: Record<string, any>;
  }) {
    this.auditCoreService.recordAction({
      actionType: input.action,
      module: input.module,
      entityType: input.entityType,
      entityId: input.entityId,
      message: input.note || input.reason || null,
      beforeSnapshot: input.beforePayload ?? null,
      afterSnapshot: input.afterPayload ?? null,
    });

    return {
      status: 'SUCCESS',
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
    };
  }

  async findAll(query: AuditLogQueryDto) {
    const result = await this.auditCoreService.findAll({
      module: query.module,
      entityType: query.entity_type,
      entityId: query.entity_id,
      actionType: query.action,
      actorUserId: query.actor_id,
      dateFrom: query.date_from,
      dateTo: query.date_to,
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      items: result.data.map((row) => this.toTimelineRow(row)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: Math.ceil(result.total / (result.pageSize || 20)),
    };
  }

  async getPaymentVoucherTimeline(id: string) {
    const rows = await this.auditCoreService.getEntityTimeline(
      'payment_voucher',
      id,
    );
    return rows.map((row) => this.toTimelineRow(row));
  }

  private toTimelineRow(row: any) {
    const before = row.beforeSnapshot || {};
    const after = row.afterSnapshot || {};
    const diffPayload = this.auditCoreService.buildDiff(before, after);
    const changedFields = Object.keys(diffPayload);
    const statusDiff = diffPayload.status;

    return {
      id: row.id,
      action: row.actionType,
      action_label: row.actionType,
      action_at: row.createdAt,
      actor_id: row.actorUserId,
      actor_name: row.actorEmail || row.actorUserId || 'System',
      actor_email: row.actorEmail || null,
      from_status: statusDiff?.before ?? before?.status ?? null,
      to_status: statusDiff?.after ?? after?.status ?? null,
      changed_fields: changedFields,
      note: row.message ?? null,
      reason: row.message ?? null,
      module: row.module,
      entity_type: row.entityType,
      entity_id: row.entityId,
      entity_no: null,
      event_group: row.module,
      source: 'erp_api',
    };
  }
}
