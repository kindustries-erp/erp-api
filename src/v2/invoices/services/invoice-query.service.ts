import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { QueryInvoiceDto } from '../dto/query-invoice.dto';
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
  invoiceNo: { sql: 'e.invoiceNo', type: 'text' },
  invoice_no: { sql: 'e.invoiceNo', type: 'text' },
  serialNo: { sql: 'e.serialNo', type: 'text' },
  serial_no: { sql: 'e.serialNo', type: 'text' },
  invoiceDate: { sql: 'e.invoiceDate', type: 'date' },
  invoice_date: { sql: 'e.invoiceDate', type: 'date' },
  direction: { sql: 'e.direction', type: 'text' },
  status: { sql: 'e.status', type: 'text' },
  sellerName: { sql: 'e.sellerName', type: 'text' },
  seller_name: { sql: 'e.sellerName', type: 'text' },
  sellerTaxCode: { sql: 'e.sellerTaxCode', type: 'text' },
  seller_tax_code: { sql: 'e.sellerTaxCode', type: 'text' },
  buyerName: { sql: 'e.buyerName', type: 'text' },
  buyer_name: { sql: 'e.buyerName', type: 'text' },
  buyerTaxCode: { sql: 'e.buyerTaxCode', type: 'text' },
  buyer_tax_code: { sql: 'e.buyerTaxCode', type: 'text' },
  description: { sql: 'e.description', type: 'text' },
  invoiceType: { sql: 'e.invoiceType', type: 'text' },
  invoice_type: { sql: 'e.invoiceType', type: 'text' },
  invoiceCategory: { sql: 'e.invoiceCategory', type: 'text' },
  invoice_category: { sql: 'e.invoiceCategory', type: 'text' },
  preVatAmount: { sql: 'e.preVatAmount', type: 'number' },
  pre_vat_amount: { sql: 'e.preVatAmount', type: 'number' },
  vatRate: { sql: 'e.vatRate', type: 'number' },
  vat_rate: { sql: 'e.vatRate', type: 'number' },
  vatAmount: { sql: 'e.vatAmount', type: 'number' },
  vat_amount: { sql: 'e.vatAmount', type: 'number' },
  discountAmount: { sql: 'e.discountAmount', type: 'number' },
  discount_amount: { sql: 'e.discountAmount', type: 'number' },
  totalAmount: { sql: 'e.totalAmount', type: 'number' },
  total_amount: { sql: 'e.totalAmount', type: 'number' },
  notes: { sql: 'e.notes', type: 'text' },
};

/** Cột số được cộng vào `summaries` (tổng toàn bộ dòng khớp bộ lọc). */
const SUMMARY_COLUMNS: { key: string; sql: string }[] = [
  { key: 'preVatAmount', sql: 'e.preVatAmount' },
  { key: 'vatRate', sql: 'e.vatRate' },
  { key: 'vatAmount', sql: 'e.vatAmount' },
  { key: 'discountAmount', sql: 'e.discountAmount' },
  { key: 'totalAmount', sql: 'e.totalAmount' },
];

/** Cột dùng cho ô tìm kiếm chung (ILIKE, nhiều từ khóa cách nhau bằng dấu `;`). */
const SEARCH_COLUMNS: string[] = [
  'e.invoiceNo',
  'e.serialNo',
  'e.invoiceDate',
  'e.direction',
  'e.status',
  'e.sellerName',
  'e.sellerTaxCode',
  'e.buyerName',
  'e.buyerTaxCode',
  'e.description',
  'e.invoiceType',
  'e.invoiceCategory',
  'e.notes',
];

export interface InvoicePageResult {
  items: Invoice[];
  total: number;
  page: number;
  pageSize: number;
  summaries: Record<string, number>;
}

/** Đọc dữ liệu: lọc, sắp xếp, phân trang, gợi ý giá trị cột và tổng. Chỉ đọc các dòng chưa xóa mềm. */
@Injectable()
export class InvoiceQueryService {
  constructor(
    @InjectRepository(Invoice)
    private readonly repo: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly itemRepo: Repository<InvoiceItem>,
  ) {}

  async findAll(query: QueryInvoiceDto): Promise<InvoicePageResult> {
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
      'e.invoiceDate',
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

  findById(id: string): Promise<Invoice | null> {
    return this.repo.findOne({ where: { id, isDeleted: false } });
  }

  /** Các dòng hàng của một hóa đơn, theo thứ tự nhập. */
  findItems(invoiceId: string): Promise<InvoiceItem[]> {
    return this.itemRepo.find({
      where: { invoiceId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Trả về các id chi nhánh còn hoạt động. Bảng `erp_branches` dùng cột `is_active`
   * (không có `is_deleted`). Dùng để kiểm tra trước khi gán chi nhánh.
   */
  async findExistingBranchIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows: { id: string }[] = await this.repo.query(
      'SELECT id FROM erp_branches WHERE id = ANY($1::uuid[]) AND is_active = true',
      [ids],
    );
    return rows.map((row) => row.id);
  }

  private baseQuery() {
    return this.repo
      .createQueryBuilder('e')
      .where('e.isDeleted = :isDeleted', { isDeleted: false });
  }

  private readFilters(query: QueryInvoiceDto): TableFilterPayload {
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
