import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { applyMultiKeywordFilter } from '@/common/utils/query-builder.util';
import { AuditLog } from '../entities/audit-log.entity';
import { QueryAuditLogDto } from '../dto/query-audit-log.dto';
import { QueryAuditLogColumnOptionsDto } from '../dto/query-audit-log-column-options.dto';
import { isAuditLogEnabled } from '../helpers/audit-enabled';
import {
  AUDIT_ALIAS,
  mapAuditColumnToSqlField,
} from '../helpers/audit-log-columns';
import {
  applyAuditColumnFilters,
  applyAuditColumnSearch,
  applyAuditFieldFilters,
  applyAuditSort,
} from '../helpers/audit-log-filters.helper';

export interface AuditPage {
  rows: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditColumnOptions {
  items: { label: string; value: string }[];
  total: number;
  page: number;
  pageSize: number;
}

/** Chỉ đọc nhật ký: danh sách, gợi ý giá trị cột, timeline theo thực thể. */
@Injectable()
export class AuditLogQueryService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repository: Repository<AuditLog>,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  private get enabled(): boolean {
    return isAuditLogEnabled(this.configService);
  }

  async findPage(query: QueryAuditLogDto): Promise<AuditPage> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Number(query.pageSize) || 20);
    if (!this.enabled) return { rows: [], total: 0, page, pageSize };

    const qb = this.repository.createQueryBuilder(AUDIT_ALIAS);
    applyAuditFieldFilters(qb, query);
    applyAuditColumnSearch(qb, query.column_search);
    applyAuditColumnFilters(qb, query.column_filters, 'col_filter');
    applyAuditSort(qb, query.sorts);
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [rows, total] = await qb.getManyAndCount();
    return { rows, total, page, pageSize };
  }

  async findColumnOptions(
    query: QueryAuditLogColumnOptionsDto,
  ): Promise<AuditColumnOptions> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Number(query.pageSize) || 20);
    const empty = { items: [], total: 0, page, pageSize };
    const field = query.column ? mapAuditColumnToSqlField(query.column) : null;
    if (!this.enabled || !field) return empty;

    const qb = this.repository.createQueryBuilder(AUDIT_ALIAS);
    applyAuditColumnFilters(qb, query.filters, 'c_opt_flt', query.column);
    qb.select(field, 'value').addSelect('COUNT(*)', 'count');
    qb.andWhere(`${field} IS NOT NULL AND CAST(${field} AS text) != ''`);
    if (query.search?.trim()) {
      applyMultiKeywordFilter(qb, field, query.search.trim(), 'col_opt_search');
    }
    qb.groupBy(field).orderBy(field, 'ASC');

    const total = (await qb.clone().getRawMany()).length;
    const raw = await qb
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<{ value: unknown }>();
    const items = raw.map((r) => ({
      label: String(r.value),
      value: String(r.value),
    }));
    return { items, total, page, pageSize };
  }

  /** Toàn bộ lịch sử một thực thể, cũ đến mới. */
  async findTimeline(
    entityType: string,
    entityId: string,
  ): Promise<AuditLog[]> {
    if (!this.enabled) return [];
    return this.repository.find({
      where: { entityType, entityId },
      order: { createdAt: 'ASC' },
    });
  }
}
