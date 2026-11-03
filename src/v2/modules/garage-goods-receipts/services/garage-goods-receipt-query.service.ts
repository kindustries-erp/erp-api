import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GarageGoodsReceipt } from '../entities/garage-goods-receipt.entity';
import { QueryGarageGoodsReceiptDto } from '../dto/query-garage-goods-receipt.dto';
import { applyMultiKeywordMultiFieldFilter } from '@/common/utils/query-builder.util';
import {
  applyDateBounds,
  applyTableFilters,
  applyTableSort,
  computeTableSummaries,
  findTableColumnOptions,
  parseFilterRecord,
  resolveTableColumn,
  TableColumnMap,
  TableDateRange,
  TableFilterPayload,
  TableOperatorFilter,
  TableOptionsPage,
} from '@/common/utils/table-query';

/** Cột lọc, sắp xếp và tổng (whitelist, không nhận biểu thức từ client). */
const TABLE_COLUMNS: TableColumnMap = {
  createdAt: { sql: 'e.createdAt', type: 'date' },
  created_at: { sql: 'e.createdAt', type: 'date' },
  receiptNo: { sql: 'e.receiptNo', type: 'text' },
  receipt_no: { sql: 'e.receiptNo', type: 'text' },
  receiptDate: { sql: 'e.receiptDate', type: 'date' },
  receipt_date: { sql: 'e.receiptDate', type: 'date' },
  supplierName: { sql: 'e.supplierName', type: 'text' },
  supplier_name: { sql: 'e.supplierName', type: 'text' },
  branchName: { sql: 'e.branchName', type: 'text' },
  branch_name: { sql: 'e.branchName', type: 'text' },
  totalAmount: { sql: 'e.totalAmount', type: 'number' },
  total_amount: { sql: 'e.totalAmount', type: 'number' },
  status: { sql: 'e.status', type: 'status' },
  paymentStatus: { sql: 'e.paymentStatus', type: 'status' },
  payment_status: { sql: 'e.paymentStatus', type: 'status' },
  remarks: { sql: 'e.remarks', type: 'text' },
};

/** Cột số được cộng vào `summaries` (tổng toàn bộ dòng khớp bộ lọc). */
const SUMMARY_COLUMNS: { key: string; sql: string }[] = [
  { key: 'totalAmount', sql: 'e.totalAmount' },
];

/** Cột dùng cho ô tìm kiếm chung (ILIKE, nhiều từ khóa cách nhau bằng dấu `;`). */
const SEARCH_COLUMNS: string[] = [
  'e.receiptNo',
  'e.supplierName',
  'e.branchName',
  'e.remarks',
];

export interface GarageGoodsReceiptPageResult {
  items: GarageGoodsReceipt[];
  total: number;
  page: number;
  pageSize: number;
  summaries: Record<string, number>;
}

/** Đọc dữ liệu: lọc, sắp xếp, phân trang, gợi ý giá trị cột và tổng. Chỉ đọc các dòng chưa xóa mềm. */
@Injectable()
export class GarageGoodsReceiptQueryService {
  constructor(
    @InjectRepository(GarageGoodsReceipt)
    private readonly repo: Repository<GarageGoodsReceipt>,
  ) {}

  async findAll(
    query: QueryGarageGoodsReceiptDto,
  ): Promise<GarageGoodsReceiptPageResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Math.min(200, Number(query.pageSize) || 20));
    const qb = this.baseQuery();

    const keyword = query.search?.trim();
    if (keyword && SEARCH_COLUMNS.length > 0) {
      applyMultiKeywordMultiFieldFilter(
        qb,
        SEARCH_COLUMNS,
        keyword,
        'global_search',
      );
    }

    applyTableFilters(qb, this.readFilters(query), TABLE_COLUMNS, 'filter');
    applyDateBounds(
      qb,
      'e.createdAt',
      query.date_from,
      query.date_to,
      'legacy',
    );
    applyTableSort(qb, query.sort, TABLE_COLUMNS, {
      sql: 'e.createdAt',
      direction: 'DESC',
    });

    // Tổng tính trên toàn bộ dòng khớp, nên phải gọi trước khi phân trang
    const summaries = await computeTableSummaries(qb, SUMMARY_COLUMNS);

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total, page, pageSize, summaries };
  }

  /** Gợi ý giá trị của một cột, áp dụng bộ lọc của các cột khác. */
  async findColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    filters: unknown,
  ): Promise<TableOptionsPage> {
    const def = resolveTableColumn(TABLE_COLUMNS, column);
    if (!def) return { items: [], total: 0, next: null };

    const qb = this.baseQuery();
    applyTableFilters(
      qb,
      this.toPayload(filters),
      TABLE_COLUMNS,
      'col_opt',
      column,
    );
    return findTableColumnOptions(qb, def, search, page, pageSize);
  }

  findById(id: string): Promise<GarageGoodsReceipt | null> {
    return this.repo.findOne({
      where: { id, isDeleted: false },
      relations: ['lines'],
      order: { lines: { lineNo: 'ASC' } } as any,
    });
  }

  private baseQuery() {
    return this.repo
      .createQueryBuilder('e')
      .where('e.isDeleted = :isDeleted', { isDeleted: false });
  }

  private readFilters(query: QueryGarageGoodsReceiptDto): TableFilterPayload {
    return {
      columnFilters: parseFilterRecord<Record<string, string[]>>(
        query.column_filters,
      ),
      columnSearch: parseFilterRecord<Record<string, string>>(
        query.column_search,
      ),
      columnOperators: parseFilterRecord<Record<string, TableOperatorFilter>>(
        query.column_operators,
      ),
      dateRanges: parseFilterRecord<Record<string, TableDateRange>>(
        query.date_ranges,
      ),
    };
  }

  /** Nhận cả payload đầy đủ lẫn dạng rút gọn `{ cột: [giá trị] }` từ bảng V2. */
  private toPayload(raw: unknown): TableFilterPayload {
    const parsed = parseFilterRecord<
      TableFilterPayload & Record<string, unknown>
    >(raw);
    if (!parsed) return {};
    const hasEnvelope = [
      'columnFilters',
      'columnSearch',
      'columnOperators',
      'dateRanges',
    ].some((key) => key in parsed);
    return hasEnvelope
      ? parsed
      : { columnFilters: parsed as Record<string, string[]> };
  }
}
