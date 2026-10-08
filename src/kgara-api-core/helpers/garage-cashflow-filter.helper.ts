import { Brackets, SelectQueryBuilder, Repository } from 'typeorm';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { applyMultiKeywordFilter } from '../../common/utils/query-builder.util';

/**
 * Ánh xạ tên cột từ Frontend sang biểu thức Entity Property trên KgaraCaseSettlement và join relations
 */
export function getGarageCashflowColumnSelectExpr(
  column: string,
): string | null {
  const mapping: Record<string, string> = {
    settlementType: 's.settlementType',
    sourceChannel: 's.sourceChannel',
    paymentMethod: 's.paymentMethod',
    amount: 's.amount',
    transDate: 's.transDate',
    partnerName: 's.partnerName',
    payerType: 's.payerType',
    receiptNumber: 's.receiptNumber',
    category: 's.category',
    note: 's.note',
    caseCode: 'c.soChungTu',
    soChungTu: 'c.soChungTu',
    licensePlate: 'c.bienSoXe',
    bienSoXe: 'c.bienSoXe',
    hasBankTxn:
      "CASE WHEN s.bankTransactionId IS NOT NULL THEN 'YES' ELSE 'NO' END",
    createdAt: 's.createdAt',
  };
  return mapping[column] || null;
}

/**
 * Áp dụng bộ lọc statusTab cho query
 */
export function applyGarageCashflowStatusTab(
  qb: SelectQueryBuilder<KgaraCaseSettlement>,
  statusTab?: string,
): void {
  if (!statusTab || statusTab === 'all') return;

  if (statusTab === 'receipt') {
    qb.andWhere('s.settlementType = :stTab', { stTab: 'RECEIPT' });
  } else if (statusTab === 'payment') {
    qb.andWhere('s.settlementType = :stTab', { stTab: 'PAYMENT' });
  } else if (statusTab === 'with_bank') {
    qb.andWhere('s.bankTransactionId IS NOT NULL');
  } else if (statusTab === 'no_bank') {
    qb.andWhere('s.bankTransactionId IS NULL');
  }
}

/**
 * Áp dụng bộ lọc cho từng cột từ JSON filtersStr
 */
export function applyGarageCashflowFilters(
  qb: SelectQueryBuilder<KgaraCaseSettlement>,
  filtersStr?: string,
  statusTab?: string,
): void {
  applyGarageCashflowStatusTab(qb, statusTab);

  if (!filtersStr) return;

  try {
    const rawFilters =
      typeof filtersStr === 'string' ? JSON.parse(filtersStr) : filtersStr;

    if (!rawFilters || typeof rawFilters !== 'object') return;

    Object.entries(rawFilters).forEach(([column, filterVal], idx) => {
      if (filterVal === undefined || filterVal === null) return;
      applySingleCashflowColumnFilter(qb, column, filterVal, `cf_flt_${idx}`);
    });
  } catch {
    // Bỏ qua nếu payload filtersStr không đúng định dạng JSON
  }
}

function applySingleCashflowColumnFilter(
  qb: SelectQueryBuilder<KgaraCaseSettlement>,
  column: string,
  filterVal: any,
  paramPrefix: string,
): void {
  let values: string[] = [];
  let fromDate: string | undefined;
  let toDate: string | undefined;
  let minAmount: number | undefined;
  let maxAmount: number | undefined;
  let textSearch: string | undefined;

  if (Array.isArray(filterVal)) {
    values = filterVal.map((v) => String(v).trim()).filter(Boolean);
  } else if (typeof filterVal === 'object') {
    if (filterVal.type === 'dateRange') {
      fromDate = filterVal.from;
      toDate = filterVal.to;
    } else if (filterVal.type === 'amountRange') {
      minAmount =
        filterVal.min !== undefined ? Number(filterVal.min) : undefined;
      maxAmount =
        filterVal.max !== undefined ? Number(filterVal.max) : undefined;
    } else if (filterVal.type === 'text') {
      textSearch = filterVal.value ? String(filterVal.value).trim() : undefined;
    } else if (Array.isArray(filterVal.values)) {
      values = filterVal.values
        .map((v: any) => String(v).trim())
        .filter(Boolean);
    }
  } else if (typeof filterVal === 'string' && filterVal.trim()) {
    const trimmed = filterVal.trim();
    if (trimmed.includes('..') || trimmed.includes('|')) {
      const sep = trimmed.includes('..') ? '..' : '|';
      const [f, t] = trimmed.split(sep);
      fromDate = f?.trim();
      toDate = t?.trim();
    } else {
      textSearch = trimmed;
    }
  }

  // Date Range
  if (fromDate || toDate) {
    if (fromDate) {
      qb.andWhere('s.transDate >= :fromDate', { fromDate });
    }
    if (toDate) {
      qb.andWhere('s.transDate <= :toDate', { toDate });
    }
    return;
  }

  // Amount Range
  if (minAmount !== undefined || maxAmount !== undefined) {
    if (minAmount !== undefined && !isNaN(minAmount)) {
      qb.andWhere('s.amount >= :minAmount', { minAmount });
    }
    if (maxAmount !== undefined && !isNaN(maxAmount)) {
      qb.andWhere('s.amount <= :maxAmount', { maxAmount });
    }
    return;
  }

  // Single string date range in values array (vd: ["2026-03-01..2026-03-31"])
  if (
    values.length === 1 &&
    (values[0].includes('..') || values[0].includes('|'))
  ) {
    const sep = values[0].includes('..') ? '..' : '|';
    const [f, t] = values[0].split(sep);
    if (f) qb.andWhere('s.transDate >= :df', { df: f.trim() });
    if (t) qb.andWhere('s.transDate <= :dt', { dt: t.trim() });
    return;
  }

  // Cột liên kết ngân hàng
  if (column === 'hasBankTxn' || column === 'bankTxn') {
    if (values.includes('YES') && !values.includes('NO')) {
      qb.andWhere('s.bankTransactionId IS NOT NULL');
    } else if (values.includes('NO') && !values.includes('YES')) {
      qb.andWhere('s.bankTransactionId IS NULL');
    }
    return;
  }

  // Text search trực tiếp
  if (textSearch) {
    const colExpr = getGarageCashflowColumnSelectExpr(column);
    if (colExpr) {
      applyMultiKeywordFilter(
        qb,
        `CAST(${colExpr} AS TEXT)`,
        textSearch,
        paramPrefix,
      );
    }
    return;
  }

  // Multi values (options và __BLANK__)
  if (values.length === 0) return;

  const colExpr = getGarageCashflowColumnSelectExpr(column);
  if (!colExpr) return;

  const hasBlank = values.includes('__BLANK__');
  const realVals = values.filter((v) => v !== '__BLANK__');

  if (realVals.length === 0) {
    if (hasBlank) {
      qb.andWhere(`(${colExpr} IS NULL OR CAST(${colExpr} AS TEXT) = '')`);
    }
    return;
  }

  qb.andWhere(
    new Brackets((sqb) => {
      const paramName = `${paramPrefix}_in`;
      sqb.where(`CAST(${colExpr} AS TEXT) IN (:...${paramName})`, {
        [paramName]: realVals,
      });
      if (hasBlank) {
        sqb.orWhere(`(${colExpr} IS NULL OR CAST(${colExpr} AS TEXT) = '')`);
      }
    }),
  );
}

