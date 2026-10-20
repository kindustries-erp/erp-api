import { Brackets, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { applyMultiKeywordFilter } from '../query-builder.util';
import {
  isOperatorAllowed,
  parseFiniteNumber,
  parseVietnamDate,
  resolveTableColumn,
  TABLE_ALL_MATCHING_VALUE,
  TABLE_BLANK_VALUE,
  TableColumnDef,
  TableColumnMap,
  TableFilterPayload,
  TableOperatorFilter,
} from './table-query.parse';

const isBlankCondition = (def: TableColumnDef): string =>
  def.type === 'text' || def.type === 'status'
    ? `(${def.sql} IS NULL OR ${def.sql} = '')`
    : `${def.sql} IS NULL`;

const isNotBlankCondition = (def: TableColumnDef): string =>
  def.type === 'text' || def.type === 'status'
    ? `(${def.sql} IS NOT NULL AND ${def.sql} != '')`
    : `${def.sql} IS NOT NULL`;

/** Biểu thức so khớp giá trị chọn trong bộ lọc, đã đổi về đúng kiểu so sánh. */
const selectionExpression = (def: TableColumnDef): string => {
  if (def.type === 'date') return `TO_CHAR(${def.sql}, 'YYYY-MM-DD')`;
  if (def.type === 'number') return `CAST(${def.sql} AS TEXT)`;
  return def.sql;
};

const applySearch = <T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  def: TableColumnDef,
  value: string,
  param: string,
) => {
  const field =
    def.type === 'text' || def.type === 'status'
      ? def.sql
      : `CAST(${def.sql} AS TEXT)`;
  applyMultiKeywordFilter(qb, field, value, param);
};

const applySelection = <T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  def: TableColumnDef,
  values: string[],
  param: string,
) => {
  if (values[0] === TABLE_ALL_MATCHING_VALUE) {
    const keyword = values[1]?.trim();
    if (keyword) applySearch(qb, def, keyword, param);
    return;
  }

  const hasBlank = values.includes(TABLE_BLANK_VALUE);
  const rawSelected = values.filter((v) => v !== TABLE_BLANK_VALUE);
  const selected =
    def.type === 'number'
      ? rawSelected
          .map((v) => parseFiniteNumber(v))
          .filter((v): v is number => v !== null)
      : rawSelected;
  const hasSelected = selected.length > 0;
  const expression = selectionExpression(def);

  if (hasBlank && hasSelected) {
    qb.andWhere(
      new Brackets((nested) =>
        nested
          .where(`${expression} IN (:...${param})`, { [param]: selected })
          .orWhere(isBlankCondition(def)),
      ),
    );
  } else if (hasBlank) {
    qb.andWhere(isBlankCondition(def));
  } else if (hasSelected) {
    qb.andWhere(`${expression} IN (:...${param})`, { [param]: selected });
  }
};

const applyTextOperator = <T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  def: TableColumnDef,
  filter: TableOperatorFilter,
  param: string,
) => {
  const value = filter.value?.trim() ?? '';
  if (!value) return;

  switch (filter.operator) {
    case 'contains':
      qb.andWhere(`${def.sql} ILIKE :${param}`, { [param]: `%${value}%` });
      return;
    case 'not_contains':
      qb.andWhere(`${def.sql} NOT ILIKE :${param}`, { [param]: `%${value}%` });
      return;
    case 'starts_with':
      qb.andWhere(`${def.sql} ILIKE :${param}`, { [param]: `${value}%` });
      return;
    case 'ends_with':
      qb.andWhere(`${def.sql} ILIKE :${param}`, { [param]: `%${value}` });
      return;
    case 'equals':
      qb.andWhere(`LOWER(${def.sql}) = LOWER(:${param})`, { [param]: value });
      return;
    case 'not_equals':
      qb.andWhere(`LOWER(${def.sql}) <> LOWER(:${param})`, { [param]: value });
      return;
    default:
      return;
  }
};

const applyNumberOperator = <T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  def: TableColumnDef,
  filter: TableOperatorFilter,
  param: string,
) => {
  const value = parseFiniteNumber(filter.value);
  if (value === null) return;

  const comparisons: Record<string, string> = {
    eq: '=',
    neq: '<>',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
  };
  const sign = comparisons[filter.operator];
  if (sign) {
    qb.andWhere(`${def.sql} ${sign} :${param}`, { [param]: value });
    return;
  }
  if (filter.operator === 'between') {
    const upper = parseFiniteNumber(filter.valueTo);
    if (upper === null) return;
    qb.andWhere(`${def.sql} BETWEEN :${param}_from AND :${param}_to`, {
      [`${param}_from`]: value,
      [`${param}_to`]: upper,
    });
  }
};

