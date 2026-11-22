import { BadRequestException } from '@nestjs/common';
import type {
  StockVoucherUnionFilter,
  StockVoucherUnionSource,
} from '../services/stock-voucher-union-query.service';

export interface StockVoucherWhereClause {
  sql: string;
  params: unknown[];
}

export const STOCK_VOUCHER_UNION_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const STOCK_VOUCHER_UNION_SORTABLE = [
  'voucherNo',
  'voucherDate',
  'type',
  'status',
  'partnerName',
  'totalAmount',
  'createdAt',
] as const;
/** Cột được lọc theo giá trị và gợi ý giá trị (`column_filters`, `column-options`). */
export const STOCK_VOUCHER_UNION_FILTERABLE = [
  'type',
  'status',
  'partnerName',
  'voucherNo',
] as const;
export const STOCK_VOUCHER_UNION_DEFAULT_ORDER =
  'u."voucherDate" DESC, u."voucherNo" DESC, u."id" ASC';

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const TYPE_CODE = /^[A-Z][A-Z0-9_]*$/;

/** Câu SELECT chuẩn hóa một nguồn phiếu về cùng bộ cột của danh sách gộp. */
export function buildUnionSourceSql(source: StockVoucherUnionSource): string {
  const { type, table, columns: c } = source;
  if (!TYPE_CODE.test(type)) throw new Error(`Mã loại không hợp lệ: ${type}`);
  for (const name of [table, ...Object.values(c)]) {
    if (!IDENTIFIER.test(name))
      throw new Error(`Định danh không hợp lệ: ${name}`);
  }
  return (
    `SELECT t."${c.id}"::text AS "id", '${type}'::text AS "type", ` +
    `t."${c.voucherNo}"::text AS "voucherNo", t."${c.voucherDate}"::timestamptz AS "voucherDate", ` +
    `t."${c.status}"::text AS "status", t."${c.partnerName}"::text AS "partnerName", ` +
    `t."${c.branchId}"::text AS "branchId", COALESCE(t."${c.totalAmount}", 0)::numeric AS "totalAmount", ` +
    `t."${c.remarks}"::text AS "remarks", t."${c.createdAt}"::timestamptz AS "createdAt" ` +
    `FROM "${table}" t WHERE t."is_deleted" = false`
  );
}

/**
 * Dựng WHERE trên bảng gộp `u`. `exclude` bỏ qua bộ lọc của chính cột đang lấy gợi ý
 * hoặc đếm theo loại. Giá trị luôn đi qua tham số, tên cột lấy từ whitelist.
 */
export function buildVoucherWhere(
  filter: StockVoucherUnionFilter,
  types: readonly string[],
  exclude?: string,
): StockVoucherWhereClause {
  const conds: string[] = [];
  const params: unknown[] = [];
  const add = (value: unknown) => `$${params.push(value)}`;
  const byColumn = parseColumnFilters(filter.column_filters);

  if (filter.type && exclude !== 'type') {
    if (!types.includes(filter.type)) {
      throw new BadRequestException(`Loại phiếu không hợp lệ: ${filter.type}`);
    }
    conds.push(`u."type" = ${add(filter.type)}`);
  }
  if (filter.status && exclude !== 'status') {
    conds.push(`u."status" = ${add(filter.status)}`);
  }
  const term = filter.search?.trim();
  if (term) {
    const p = add(`%${escapeLike(term)}%`);
    conds.push(
      `(u."voucherNo" ILIKE ${p} OR u."partnerName" ILIKE ${p} OR u."remarks" ILIKE ${p})`,
    );
  }
  const day = `(u."voucherDate" AT TIME ZONE '${STOCK_VOUCHER_UNION_TIME_ZONE}')::date`;
  if (filter.dateFrom) conds.push(`${day} >= ${add(filter.dateFrom)}::date`);
  if (filter.dateTo) conds.push(`${day} <= ${add(filter.dateTo)}::date`);
  for (const [column, values] of Object.entries(byColumn)) {
    if (column === exclude) continue;
    conds.push(`u."${column}" = ANY(${add(values)}::text[])`);
  }
  return { sql: conds.length ? ` WHERE ${conds.join(' AND ')}` : '', params };
}

/** Đọc `column_filters` (JSON object), chỉ giữ các cột được phép lọc. */
export function parseColumnFilters(raw?: string): Record<string, string[]> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('column_filters không phải JSON hợp lệ');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BadRequestException('column_filters phải là object');
  }
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!(STOCK_VOUCHER_UNION_FILTERABLE as readonly string[]).includes(key))
      continue;
    const values = (Array.isArray(value) ? value : [value])
      .filter((v): v is string | number =>
        ['string', 'number'].includes(typeof v),
      )
      .map(String);
    if (values.length) result[key] = values;
  }
  return result;
}

/** Sắp xếp từ `sort` (chỉ cột trong whitelist), mặc định theo ngày và số phiếu. */
export function buildVoucherOrder(sort?: string): string {
  const parts: string[] = [];
  for (const token of (sort ?? '').split(',')) {
    const desc = token.trim().startsWith('-');
    const key = token.trim().replace(/^-/, '');
    if ((STOCK_VOUCHER_UNION_SORTABLE as readonly string[]).includes(key)) {
      parts.push(`u."${key}" ${desc ? 'DESC' : 'ASC'}`);
    }
  }
  if (!parts.length) return STOCK_VOUCHER_UNION_DEFAULT_ORDER;
  return `${parts.join(', ')}, u."voucherNo" DESC, u."id" ASC`;
}

/** Escape ký tự đặc biệt của LIKE/ILIKE. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