/**
 * Áp dụng sắp xếp dữ liệu (Sort) theo chuẩn TypeORM Entity Property Names
 */
export function applyGarageCashflowSorts(
  qb: SelectQueryBuilder<KgaraCaseSettlement>,
  sorts?: string | string[],
  sortField?: string,
  sortOrder?: string,
): void {
  const sortMap: Record<string, string> = {
    transDate: 's.transDate',
    amount: 's.amount',
    settlementType: 's.settlementType',
    paymentMethod: 's.paymentMethod',
    sourceChannel: 's.sourceChannel',
    partnerName: 's.partnerName',
    payerType: 's.payerType',
    receiptNumber: 's.receiptNumber',
    createdAt: 's.createdAt',
  };

  if (sorts) {
    const sortList = Array.isArray(sorts) ? sorts : [sorts];
    let first = true;
    for (const s of sortList) {
      if (!s) continue;
      const isDesc = s.startsWith('-');
      const fieldName = isDesc ? s.substring(1) : s;
      const dbCol = sortMap[fieldName];
      if (!dbCol) continue;

      const dir = isDesc ? 'DESC' : 'ASC';
      if (first) {
        qb.orderBy(dbCol, dir);
        first = false;
      } else {
        qb.addOrderBy(dbCol, dir);
      }
    }
    if (!first) {
      qb.addOrderBy('s.createdAt', 'DESC');
      return;
    }
  }

  if (sortField && sortMap[sortField]) {
    const dir =
      String(sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortMap[sortField], dir).addOrderBy('s.createdAt', 'DESC');
    return;
  }

  // Mặc định: Ngày giao dịch giảm dần, sau đó đến ngày tạo giảm dần
  qb.orderBy('s.transDate', 'DESC').addOrderBy('s.createdAt', 'DESC');
}

/**
 * Lấy danh sách Distinct Options phân trang cho một cột cụ thể
 */
export async function queryGarageCashflowDistinctOptions(
  settlementRepo: Repository<KgaraCaseSettlement>,
  params: {
    column: string;
    search?: string;
    page?: number | string;
    pageSize?: number | string;
    filtersStr?: string;
    statusTab?: string;
  },
): Promise<{
  items: Array<{ label: string; value: string }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const {
    column,
    search = '',
    page = 1,
    pageSize = 20,
    filtersStr,
    statusTab,
  } = params;
  const colExpr = getGarageCashflowColumnSelectExpr(column);

  if (!colExpr) {
    return {
      items: [],
      total: 0,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: 0,
    };
  }

  const p = Math.max(1, Number(page));
  const ps = Math.max(1, Math.min(100, Number(pageSize)));

  const qb = settlementRepo
    .createQueryBuilder('s')
    .leftJoin('s.case', 'c')
    .leftJoin('s.bankTransaction', 'bt');

  applyGarageCashflowFilters(qb, filtersStr, statusTab);

  if (search.trim()) {
    applyMultiKeywordFilter(
      qb,
      `CAST(${colExpr} AS TEXT)`,
      search.trim(),
      'opt_search',
    );
  }

  qb.select(`${colExpr}`, 'value')
    .where(`${colExpr} IS NOT NULL AND CAST(${colExpr} AS TEXT) <> ''`)
    .groupBy(`${colExpr}`)
    .orderBy('value', 'ASC');

  const countQb = qb.clone();
  countQb.offset(undefined).limit(undefined);
  const totalCount = await countQb.getCount();

  const rows = await qb
    .offset((p - 1) * ps)
    .limit(ps)
    .getRawMany();

  return {
    items: rows.map((r) => ({
      value: String(r.value),
      label: String(r.value),
    })),
    total: totalCount,
    page: p,
    pageSize: ps,
    totalPages: Math.ceil(totalCount / ps),
  };
}