const applyDateOperator = <T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  def: TableColumnDef,
  filter: TableOperatorFilter,
  param: string,
) => {
  const start = parseVietnamDate(filter.value);
  const end = parseVietnamDate(filter.value, true);
  if (!start || !end) return;

  switch (filter.operator) {
    case 'eq':
      qb.andWhere(`${def.sql} BETWEEN :${param}_from AND :${param}_to`, {
        [`${param}_from`]: start,
        [`${param}_to`]: end,
      });
      return;
    case 'before':
      qb.andWhere(`${def.sql} < :${param}`, { [param]: start });
      return;
    case 'after':
      qb.andWhere(`${def.sql} > :${param}`, { [param]: end });
      return;
    case 'between': {
      const rangeEnd = parseVietnamDate(filter.valueTo, true);
      if (!rangeEnd) return;
      qb.andWhere(`${def.sql} BETWEEN :${param}_from AND :${param}_to`, {
        [`${param}_from`]: start,
        [`${param}_to`]: rangeEnd,
      });
      return;
    }
    default:
      return;
  }
};

const applyOperator = <T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  def: TableColumnDef,
  filter: TableOperatorFilter,
  param: string,
) => {
  if (!isOperatorAllowed(def.type, filter.operator)) return;
  if (filter.operator === 'is_empty') {
    qb.andWhere(isBlankCondition(def));
    return;
  }
  if (filter.operator === 'is_not_empty') {
    qb.andWhere(isNotBlankCondition(def));
    return;
  }
  if (def.type === 'number') applyNumberOperator(qb, def, filter, param);
  else if (def.type === 'date') applyDateOperator(qb, def, filter, param);
  else applyTextOperator(qb, def, filter, param);
};

/** Khoảng ngày `from..to` (theo giờ VN) cho một cột kiểu date. */
export const applyDateBounds = <T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  sql: string,
  from: string | undefined,
  to: string | undefined,
  param: string,
) => {
  const start = parseVietnamDate(from);
  const end = parseVietnamDate(to, true);
  if (start)
    qb.andWhere(`${sql} >= :${param}_from`, { [`${param}_from`]: start });
  if (end) qb.andWhere(`${sql} <= :${param}_to`, { [`${param}_to`]: end });
};

/**
 * Áp dụng toàn bộ bộ lọc cột (search, chọn giá trị, operator, khoảng ngày) lên query builder.
 * `exceptColumn` bỏ qua bộ lọc của chính cột đang lấy danh sách gợi ý (cascading options).
 */
export const applyTableFilters = <T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  payload: TableFilterPayload,
  columns: TableColumnMap,
  prefix: string,
  exceptColumn?: string,
): void => {
  const isSkipped = (key: string) => key === exceptColumn;

  Object.entries(payload.columnSearch ?? {}).forEach(([key, value], index) => {
    const def = resolveTableColumn(columns, key);
    if (!def || isSkipped(key) || !value?.trim()) return;
    applySearch(qb, def, value.trim(), `${prefix}_search_${index}`);
  });

  Object.entries(payload.columnFilters ?? {}).forEach(
    ([key, values], index) => {
      const def = resolveTableColumn(columns, key);
      if (!def || isSkipped(key) || !Array.isArray(values) || !values.length)
        return;
      applySelection(qb, def, values, `${prefix}_select_${index}`);
    },
  );

  Object.entries(payload.columnOperators ?? {}).forEach(
    ([key, filter], index) => {
      const def = resolveTableColumn(columns, key);
      if (!def || isSkipped(key) || !filter || typeof filter !== 'object')
        return;
      applyOperator(qb, def, filter, `${prefix}_operator_${index}`);
    },
  );

  Object.entries(payload.dateRanges ?? {}).forEach(([key, range], index) => {
    const def = resolveTableColumn(columns, key);
    if (!def || def.type !== 'date' || isSkipped(key) || !range) return;
    applyDateBounds(
      qb,
      def.sql,
      range.from,
      range.to,
      `${prefix}_range_${index}`,
    );
  });
};
