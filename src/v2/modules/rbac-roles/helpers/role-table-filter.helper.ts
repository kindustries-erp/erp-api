import { Brackets, SelectQueryBuilder } from 'typeorm';
import {
  applyMultiKeywordFilter,
  applyMultiKeywordMultiFieldFilter,
} from '@/common/utils/query-builder.util';
import type { CoreRole } from '@/v2/core/rbac/entities/core-role.entity';

/**
 * Helper lọc, tìm kiếm và sắp xếp bảng role.
 * Logic giữ nguyên từ bản v1 (cùng tên tham số SQL); chỉ gom các khối lặp lại.
 */

type RoleQb = SelectQueryBuilder<CoreRole>;

/** Ánh xạ tên cột/khóa từ UI sang cột SQL. Cột ngoài danh sách bị bỏ qua. */
export function mapRoleColumnToSqlField(column: string): string | null {
  switch (column) {
    case 'name':
      return 'role.name';
    case 'description':
      return 'role.description';
    case 'isActive':
    case 'is_active':
    case 'status':
      return 'role.isActive';
    case 'createdAt':
      return 'role.createdAt';
    default:
      return null;
  }
}

/** Lọc theo danh sách giá trị, hỗ trợ __BLANK__ (rỗng/NULL). Dùng chung cho mọi cột. */
export function applyRoleValueFilter(
  qb: RoleQb,
  sqlField: string,
  values: string[],
  pName: string,
): void {
  const hasBlank = values.includes('__BLANK__');
  const nonBlankValues = values.filter((v) => v !== '__BLANK__');

  if (hasBlank && nonBlankValues.length > 0) {
    qb.andWhere(
      new Brackets((sqb) => {
        sqb
          .where(`${sqlField} IN (:...${pName})`, { [pName]: nonBlankValues })
          .orWhere(`(${sqlField} IS NULL OR CAST(${sqlField} AS text) = '')`);
      }),
    );
  } else if (hasBlank) {
    qb.andWhere(`(${sqlField} IS NULL OR CAST(${sqlField} AS text) = '')`);
  } else if (nonBlankValues.length > 0) {
    qb.andWhere(`${sqlField} IN (:...${pName})`, { [pName]: nonBlankValues });
  }
}

/** Phân tích tham số JSON; chuỗi lỗi bị bỏ qua như v1. */
export function parseRoleFilterJson<T>(raw: unknown): Record<string, T> | null {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, T>)
      : null;
  } catch {
    return null;
  }
}

/** Bộ lọc chéo cột cho column-options (bỏ qua chính cột đang lấy danh sách). */
export function applyRoleCrossColumnFilters(
  qb: RoleQb,
  column: string,
  filtersStr?: string,
): void {
  if (!filtersStr) return;
  const filters = parseRoleFilterJson<string[]>(filtersStr);
  if (!filters) return;

  Object.entries(filters).forEach(([key, values], idx) => {
    if (key === column || !Array.isArray(values) || values.length === 0) return;

    if (values[0] === '__ALL_MATCHING__') {
      const searchStr = (values[1] || '').trim();
      const sqlField = mapRoleColumnToSqlField(key);
      if (searchStr && sqlField) {
        applyMultiKeywordFilter(
          qb,
          sqlField,
          searchStr,
          `c_opt_flt_all_${idx}`,
        );
      }
      return;
    }

    const sqlField = mapRoleColumnToSqlField(key);
    if (sqlField)
      applyRoleValueFilter(qb, sqlField, values, `c_opt_flt_${idx}`);
  });
}

/** Tìm kiếm toàn cục theo tên và mô tả. */
export function applyRoleGlobalSearch(qb: RoleQb, search?: string): void {
  if (search && search.trim()) {
    applyMultiKeywordMultiFieldFilter(
      qb,
      ['role.name', 'role.description'],
      search.trim(),
      'global_search',
    );
  }
}

/** Tìm kiếm theo từng cột (column_search). */
export function applyRoleColumnSearch(
  qb: RoleQb,
  columnSearch?: string | Record<string, string>,
): void {
  if (!columnSearch) return;
  const searches = parseRoleFilterJson<string>(columnSearch);
  if (!searches) return;

  Object.entries(searches).forEach(([key, val], idx) => {
    if (!val || typeof val !== 'string' || !val.trim()) return;
    const sqlField = mapRoleColumnToSqlField(key);
    if (sqlField) {
      applyMultiKeywordFilter(qb, sqlField, val.trim(), `col_search_${idx}`);
    }
  });
}

/** Lọc theo giá trị từng cột (column_filters), hỗ trợ __ALL_MATCHING__. */
export function applyRoleColumnFilters(
  qb: RoleQb,
  columnFilters?: string | Record<string, string[]>,
): void {
  if (!columnFilters) return;
  const filters = parseRoleFilterJson<string[]>(columnFilters);
  if (!filters) return;

  Object.entries(filters).forEach(([key, values], idx) => {
    if (!Array.isArray(values) || values.length === 0) return;

    if (values[0] === '__ALL_MATCHING__') {
      const searchStr = (values[1] || '').trim();
      const sqlField = mapRoleColumnToSqlField(key);
      if (searchStr && sqlField) {
        applyMultiKeywordFilter(
          qb,
          sqlField,
          searchStr,
          `col_filter_all_${idx}`,
        );
      }
      return;
    }

    const sqlField = mapRoleColumnToSqlField(key);
    if (sqlField)
      applyRoleValueFilter(qb, sqlField, values, `col_filter_${idx}`);
  });
}

/** Khoảng ngày tạo. date_to dạng yyyy-mm-dd được tính đến cuối ngày. */
export function applyRoleDateRange(
  qb: RoleQb,
  dateFrom?: string,
  dateTo?: string,
): void {
  if (dateFrom) {
    qb.andWhere('role.createdAt >= :dateFrom', { dateFrom });
  }
  if (dateTo) {
    const dTo = dateTo.length === 10 ? `${dateTo} 23:59:59.999` : dateTo;
    qb.andWhere('role.createdAt <= :dateTo', { dateTo: dTo });
  }
}

/** Sắp xếp theo danh sách `sorts` (tiền tố '-' là giảm dần); mặc định createdAt DESC. */
export function applyRoleSorts(qb: RoleQb, sorts?: string | string[]): void {
  if (!sorts) {
    qb.orderBy('role.createdAt', 'DESC');
    return;
  }
  const sortList = Array.isArray(sorts) ? sorts : [sorts];
  let hasOrder = false;
  sortList.forEach((s) => {
    if (typeof s !== 'string' || !s.trim()) return;
    const isDesc = s.startsWith('-');
    const fieldKey = isDesc ? s.substring(1) : s;
    const sqlField = mapRoleColumnToSqlField(fieldKey);
    if (sqlField) {
      qb.addOrderBy(sqlField, isDesc ? 'DESC' : 'ASC');
      hasOrder = true;
    }
  });
  if (!hasOrder) qb.orderBy('role.createdAt', 'DESC');
}
