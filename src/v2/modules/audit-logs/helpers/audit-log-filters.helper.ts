import { Brackets, SelectQueryBuilder } from 'typeorm';
import {
  applyMultiKeywordFilter,
  applyMultiKeywordMultiFieldFilter,
} from '@/common/utils/query-builder.util';
import { AuditLog } from '../entities/audit-log.entity';
import { QueryAuditLogDto } from '../dto/query-audit-log.dto';
import { AUDIT_ALIAS, mapAuditColumnToSqlField } from './audit-log-columns';

type AuditQb = SelectQueryBuilder<AuditLog>;

const SEARCH_FIELDS = [
  'actorEmail',
  'entityId',
  'message',
  'route',
  'actionType',
  'module',
].map((p) => `${AUDIT_ALIAS}.${p}`);

/** Giá trị đặc biệt web gửi để lọc ô trống. */
const BLANK = '__BLANK__';
/** Giá trị đặc biệt web gửi để lọc theo từ khóa trên mọi dòng khớp. */
const ALL_MATCHING = '__ALL_MATCHING__';

const isBlank = (field: string) =>
  `(${field} IS NULL OR CAST(${field} AS text) = '')`;

/** Parse JSON tham số cột; lỗi JSON bị bỏ qua (giữ hành vi V1). */
function parseJson<T>(raw: unknown): T | null {
  try {
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T;
  } catch {
    return null;
  }
}

/** Lọc theo các trường thẳng (module, actionType, entity, actor, status, ngày, từ khóa chung). */
export function applyAuditFieldFilters(qb: AuditQb, q: QueryAuditLogDto): void {
  const eq = (value: string | undefined, field: string, param: string) => {
    if (value)
      qb.andWhere(`${AUDIT_ALIAS}.${field} = :${param}`, { [param]: value });
  };
  eq(q.module, 'module', 'module');
  if (q.actionType) {
    const actionTypes = q.actionType.split(',').map((t) => t.trim());
    qb.andWhere(`${AUDIT_ALIAS}.actionType IN (:...actionTypes)`, {
      actionTypes,
    });
  }
  eq(q.entityType, 'entityType', 'entityType');
  eq(q.entityId, 'entityId', 'entityId');
  eq(q.actorUserId, 'actorUserId', 'actorUserId');
  eq(q.status, 'status', 'status');

  const dateFrom = q.dateFrom || q.date_from;
  const dateTo = q.dateTo || q.date_to;
  if (dateFrom) {
    qb.andWhere(`${AUDIT_ALIAS}.createdAt >= :dateFrom`, { dateFrom });
  }
  if (dateTo) {
    const upper = dateTo.length === 10 ? `${dateTo} 23:59:59.999` : dateTo;
    qb.andWhere(`${AUDIT_ALIAS}.createdAt <= :dateTo`, { dateTo: upper });
  }
  if (q.search?.trim()) {
    applyMultiKeywordMultiFieldFilter(
      qb,
      SEARCH_FIELDS,
      q.search.trim(),
      'global_search',
    );
  }
}

/** `column_search`: `{ cột: từ khóa }`, nhiều từ khóa cách nhau bởi `;`. */
export function applyAuditColumnSearch(qb: AuditQb, raw?: string): void {
  const searches = parseJson<Record<string, string>>(raw);
  if (!searches) return;
  Object.entries(searches).forEach(([key, val], idx) => {
    const field = mapAuditColumnToSqlField(key);
    if (field && val && typeof val === 'string' && val.trim()) {
      applyMultiKeywordFilter(qb, field, val.trim(), `col_search_${idx}`);
    }
  });
}

/**
 * `column_filters` / `filters`: `{ cột: [giá trị] }`. Hỗ trợ `__BLANK__` và `__ALL_MATCHING__`.
 * `excludeColumn` bỏ qua cột đang gợi ý (lọc chéo). `prefix` giữ tên tham số khác nhau giữa list và gợi ý.
 */
export function applyAuditColumnFilters(
  qb: AuditQb,
  raw: string | undefined,
  prefix: string,
  excludeColumn?: string,
): void {
  const filters = parseJson<Record<string, string[]>>(raw);
  if (!filters) return;
  Object.entries(filters).forEach(([key, values], idx) => {
    if (
      key === excludeColumn ||
      !Array.isArray(values) ||
      values.length === 0
    ) {
      return;
    }
    const field = mapAuditColumnToSqlField(key);
    if (!field) return;

    if (values[0] === ALL_MATCHING) {
      const text = (values[1] || '').trim();
      if (text)
        applyMultiKeywordFilter(qb, field, text, `${prefix}_all_${idx}`);
      return;
    }

    const hasBlank = values.includes(BLANK);
    const concrete = values.filter((v) => v !== BLANK);
    const param = `${prefix}_${idx}`;
    if (hasBlank && concrete.length > 0) {
      qb.andWhere(
        new Brackets((sqb) => {
          sqb
            .where(`${field} IN (:...${param})`, { [param]: concrete })
            .orWhere(isBlank(field));
        }),
      );
    } else if (hasBlank) {
      qb.andWhere(isBlank(field));
    } else if (concrete.length > 0) {
      qb.andWhere(`${field} IN (:...${param})`, { [param]: concrete });
    }
  });
}

/** Sắp xếp theo `sorts` (`-cột` là giảm dần), mặc định `createdAt DESC`. */
export function applyAuditSort(qb: AuditQb, sorts?: string | string[]): void {
  const list =
    sorts === undefined ? [] : Array.isArray(sorts) ? sorts : [sorts];
  let hasOrder = false;
  list.forEach((s) => {
    if (typeof s !== 'string' || !s.trim()) return;
    const desc = s.startsWith('-');
    const field = mapAuditColumnToSqlField(desc ? s.substring(1) : s);
    if (field) {
      qb.addOrderBy(field, desc ? 'DESC' : 'ASC');
      hasOrder = true;
    }
  });
  if (!hasOrder) qb.orderBy(`${AUDIT_ALIAS}.createdAt`, 'DESC');
}
