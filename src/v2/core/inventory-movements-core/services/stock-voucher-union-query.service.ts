import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  buildPagination,
  PaginationMeta,
} from '@/common/utils/paginated-result';
import { parseSummaryKeys } from '@/common/utils/table-query/table-query.summary';
import type {
  StockVoucherUnionItemDto,
  StockVoucherUnionSummaryDto,
} from '../dto/stock-voucher-union-response.dto';
import {
  buildUnionSourceSql,
  buildVoucherOrder,
  buildVoucherWhere,
  escapeLike,
  STOCK_VOUCHER_UNION_FILTERABLE,
  type StockVoucherWhereClause,
} from '../helpers/stock-voucher-union-sql.helper';

/** Tên cột của một nguồn phiếu, ánh xạ về cột chuẩn của danh sách gộp. */
export interface StockVoucherUnionColumns {
  id: string;
  voucherNo: string;
  voucherDate: string;
  status: string;
  partnerName: string;
  branchId: string;
  totalAmount: string;
  remarks: string;
  createdAt: string;
}

/** Một nguồn phiếu trong danh sách gộp. Tên bảng và cột do module khai báo, không lấy từ request. */
export interface StockVoucherUnionSource {
  /** Mã loại hiển thị ở cột Loại, ví dụ PURCHASE_RECEIPT, ISSUE. */
  type: string;
  table: string;
  columns: StockVoucherUnionColumns;
}

export interface StockVoucherUnionFilter {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  column_filters?: string;
  summary_keys?: string;
}

export interface StockVoucherUnionOptionsFilter {
  column?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  filters?: string;
}

/**
 * Đọc danh sách chứng từ kho gộp nhiều bảng phiếu bằng `UNION ALL`. Chỉ đọc.
 * Dựng SQL (nguồn, WHERE, sắp xếp, bộ lọc cột) nằm ở helper `stock-voucher-union-sql`.
 */
export class StockVoucherUnionQueryService {
  private readonly unionSql: string;
  private readonly types: string[];

  constructor(
    private readonly dataSource: DataSource,
    sources: StockVoucherUnionSource[],
  ) {
    this.unionSql = sources
      .map((s) => buildUnionSourceSql(s))
      .join(' UNION ALL ');
    this.types = sources.map((s) => s.type);
  }

  async findAll(filter: StockVoucherUnionFilter) {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filter.pageSize ?? 20));
    const where = this.where(filter);
    const order = buildVoucherOrder(filter.sort);
    const from = `FROM (${this.unionSql}) u${where.sql}`;

    const [{ count }] = await this.dataSource.query(
      `SELECT count(*)::int AS count ${from}`,
      where.params,
    );
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT u.* ${from} ORDER BY ${order} LIMIT $${where.params.length + 1} OFFSET $${where.params.length + 2}`,
      [...where.params, pageSize, (page - 1) * pageSize],
    );
    const summaries = await this.summarize(
      filter,
      where,
      order,
      page,
      pageSize,
    );
    const typeCounts = await this.countByType(filter);
    return {
      items: rows.map((row) => this.toItem(row)),
      pagination: buildPagination(
        page,
        pageSize,
        Number(count),
      ) as PaginationMeta,
      summaries,
      extraData: { typeCounts },
    };
  }

  /**
   * Số phiếu theo từng loại, áp dụng các bộ lọc khác nhưng bỏ bộ lọc loại
   * (để badge từng tab không bị triệt tiêu khi đang chọn một loại).
   */
  private async countByType(
    filter: StockVoucherUnionFilter,
  ): Promise<Record<string, number>> {
    const where = this.where(filter, 'type');
    const rows: Array<{ type: string; count: number }> =
      await this.dataSource.query(
        `SELECT u."type" AS type, count(*)::int AS count FROM (${this.unionSql}) u${where.sql} GROUP BY u."type"`,
        where.params,
      );
    const counts: Record<string, number> = Object.fromEntries(
      this.types.map((type) => [type, 0]),
    );
    for (const row of rows) counts[row.type] = Number(row.count);
    return counts;
  }

  /** Gợi ý giá trị của một cột, áp dụng bộ lọc của các cột khác. */
  async findColumnOptions(query: StockVoucherUnionOptionsFilter) {
    const column = query.column ?? '';
    if (
      !(STOCK_VOUCHER_UNION_FILTERABLE as readonly string[]).includes(column)
    ) {
      throw new BadRequestException(`Cột không hỗ trợ gợi ý: ${column}`);
    }
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 20));
    const where = this.where({ column_filters: query.filters }, column);
    const params = [...where.params];
    const col = `u."${column}"`;
    let sql = `${where.sql ? `${where.sql} AND` : ' WHERE'} ${col} IS NOT NULL`;
    if (query.search?.trim()) {
      params.push(`%${escapeLike(query.search.trim())}%`);
      sql += ` AND ${col} ILIKE $${params.length}`;
    }
    const from = `FROM (${this.unionSql}) u${sql}`;
    const [{ count }] = await this.dataSource.query(
      `SELECT count(DISTINCT ${col})::int AS count ${from}`,
      params,
    );
    const rows: Array<{ value: string }> = await this.dataSource.query(
      `SELECT DISTINCT ${col} AS value ${from} ORDER BY value LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize],
    );
    return {
      items: rows.map((r) => ({ label: r.value, value: r.value })),
      pagination: buildPagination(page, pageSize, Number(count)),
    };
  }

  private where(filter: StockVoucherUnionFilter, exclude?: string) {
    return buildVoucherWhere(filter, this.types, exclude);
  }

  /** Tổng `totalAmount` theo bộ lọc: cả danh sách, trang hiện tại và lũy kế đến hết trang. */
  private async summarize(
    filter: StockVoucherUnionFilter,
    where: StockVoucherWhereClause,
    order: string,
    page: number,
    pageSize: number,
  ): Promise<Record<string, StockVoucherUnionSummaryDto | null>> {
    const keys = parseSummaryKeys(filter.summary_keys);
    const result: Record<string, StockVoucherUnionSummaryDto | null> =
      Object.fromEntries(keys.map((key) => [key, null]));
    if (!keys.includes('totalAmount')) return result;

    const base = `FROM (${this.unionSql}) u${where.sql}`;
    const n = where.params.length;
    const sum = async (limit?: number, offset = 0): Promise<number> => {
      const sql = limit
        ? `SELECT COALESCE(SUM(x."totalAmount"), 0)::text AS v FROM (SELECT u."totalAmount" ${base} ORDER BY ${order} LIMIT $${n + 1} OFFSET $${n + 2}) x`
        : `SELECT COALESCE(SUM(u."totalAmount"), 0)::text AS v ${base}`;
      const params = limit ? [...where.params, limit, offset] : where.params;
      const [{ v }] = await this.dataSource.query(sql, params);
      return Number(v);
    };
    result.totalAmount = {
      total: await sum(),
      pageSubtotal: await sum(pageSize, (page - 1) * pageSize),
      cumulative: await sum(page * pageSize, 0),
    };
    return result;
  }

  private toItem(row: Record<string, unknown>): StockVoucherUnionItemDto {
    return {
      id: String(row.id),
      type: String(row.type),
      voucherNo: String(row.voucherNo),
      voucherDate: row.voucherDate as Date,
      status: String(row.status),
      partnerName: (row.partnerName as string | null) ?? null,
      branchId: (row.branchId as string | null) ?? null,
      totalAmount: Number(row.totalAmount ?? 0),
      remarks: (row.remarks as string | null) ?? null,
      createdAt: row.createdAt as Date,
    };
  }
}
