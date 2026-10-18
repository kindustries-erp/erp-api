/**
 * Kiểu dữ liệu và parser dùng chung cho bảng server-side (V1 và V2 `V2StandardTable`).
 * Hàm thuần, không gọi DB.
 */

export type TableColumnType = 'text' | 'status' | 'number' | 'date';

/** `sql` là biểu thức SQL đã đủ alias (ví dụ `bp.code`), không nhận input từ client. */
export interface TableColumnDef {
  sql: string;
  type: TableColumnType;
}

/** Key là tên cột phía client (camelCase và snake_case đều được khai báo). */
export type TableColumnMap = Record<string, TableColumnDef>;

export const TABLE_BLANK_VALUE = '__BLANK__';
export const TABLE_ALL_MATCHING_VALUE = '__ALL_MATCHING__';

export interface TableOperatorFilter {
  operator: string;
  value?: string;
  valueTo?: string;
}

export interface TableDateRange {
  from?: string;
  to?: string;
}

export interface TableFilterPayload {
  columnFilters?: Record<string, string[]>;
  columnSearch?: Record<string, string>;
  columnOperators?: Record<string, TableOperatorFilter>;
  dateRanges?: Record<string, TableDateRange>;
}

const OPERATORS_BY_TYPE: Record<TableColumnType, ReadonlySet<string>> = {
  text: new Set([
    'contains',
    'not_contains',
    'starts_with',
    'ends_with',
    'equals',
    'not_equals',
    'is_empty',
    'is_not_empty',
  ]),
  status: new Set(['equals', 'not_equals', 'is_empty', 'is_not_empty']),
  number: new Set([
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'between',
    'is_empty',
    'is_not_empty',
  ]),
  date: new Set([
    'eq',
    'before',
    'after',
    'between',
    'is_empty',
    'is_not_empty',
  ]),
};

/** Operator có áp dụng được cho kiểu cột không. Sai kiểu thì bị bỏ qua, không gây lỗi SQL. */
export const isOperatorAllowed = (
  type: TableColumnType,
  operator: string,
): boolean => OPERATORS_BY_TYPE[type].has(operator);

/** Tra cứu cột theo key; key không có trong whitelist trả về null. */
export const resolveTableColumn = (
  columns: TableColumnMap,
  key: string,
): TableColumnDef | null =>
  Object.prototype.hasOwnProperty.call(columns, key) ? columns[key] : null;

export const parseFilterRecord = <T>(raw: unknown): T | undefined => {
  if (!raw) return undefined;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string') return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as T) : undefined;
  } catch {
    return undefined;
  }
};

const VN_OFFSET = '+07:00';

/**
 * Chuỗi `YYYY-MM-DD` thành mốc đầu/cuối ngày theo giờ Việt Nam.
 * Trả về null nếu sai định dạng hoặc không phải ngày hợp lệ.
 */
export const parseVietnamDate = (
  value: string | undefined,
  endOfDay = false,
): Date | null => {
  const normalized = value?.trim() ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
  const date = new Date(`${normalized}T${time}${VN_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Chuỗi số thành number hữu hạn, sai thì null. */
export const parseFiniteNumber = (value: string | undefined): number | null => {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
};
