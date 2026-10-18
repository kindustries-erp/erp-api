import { applyMultiKeywordFilter } from '../query-builder.util';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import {
  resolveTableColumn,
  TableColumnDef,
  TableColumnMap,
} from './table-query.parse';

export interface TableSortDefault {
  sql: string;
  direction: 'ASC' | 'DESC';
}

/**
 * Sắp xếp theo tham số `sort` dạng `a,-b` (dấu `-` là giảm dần).
 * Chỉ chấp nhận key có trong whitelist; không có key hợp lệ thì dùng mặc định.
 */
export const applyTableSort = <T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  sort: string | undefined,
  columns: TableColumnMap,
  fallback: TableSortDefault,
): void => {
  const clauses = (sort ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const desc = part.startsWith('-');
      const key = desc ? part.slice(1) : part;
      const def = resolveTableColumn(columns, key);
      return def ? { sql: def.sql, direction: desc ? 'DESC' : 'ASC' } : null;
    })
    .filter((clause): clause is { sql: string; direction: 'ASC' | 'DESC' } =>
      Boolean(clause),
    );

  const ordered = clauses.length ? clauses : [fallback];
  ordered.forEach((clause, index) => {
    if (index === 0) qb.orderBy(clause.sql, clause.direction);
    else qb.addOrderBy(clause.sql, clause.direction);
  });
};

/** Biểu thức văn bản của một cột, dùng cho danh sách gợi ý và nhóm giá trị. */
const textExpression = (def: TableColumnDef): string =>
  def.type === 'text' || def.type === 'status'
    ? def.sql
    : `CAST(${def.sql} AS TEXT)`;

export interface TableOptionItem {
  label: string;
  value: string;
}

export interface TableOptionsPage {
  items: TableOptionItem[];
  total: number;
  next: number | null;
}

/**
 * Danh sách giá trị gợi ý (distinct) của một cột, phân trang.
 * `qb` phải đã áp dụng bộ lọc của các cột khác (xem `applyTableFilters` với `exceptColumn`).
 */
export const findTableColumnOptions = async <T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  def: TableColumnDef,
  search: string | undefined,
  page: number,
  pageSize: number,
  prefix = 'col_opt',
): Promise<TableOptionsPage> => {
  const expression = textExpression(def);
  const base = qb
    .clone()
    .andWhere(`${def.sql} IS NOT NULL AND ${expression} != ''`);
  const keyword = search?.trim();
  if (keyword)
    applyMultiKeywordFilter(base, expression, keyword, `${prefix}_search`);

  const countRow = await base
    .clone()
    .select(`COUNT(DISTINCT ${expression})`, 'total')
    .getRawOne<{ total: string | number }>();
  const total = Number(countRow?.total ?? 0);

  const rows = await base
    .clone()
    .select(expression, 'value')
    .groupBy(expression)
    .orderBy(expression, 'ASC')
    .offset((page - 1) * pageSize)
    .limit(pageSize)
    .getRawMany<{ value: unknown }>();

  const items = rows.map((row) => ({
    label: String(row.value),
    value: String(row.value),
  }));
  return { items, total, next: page * pageSize < total ? page + 1 : null };
};

export interface TableSummaryColumn {
  /** Tên trường trong response, khớp `V2Column.key` phía web */
  key: string;
  /** Biểu thức SQL cần cộng, ví dụ `e.amount` */
  sql: string;
}

/**
 * Tổng (SUM) của các cột số trên TOÀN BỘ dòng khớp bộ lọc, bỏ qua phân trang và sắp xếp.
 * Dùng cho ô "tổng toàn bộ" của summary row. Không có dòng nào thì trả 0.
 */
export const computeTableSummaries = async <T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  columns: TableSummaryColumn[],
): Promise<Record<string, number>> => {
  if (columns.length === 0) return {};

  const [first, ...rest] = columns;
  let aggregate = qb
    .clone()
    .orderBy()
    .offset(undefined)
    .limit(undefined)
    .select(`COALESCE(SUM(${first.sql}), 0)`, first.key);
  for (const column of rest) {
    aggregate = aggregate.addSelect(
      `COALESCE(SUM(${column.sql}), 0)`,
      column.key,
    );
  }

  const row = await aggregate.getRawOne<Record<string, unknown>>();
  return Object.fromEntries(
    columns.map((column) => [column.key, Number(row?.[column.key] ?? 0)]),
  );
};
