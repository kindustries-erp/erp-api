import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly configService: ConfigService) {}

  private get directusUrl() {
    return this.configService.getOrThrow<string>('DIRECTUS_URL');
  }

  private get adminToken() {
    return this.configService.getOrThrow<string>('DIRECTUS_ADMIN_TOKEN');
  }

  private async fetchCurrentUser(userToken: string): Promise<any> {
    const res = await fetch(`${this.directusUrl}/users/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    if (!res.ok) {
      throw new BadRequestException('Không xác thực được actor để ghi audit');
    }
    const body = await res.json();
    return body.data;
  }

  private buildDiff(beforePayload: any, afterPayload: any) {
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

  async logEvent(input: {
    userToken: string;
    module: string;
    entityType: string;
    entityId: string;
    entityNo?: string | null;
    action: string;
    eventGroup: string;
    note?: string | null;
    reason?: string | null;
    beforePayload?: any;
    afterPayload?: any;
    meta?: Record<string, any>;
  }) {
    const actor = await this.fetchCurrentUser(input.userToken);
    const diffPayload = this.buildDiff(input.beforePayload, input.afterPayload);
    const payload = {
      module: input.module,
      entity_type: input.entityType,
      entity_id: input.entityId,
      entity_no: input.entityNo || null,
      action: input.action,
      event_group: input.eventGroup,
      actor_id: actor.id,
      actor_type: 'user',
      actor_snapshot: {
        id: actor.id,
        email: actor.email || null,
        full_name:
          [actor.first_name, actor.last_name]
            .filter(Boolean)
            .join(' ')
            .trim() ||
          actor.email ||
          actor.id,
        role_id:
          typeof actor.role === 'string' ? actor.role : actor.role?.id || null,
      },
      source: 'erp_api',
      before_payload: input.beforePayload ?? null,
      after_payload: input.afterPayload ?? null,
      diff_payload: Object.keys(diffPayload).length ? diffPayload : null,
      note: input.note ?? null,
      reason: input.reason ?? null,
      meta: input.meta ?? {},
    };

    const res = await fetch(`${this.directusUrl}/items/audit_logs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(
        `Không thể ghi audit log: ${res.status} ${text}`,
      );
    }

    const body = await res.json();
    return body.data;
  }

  async findAll(query: AuditLogQueryDto) {
    const url = new URL('/items/audit_logs', this.directusUrl);
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const offset = (page - 1) * pageSize;
    url.searchParams.append('limit', String(pageSize));
    url.searchParams.append('offset', String(offset));
    url.searchParams.append('sort[]', query.sort || '-created_at');
    url.searchParams.append('meta', 'filter_count');
    const filterAnd: any[] = [];
    if (query.module) filterAnd.push({ module: { _eq: query.module } });
    if (query.entity_type)
      filterAnd.push({ entity_type: { _eq: query.entity_type } });
    if (query.entity_id)
      filterAnd.push({ entity_id: { _eq: query.entity_id } });
    if (query.action) filterAnd.push({ action: { _eq: query.action } });
    if (query.event_group)
      filterAnd.push({ event_group: { _eq: query.event_group } });
    if (query.actor_id) filterAnd.push({ actor_id: { _eq: query.actor_id } });
    if (query.date_from)
      filterAnd.push({ created_at: { _gte: query.date_from } });
    if (query.date_to) filterAnd.push({ created_at: { _lte: query.date_to } });
    if (filterAnd.length)
      url.searchParams.append('filter', JSON.stringify({ _and: filterAnd }));
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.adminToken}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(
        `Không thể lấy audit logs: ${res.status} ${text}`,
      );
    }
    const body = await res.json();
    return {
      items: (body.data || []).map((row: any) => this.toTimelineRow(row)),
      total: body.meta?.filter_count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((body.meta?.filter_count || 0) / pageSize),
    };
  }

  async getPaymentVoucherTimeline(id: string) {
    const url = new URL('/items/audit_logs', this.directusUrl);
    url.searchParams.append('sort[]', 'created_at');
    url.searchParams.append(
      'filter',
      JSON.stringify({
        _and: [
          { entity_type: { _eq: 'payment_voucher' } },
          { entity_id: { _eq: id } },
        ],
      }),
    );
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.adminToken}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(
        `Không thể lấy timeline payment voucher: ${res.status} ${text}`,
      );
    }
    const body = await res.json();
    return (body.data || []).map((row: any) => this.toTimelineRow(row));
  }

  private toTimelineRow(row: any) {
    const diffPayload =
      row.diff_payload && typeof row.diff_payload === 'object'
        ? row.diff_payload
        : {};
    const changedFields = Object.keys(diffPayload);
    const statusDiff = diffPayload.status;
    return {
      id: row.id,
      action: row.action,
      action_label: row.action,
      action_at: row.created_at,
      actor_id: row.actor_id,
      actor_name:
        row.actor_snapshot?.full_name ||
        row.actor_snapshot?.email ||
        row.actor_id,
      actor_email: row.actor_snapshot?.email || null,
      from_status: statusDiff?.before ?? row.before_payload?.status ?? null,
      to_status: statusDiff?.after ?? row.after_payload?.status ?? null,
      changed_fields: changedFields,
      note: row.note ?? null,
      reason: row.reason ?? null,
      module: row.module,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      entity_no: row.entity_no ?? null,
      event_group: row.event_group,
      source: row.source,
    };
  }
}
