import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
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
  TableDateRange,
  TableFilterPayload,
  TableOperatorFilter,
  TableOptionsPage,
  TABLE_BLANK_VALUE,
} from '@/common/utils/table-query';
import {
  INVOICE_SEARCH_COLUMNS,
  INVOICE_SUMMARY_COLUMNS,
  INVOICE_TABLE_COLUMNS,
} from '../helpers/invoice-table-columns';
import {
  applyNetOffJoin,
  NET_OFF_SUM_SQL,
  REMAINING_AMOUNT_SQL,
} from '../helpers/invoice-netoff.helper';

/** Hóa đơn kèm số đã cấn trừ và số còn lại (tính trong SQL, không lưu cột). */
export type FinanceInvoiceListRow = Invoice & {
  netOffAmount: number;
  remainingAmount: number;
};
export type InvoiceListRow = FinanceInvoiceListRow;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface InvoicePageResult {
  items: FinanceInvoiceListRow[];
  total: number;
  page: number;
  pageSize: number;
  summaries: Record<string, number>;
}

/** Đọc dữ liệu: lọc, sắp xếp, phân trang, gợi ý giá trị cột và tổng. Chỉ đọc các dòng chưa xóa mềm. */
@Injectable()
export class FinanceInvoiceQueryService {
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
    if (keyword && INVOICE_SEARCH_COLUMNS.length > 0) {
      applyMultiKeywordMultiFieldFilter(
        qb,
        INVOICE_SEARCH_COLUMNS,
        keyword,
        'global_search',
      );
    }

    const filters = this.readFilters(query);
    applyTableFilters(qb, filters, INVOICE_TABLE_COLUMNS, 'filter');
    this.applyBranchFilter(qb, filters.columnFilters?.branchId);
    this.applyDirectParams(qb, query);
    applyDateBounds(
      qb,
      'e.invoiceDate',
      query.date_from,
      query.date_to,
      'legacy',
    );
    applyTableSort(qb, query.sort, INVOICE_TABLE_COLUMNS, {
      sql: 'e.invoiceDate',
      direction: 'DESC',
    });

    // Tổng tính trên toàn bộ dòng khớp, nên phải gọi trước khi phân trang
    const summaries = await computeTableSummaries(qb, INVOICE_SUMMARY_COLUMNS);
    const total = await qb.clone().getCount();

    // offset/limit thay cho skip/take: tránh subquery DISTINCT khi sắp xếp theo biểu thức cấn trừ
    const { entities, raw } = await qb
      .addSelect(NET_OFF_SUM_SQL, 'netOffAmount')
      .addSelect(REMAINING_AMOUNT_SQL, 'remainingAmount')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawAndEntities<Record<string, unknown>>();

    // Cột raw của alias `e` có dạng `e_<tên cột DB>`, nên id là `e_id`
    const extras = new Map(raw.map((row) => [String(row.e_id), row]));
    const items = entities.map((entity) => {
      const extra = extras.get(entity.id);
      return Object.assign(entity, {
        netOffAmount: Number(extra?.netOffAmount ?? 0),
        remainingAmount: Number(extra?.remainingAmount ?? 0),
      });
    });
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
    const def = resolveTableColumn(INVOICE_TABLE_COLUMNS, column);
    if (!def) return { items: [], total: 0, next: null };

    const qb = this.baseQuery();
    applyTableFilters(
      qb,
      this.toPayload(filters),
      INVOICE_TABLE_COLUMNS,
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

  private baseQuery(): SelectQueryBuilder<Invoice> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.isDeleted = :isDeleted', { isDeleted: false });
    return applyNetOffJoin(qb);
  }

  /**
   * Lọc chi nhánh trên mảng `branch_ids`: khớp nếu hóa đơn thuộc một trong các chi nhánh đã chọn,
   * hoặc chưa gán chi nhánh nào khi chọn `__BLANK__`.
   */
  private applyBranchFilter(
    qb: SelectQueryBuilder<Invoice>,
    values: string[] | undefined,
  ): void {
    if (!values?.length) return;
    // Chỉ nhận id chi nhánh dạng UUID, giá trị khác bỏ qua để không lỗi cast `uuid[]`
    const selected = values.filter((value) => UUID_PATTERN.test(value));
    const conditions: string[] = [];
    if (selected.length)
      conditions.push('e.branchIds && CAST(:branchIds AS uuid[])');
    if (values.includes(TABLE_BLANK_VALUE))
      conditions.push('cardinality(e.branchIds) = 0');
    if (conditions.length === 0) return;
    qb.andWhere(`(${conditions.join(' OR ')})`, { branchIds: selected });
  }

  /** Tham số lọc đứng riêng: chiều hóa đơn, MST đối tác và thẻ (tag). */
  private applyDirectParams(
    qb: SelectQueryBuilder<Invoice>,
    query: QueryInvoiceDto,
  ): void {
    if (query.direction)
      qb.andWhere('e.direction = :direction', { direction: query.direction });
    if (query.partner_tax_code)
      qb.andWhere('(e.sellerTaxCode = :ptc OR e.buyerTaxCode = :ptc)', {
        ptc: query.partner_tax_code,
      });
    if (query.tag_id)
      qb.andWhere(
        `e.id IN (SELECT entity_id FROM sys_entity_tags WHERE entity_type = 'erp_invoice' AND tag_id = :tagId)`,
        { tagId: query.tag_id },
      );
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

export { FinanceInvoiceQueryService as InvoiceQueryService };
