import { SelectQueryBuilder } from 'typeorm';
import { applyMultiKeywordFilter } from '@/common/utils/query-builder.util';
import { CashflowForecast } from '@/v2/core/cashflow-core';

/**
 * Lọc cột, tìm kiếm và sắp xếp của danh sách tương thích (port từ engine cũ).
 * Alias: f = cashflow_forecasts, ext = cashflow_garage_forecast_ext, kc = kgara_cases (chỉ đọc).
 * Hành vi giữ như cũ: JSON lỗi bị bỏ qua; giá trị "__BLANK__" nghĩa là "trống".
 */

export const BLANK = '__BLANK__';

type Qb = SelectQueryBuilder<CashflowForecast>;

/** Parse JSON tham số. Lỗi hoặc không phải object thì trả object rỗng (như engine cũ). */
export function parseLegacyJson(value?: string): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // bỏ qua, như engine cũ
  }
  return {};
}

/** RECEIPT/PAYMENT (cũ) -> IN/OUT (mới). Giá trị lạ trả null. */
export function toDirection(voucherType: string): 'IN' | 'OUT' | null {
  if (voucherType === 'RECEIPT') return 'IN';
  if (voucherType === 'PAYMENT') return 'OUT';
  return null;
}

/**
 * Điều kiện cho một nhãn paymentStatus cũ, theo bảng map ngược của toLegacyPaymentStatus.
 * Trả null nếu nhãn không thuộc bảng.
 */
export function paymentStatusCondition(
  label: string,
  paramName: string,
): { sql: string; params: Record<string, unknown> } | null {
  switch (label) {
    case 'EXPECTED':
      return {
        sql: `(f.direction = 'IN' AND f.status IN (:...${paramName}))`,
        params: {
          [paramName]: [
            'DRAFT',
            'OPEN',
            'PARTIAL',
            'PENDING_APPROVAL',
            'REJECTED',
          ],
        },
      };
    case 'PENDING':
      return {
        sql: `(f.direction = 'OUT' AND f.status IN (:...${paramName}))`,
        params: { [paramName]: ['DRAFT', 'PENDING_APPROVAL', 'REJECTED'] },
      };
    case 'APPROVED':
      return {
        sql: `(f.direction = 'OUT' AND f.status IN (:...${paramName}))`,
        params: { [paramName]: ['OPEN', 'PARTIAL'] },
      };
    case 'PAID':
      return {
        sql: `(f.status = :${paramName})`,
        params: { [paramName]: 'SETTLED' },
      };
    case 'CANCELLED':
      return {
        sql: `(f.status = :${paramName})`,
        params: { [paramName]: 'CANCELLED' },
      };
    default:
      return null;
  }
}

/** Biểu thức "IN (...)" với nhóm trống: có "__BLANK__" thì gộp điều kiện IS NULL / = ''. */
function inOrBlank(expr: string, values: string[], p: string): string | null {
  const hasBlank = values.includes(BLANK);
  const nonBlank = values.filter((v) => v !== BLANK);
  if (hasBlank && nonBlank.length > 0) {
    return `(${expr} IN (:...${p}) OR ${expr} IS NULL OR ${expr} = '')`;
  }
  if (hasBlank) return `(${expr} IS NULL OR ${expr} = '')`;
  return `${expr} IN (:...${p})`;
}

function paramsFor(values: string[], p: string): Record<string, unknown> {
  return { [p]: values.filter((v) => v !== BLANK) };
}

function applyRange(
  qb: Qb,
  expr: string,
  range: string,
  p: string,
  toEnd: (v: string) => string = (v) => v,
): void {
  const [from, to] = range.split('..');
  if (from) qb.andWhere(`${expr} >= :${p}From`, { [`${p}From`]: from });
  if (to) qb.andWhere(`${expr} <= :${p}To`, { [`${p}To`]: toEnd(to) });
}

function applyNumberFilter(
  qb: Qb,
  direction: 'IN' | 'OUT',
  values: string[],
  p: string,
): void {
  qb.andWhere(`f.direction = '${direction}'`);
  if (values[0]?.includes('..')) {
    const [from, to] = values[0].split('..');
    if (from)
      qb.andWhere(`f.amount >= :${p}From`, { [`${p}From`]: Number(from) });
    if (to) qb.andWhere(`f.amount <= :${p}To`, { [`${p}To`]: Number(to) });
  } else {
    qb.andWhere(`f.amount IN (:...${p})`, { [p]: values.map(Number) });
  }
}

