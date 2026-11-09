import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { computeTableSummaries, TableSummaryColumn } from './table-query.query';

/**
 * Số liệu tổng của một cột, theo đúng sort và bộ lọc đang áp dụng:
 * - `total`: tổng toàn bộ dòng khớp.
 * - `pageSubtotal`: tổng riêng trang hiện tại.
 * - `cumulative`: tổng từ dòng 1 đến hết trang hiện tại.
 */
export interface SummaryMetric {
  total: number;
  pageSubtotal: number;
  cumulative: number;
}

export const SUMMARY_KEYS_LIMIT = 10;

/** Tách `summary_keys` dạng CSV: bỏ khoảng trắng, bỏ trống, bỏ trùng, tối đa 10 key. */
export const parseSummaryKeys = (raw: unknown): string[] => {
  if (typeof raw !== 'string') return [];
  const keys = raw
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
  return [...new Set(keys)].slice(0, SUMMARY_KEYS_LIMIT);
};

export interface ApplyListSummariesOptions {
  /** Whitelist cột được phép tính. SQL chỉ lấy từ đây, không lấy từ input. */
  columns: TableSummaryColumn[];
  /** Key do client gửi lên (đã qua `parseSummaryKeys`). */
  keys: string[];
  page: number;
  pageSize: number;
  /** Cột bảo đảm thứ tự ổn định khi sort trùng giá trị, ví dụ `h.id`. */
  tieBreaker: string;
}

/**
 * Tính `summaries` cho một list V2 dùng chung cho mọi module.
 * Key không có trong whitelist (hoặc không tính được) trả `null`, không báo lỗi.
 * `qb` phải là truy vấn một bảng (không join nhân dòng) và đã có `orderBy` như list.
 */
export const applyListSummaries = async <T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  options: ApplyListSummariesOptions,
): Promise<Record<string, SummaryMetric | null>> => {
  const { columns, keys, tieBreaker } = options;
  const page = Math.max(1, Math.floor(options.page) || 1);
  const pageSize = Math.max(1, Math.floor(options.pageSize) || 1);

  const byKey = new Map(columns.map((column) => [column.key, column]));
  const result: Record<string, SummaryMetric | null> = Object.fromEntries(
    keys.map((key) => [key, null]),
  );
  const valid = keys
    .map((key) => byKey.get(key))
    .filter((column): column is TableSummaryColumn => Boolean(column));
  if (valid.length === 0) return result;

  const ordered = qb.clone().addOrderBy(tieBreaker, 'ASC');
  const totals = await computeTableSummaries(qb, valid);
  const cumulative = await sumFirstRows(ordered, valid, page * pageSize);
  const pageSlice =
    page > 1
      ? await sumRowSlice(ordered, valid, (page - 1) * pageSize, pageSize)
      : cumulative;

  for (const column of valid) {
    result[column.key] = {
      total: totals[column.key] ?? 0,
      pageSubtotal: pageSlice[column.key] ?? 0,
      cumulative: cumulative[column.key] ?? 0,
    };
  }
  return result;
};

/** Tổng các cột trên `limit` dòng đầu tiên theo thứ tự đã sort. */
const sumFirstRows = <T extends ObjectLiteral>(
  ordered: SelectQueryBuilder<T>,
  columns: TableSummaryColumn[],
  limit: number,
): Promise<Record<string, number>> => sumRowSlice(ordered, columns, 0, limit);

/** Tổng các cột trên một đoạn `[offset, offset + limit)` theo thứ tự đã sort. */
const sumRowSlice = async <T extends ObjectLiteral>(
  ordered: SelectQueryBuilder<T>,
  columns: TableSummaryColumn[],
  offset: number,
  limit: number,
): Promise<Record<string, number>> => {
  const [first, ...rest] = columns;
  let inner = ordered.clone().select(first.sql, 'v0');
  rest.forEach((column, index) => {
    inner = inner.addSelect(column.sql, `v${index + 1}`);
  });
  if (offset > 0) inner = inner.offset(offset);
  inner = inner.limit(limit);

  let outer = ordered
    .createQueryBuilder()
    .select('COALESCE(SUM(t."v0"), 0)', 's0');
  columns.slice(1).forEach((_, index) => {
    outer = outer.addSelect(
      `COALESCE(SUM(t."v${index + 1}"), 0)`,
      `s${index + 1}`,
    );
  });
  const row = await outer
    .from(`(${inner.getQuery()})`, 't')
    .setParameters(inner.getParameters())
    .getRawOne<Record<string, unknown>>();

  return Object.fromEntries(
    columns.map((column, index) => [
      column.key,
      Number(row?.[`s${index}`] ?? 0),
    ]),
  );
};
