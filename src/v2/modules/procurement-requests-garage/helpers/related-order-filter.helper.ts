import {
  Brackets,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import {
  TABLE_ALL_MATCHING_VALUE,
  TABLE_BLANK_VALUE,
  TableFilterPayload,
  TableOperatorFilter,
} from '@/common/utils/table-query';
import { GarageProcurementOrder } from '@/v2/modules/procurement-orders-garage/entities/procurement-order.entity';

/** Key cột "Đơn mua liên quan" phía web. Không nằm trong TABLE_COLUMNS vì quan hệ 1-N. */
export const RELATED_ORDERS_KEY = 'relatedOrders';

type Cond = [string, Record<string, unknown>];

/**
 * Subquery PO còn hiệu lực của đề nghị (h = đề nghị ngoài), tùy chọn thêm một điều kiện trên `o.orderNo`.
 * Dùng EXISTS/NOT EXISTS để khớp "có ít nhất một PO" thay vì so khớp từng dòng.
 */
const linkedOrders = (
  orders: Repository<GarageProcurementOrder>,
  cond?: Cond,
) => {
  const sub = orders
    .createQueryBuilder('o')
    .select('1')
    .where('o.requestId = h.id')
    .andWhere('o.isDeleted = false');
  if (cond) sub.andWhere(cond[0], cond[1]);
  return sub;
};

const exists = (
  orders: Repository<GarageProcurementOrder>,
  cond: Cond | undefined,
  negate: boolean,
) => {
  const sub = linkedOrders(orders, cond);
  return {
    sql: `${negate ? 'NOT ' : ''}EXISTS (${sub.getQuery()})`,
    params: sub.getParameters(),
  };
};

const operatorCond = (
  filter: TableOperatorFilter,
  param: string,
): Cond | null => {
  const value = filter.value?.trim() ?? '';
  switch (filter.operator) {
    case 'contains':
    case 'not_contains':
      return value
        ? [`o.orderNo ILIKE :${param}`, { [param]: `%${value}%` }]
        : null;
    case 'starts_with':
      return value
        ? [`o.orderNo ILIKE :${param}`, { [param]: `${value}%` }]
        : null;
    case 'ends_with':
      return value
        ? [`o.orderNo ILIKE :${param}`, { [param]: `%${value}` }]
        : null;
    case 'equals':
    case 'not_equals':
      return value
        ? [`LOWER(o.orderNo) = LOWER(:${param})`, { [param]: value }]
        : null;
    default:
      return null;
  }
};

/**
 * Áp bộ lọc cột "Đơn mua liên quan" lên danh sách đề nghị (alias h).
 * Chọn giá trị, tìm kiếm và toán tử đều khớp theo "có PO nào thỏa điều kiện".
 */
export function applyRelatedOrderFilter<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  orders: Repository<GarageProcurementOrder>,
  payload: TableFilterPayload,
  prefix: string,
): void {
  const selectedRaw = payload.columnFilters?.[RELATED_ORDERS_KEY];
  if (Array.isArray(selectedRaw) && selectedRaw.length) {
    const isAll = selectedRaw[0] === TABLE_ALL_MATCHING_VALUE;
    const keyword = isAll ? selectedRaw[1]?.trim() : undefined;
    if (isAll) {
      if (keyword) {
        const cond: Cond = [
          `o.orderNo ILIKE :${prefix}_all`,
          { [`${prefix}_all`]: `%${keyword}%` },
        ];
        const e = exists(orders, cond, false);
        qb.andWhere(e.sql, e.params);
      }
    } else {
      const hasBlank = selectedRaw.includes(TABLE_BLANK_VALUE);
      const values = selectedRaw.filter((v) => v !== TABLE_BLANK_VALUE);
      const matchCond: Cond | undefined = values.length
        ? [`o.orderNo IN (:...${prefix}_vals)`, { [`${prefix}_vals`]: values }]
        : undefined;
      if (hasBlank && matchCond) {
        const match = exists(orders, matchCond, false);
        const none = exists(orders, undefined, true);
        qb.andWhere(
          new Brackets((b) =>
            b.where(match.sql, match.params).orWhere(none.sql, none.params),
          ),
        );
      } else if (hasBlank) {
        const none = exists(orders, undefined, true);
        qb.andWhere(none.sql, none.params);
      } else if (matchCond) {
        const e = exists(orders, matchCond, false);
        qb.andWhere(e.sql, e.params);
      }
    }
  }

  const search = payload.columnSearch?.[RELATED_ORDERS_KEY]?.trim();
  if (search) {
    const cond: Cond = [
      `o.orderNo ILIKE :${prefix}_search`,
      { [`${prefix}_search`]: `%${search}%` },
    ];
    const e = exists(orders, cond, false);
    qb.andWhere(e.sql, e.params);
  }

  const operator = payload.columnOperators?.[RELATED_ORDERS_KEY];
  if (operator && typeof operator === 'object') {
    if (operator.operator === 'is_empty') {
      const e = exists(orders, undefined, true);
      qb.andWhere(e.sql, e.params);
    } else if (operator.operator === 'is_not_empty') {
      const e = exists(orders, undefined, false);
      qb.andWhere(e.sql, e.params);
    } else {
      const cond = operatorCond(operator, `${prefix}_op`);
      if (cond) {
        const negate =
          operator.operator === 'not_contains' ||
          operator.operator === 'not_equals';
        const e = exists(orders, cond, negate);
        qb.andWhere(e.sql, e.params);
      }
    }
  }
}