function applyColumnFilter(
  qb: Qb,
  col: string,
  arr: string[],
  i: number,
): void {
  const p = `cf${i}`;
  switch (col) {
    case 'voucherType': {
      const dirs = arr
        .map((v) => toDirection(v))
        .filter((d): d is 'IN' | 'OUT' => d !== null);
      if (dirs.length > 0)
        qb.andWhere(`f.direction IN (:...${p})`, { [p]: dirs });
      return;
    }
    case 'transDate':
      applyRange(qb, 'f.planned_date', arr[0], p);
      return;
    case 'createdAt':
      applyRange(qb, 'f.created_at', arr[0], p, (v) => `${v} 23:59:59`);
      return;
    case 'thu':
      applyNumberFilter(qb, 'IN', arr, p);
      return;
    case 'chi':
      applyNumberFilter(qb, 'OUT', arr, p);
      return;
    case 'caseCode': {
      const sql = inOrBlank('kc.so_chung_tu', arr, p);
      if (sql) qb.andWhere(sql, paramsFor(arr, p));
      return;
    }
    case 'voucherCode':
      qb.andWhere(`f.code IN (:...${p})`, { [p]: arr });
      return;
    case 'partnerName': {
      const hasBlank = arr.includes(BLANK);
      const nonBlank = arr.filter((v) => v !== BLANK);
      const co = 'COALESCE(f.partner_name, kc.khach_hang_name)';
      if (hasBlank && nonBlank.length > 0) {
        qb.andWhere(
          `((f.partner_name IN (:...${p}) OR kc.khach_hang_name IN (:...${p})) OR (${co} IS NULL OR ${co} = ''))`,
          { [p]: nonBlank },
        );
      } else if (hasBlank) {
        qb.andWhere(`(${co} IS NULL OR ${co} = '')`);
      } else {
        qb.andWhere(
          `(f.partner_name IN (:...${p}) OR kc.khach_hang_name IN (:...${p}))`,
          { [p]: arr },
        );
      }
      return;
    }
    case 'licensePlate': {
      const hasBlank = arr.includes(BLANK);
      const nonBlank = arr.filter((v) => v !== BLANK);
      const co = 'COALESCE(ext.license_plate, kc.bien_so_xe)';
      if (hasBlank && nonBlank.length > 0) {
        qb.andWhere(
          `((ext.license_plate IN (:...${p}) OR kc.bien_so_xe IN (:...${p})) OR (${co} IS NULL OR ${co} = ''))`,
          { [p]: nonBlank },
        );
      } else if (hasBlank) {
        qb.andWhere(`(${co} IS NULL OR ${co} = '')`);
      } else {
        qb.andWhere(
          `(ext.license_plate IN (:...${p}) OR kc.bien_so_xe IN (:...${p}))`,
          { [p]: arr },
        );
      }
      return;
    }
    case 'paymentMethod':
      qb.andWhere(`ext.legacy_payment_method IN (:...${p})`, { [p]: arr });
      return;
    case 'paymentContent': {
      const sql = inOrBlank('ext.payment_content', arr, p);
      if (sql) qb.andWhere(sql, paramsFor(arr, p));
      return;
    }
    case 'paymentStatus': {
      const parts = arr
        .map((label, j) => paymentStatusCondition(label, `${p}_${j}`))
        .filter((x): x is NonNullable<typeof x> => x !== null);
      if (parts.length === 0) return;
      const params = parts.reduce(
        (acc, part) => ({ ...acc, ...part.params }),
        {},
      );
      qb.andWhere(`(${parts.map((x) => x.sql).join(' OR ')})`, params);
      return;
    }
    case 'note': {
      const sql = inOrBlank('f.note', arr, p);
      if (sql) qb.andWhere(sql, paramsFor(arr, p));
      return;
    }
    default:
      return;
  }
}

/** Áp lọc cột. Cột không biết thì bỏ qua, như engine cũ. */
export function applyLegacyColumnFilters(qb: Qb, raw?: string): void {
  Object.entries(parseLegacyJson(raw)).forEach(([col, vals], i) => {
    const arr = Array.isArray(vals) ? (vals as string[]) : [];
    if (arr.length === 0) return;
    applyColumnFilter(qb, col, arr, i);
  });
}

const SEARCH_FIELDS: Record<string, string> = {
  voucherCode: 'f.code',
  partnerName: 'COALESCE(f.partner_name, kc.khach_hang_name)',
  licensePlate: 'COALESCE(ext.license_plate, kc.bien_so_xe)',
  paymentMethod: 'ext.legacy_payment_method',
  paymentContent: 'ext.payment_content',
  note: 'f.note',
  caseCode: 'kc.so_chung_tu',
};

/** Tìm kiếm theo cột, nhiều từ khóa ngăn cách ";". */
export function applyLegacyColumnSearch(qb: Qb, raw?: string): void {
  Object.entries(parseLegacyJson(raw)).forEach(([col, val], i) => {
    const expr = SEARCH_FIELDS[col];
    if (!expr || typeof val !== 'string' || !val) return;
    applyMultiKeywordFilter(qb, expr, val, `ls${i}`);
  });
}

const SORT_FIELDS: Record<string, string> = {
  voucherCode: 'f.code',
  createdAt: 'f.createdAt',
  amount: 'f.amount',
  caseCode: 'kc.soChungTu',
  transDate: 'f.plannedDate',
  partnerName: 'f.partnerName',
  licensePlate: 'ext.licensePlate',
  paymentMethod: 'ext.legacyPaymentMethod',
  paymentContent: 'ext.paymentContent',
};

/**
 * Sắp xếp theo `sorts` (chuỗi "a,-b" hoặc mảng). Không có cột hợp lệ thì dùng mặc định
 * ngày giao dịch giảm dần, rồi ngày tạo, rồi mã. Có sắp xếp thì luôn thêm ngày tạo và mã làm khóa phụ.
 */
export function applyLegacySorts(qb: Qb, sorts?: string | string[]): void {
  const list = Array.isArray(sorts)
    ? sorts
    : typeof sorts === 'string'
      ? sorts.split(',')
      : [];

  let hasSort = false;
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const desc = trimmed.startsWith('-');
    const field = desc ? trimmed.slice(1) : trimmed;
    if (field === 'voucherType') {
      qb.addOrderBy(
        "CASE WHEN f.direction = 'IN' THEN 'RECEIPT' ELSE 'PAYMENT' END",
        desc ? 'DESC' : 'ASC',
      );
      hasSort = true;
      continue;
    }
    const expr = SORT_FIELDS[field];
    if (expr) {
      qb.addOrderBy(expr, desc ? 'DESC' : 'ASC');
      hasSort = true;
    }
  }

  if (hasSort) {
    qb.addOrderBy('f.createdAt', 'DESC').addOrderBy('f.code', 'DESC');
  } else {
    qb.orderBy('f.plannedDate', 'DESC')
      .addOrderBy('f.createdAt', 'DESC')
      .addOrderBy('f.code', 'DESC');
  }
}
