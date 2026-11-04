import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  DataSource,
  FindOptionsOrder,
  FindOptionsWhere,
  In,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
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
  TableSortDefault,
} from '@/common/utils/table-query';
import { BaseQueryPurchaseOrderDto } from '../dto';
import type { BasePurchaseOrderEntity } from '../entities/base-purchase-order.entity';
import type { BasePurchaseOrderLineEntity } from '../entities/base-purchase-order-line.entity';
import { PurchaseOrderEntityTarget } from './abstract-purchase-order-command.service';

export interface PurchaseOrderListItem<
  H extends BasePurchaseOrderEntity,
  L extends BasePurchaseOrderLineEntity,
> {
  header: H;
  lines: L[];
}

export interface PurchaseOrderListResult<
  H extends BasePurchaseOrderEntity,
  L extends BasePurchaseOrderLineEntity,
> {
  items: PurchaseOrderListItem<H, L>[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Tổng toàn bộ dòng khớp bộ lọc (bỏ qua phân trang). */
  summaries: Record<string, number>;
}

const HEADER_ALIAS = 'po';
const LINE_ALIAS = 'pl';
const DEFAULT_SORT: TableSortDefault = {
  sql: `${HEADER_ALIAS}.created_at`,
  direction: 'DESC',
};

/**
 * Truy vấn PO dùng chung (template method). Lọc theo quan hệ dòng dùng EXISTS
 * trong SQL, không ghép mảng id trong bộ nhớ.
 * Sắp xếp và cột lọc đi qua whitelist, nên tham số lạ bị bỏ qua.
 */
export abstract class AbstractPurchaseOrderQueryService<
  H extends BasePurchaseOrderEntity,
  L extends BasePurchaseOrderLineEntity,
> {
  protected abstract readonly target: PurchaseOrderEntityTarget<H, L>;

  constructor(protected readonly dataSource: DataSource) {}

  // ----- Hook mở rộng -----

  /** Cột riêng của module con, gộp với cột chung (ví dụ tên NCC qua join). */
  protected extraColumns(): TableColumnMap {
    return {};
  }

  /** Join thêm cho module con (ví dụ quan hệ supplier). */
  protected applyJoins(_qb: SelectQueryBuilder<H>): void {}

  /** Bộ lọc riêng của module con (ví dụ branch_id của PO garage). */
  protected applyExtraFilters(
    _qb: SelectQueryBuilder<H>,
    _query: BaseQueryPurchaseOrderDto,
  ): void {}

  /** Cột SQL để tìm kiếm từ khóa. Module con thêm cột của mình. */
  protected searchFields(): string[] {
    return [
      `${HEADER_ALIAS}.po_no`,
      `${HEADER_ALIAS}.supplier_invoice_no`,
      `${HEADER_ALIAS}.remarks`,
    ];
  }

  /** Biểu thức tổng tiền một phiếu. Mặc định cộng từ dòng; module có cột lưu thì ghi đè. */
  protected totalSql(): string {
    // Không dùng alias trong subquery: TypeORM đọc alias.column trong ORDER BY và báo lỗi.
    return `(SELECT COALESCE(SUM(amount), 0) FROM ${this.lineTable()} WHERE ${this.lineFk()} = ${HEADER_ALIAS}.id)`;
  }

  // ----- Lệnh đọc công khai -----

  async list(
    query: BaseQueryPurchaseOrderDto,
  ): Promise<PurchaseOrderListResult<H, L>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const columns = this.columns();
    const qb = this.baseQuery();
    this.applyFilters(qb, query, columns);

    const summaries = await computeTableSummaries(qb, [
      { key: 'totalAmount', sql: this.totalSql() },
    ]);
    const total = await qb.clone().getCount();

    applyTableSort(qb, query.sort, columns, DEFAULT_SORT);
    // offset/limit thay vì skip/take: skip/take với join buộc TypeORM dựng subquery
    // và không xử lý được ORDER BY theo tên cột DB. Quan hệ NCC là many-to-one nên không nhân dòng.
    const headers = await qb
      .clone()
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getMany();

    const linesByHeader = await this.loadLines(headers.map((h) => h.id));
    return {
      items: headers.map((header) => ({
        header,
        lines: linesByHeader.get(header.id) ?? [],
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      summaries,
    };
  }

  async findOne(id: string): Promise<PurchaseOrderListItem<H, L>> {
    const header = await this.baseQuery()
      .andWhere(`${HEADER_ALIAS}.id = :id`, { id })
      .getOne();
    if (!header) {
      throw new NotFoundException('Không tìm thấy đơn mua hàng');
    }
    const lines = (await this.loadLines([id])).get(id) ?? [];
    return { header, lines };
  }

  /** Danh sách giá trị gợi ý của một cột, đã áp dụng các bộ lọc khác (cascading). */
  async columnOptions(
    column: string,
    query: BaseQueryPurchaseOrderDto,
    options: { search?: string; page: number; pageSize: number },
  ): Promise<TableOptionsPage> {
    const columns = this.columns();
    const def = resolveTableColumn(columns, column);
    if (!def) {
      throw new BadRequestException(`Cột ${column} không hỗ trợ lọc`);
    }
    const qb = this.baseQuery();
    this.applyFilters(qb, query, columns, column);
    return findTableColumnOptions(
      qb,
      def,
      options.search,
      options.page,
      options.pageSize,
    );
  }

  // ----- Nội bộ -----

  /** Whitelist cột. Module con không ghi đè trực tiếp, chỉ thêm qua extraColumns. */
  protected columns(): TableColumnMap {
    const h = HEADER_ALIAS;
    const base: TableColumnMap = {
      po_no: { sql: `${h}.po_no`, type: 'text' },
      poNo: { sql: `${h}.po_no`, type: 'text' },
      supplier_invoice_no: { sql: `${h}.supplier_invoice_no`, type: 'text' },
      supplierInvoiceNo: { sql: `${h}.supplier_invoice_no`, type: 'text' },
      remarks: { sql: `${h}.remarks`, type: 'text' },
      status: { sql: `${h}.status`, type: 'status' },
      payment_status: { sql: `${h}.payment_status`, type: 'status' },
      paymentStatus: { sql: `${h}.payment_status`, type: 'status' },
      order_date: { sql: `${h}.order_date`, type: 'date' },
      orderDate: { sql: `${h}.order_date`, type: 'date' },
      expected_date: { sql: `${h}.expected_date`, type: 'date' },
      expectedDate: { sql: `${h}.expected_date`, type: 'date' },
      total_amount: { sql: this.totalSql(), type: 'number' },
      totalAmount: { sql: this.totalSql(), type: 'number' },
      created_at: { sql: `${h}.created_at`, type: 'date' },
      createdAt: { sql: `${h}.created_at`, type: 'date' },
    };
    return { ...base, ...this.extraColumns() };
  }

  protected baseQuery(): SelectQueryBuilder<H> {
    const qb = this.dataSource
      .createQueryBuilder(this.target.header, HEADER_ALIAS)
      .where(`${HEADER_ALIAS}.is_deleted = :notDeleted`, { notDeleted: false });
    this.applyJoins(qb);
    return qb;
  }

  private applyFilters(
    qb: SelectQueryBuilder<H>,
    query: BaseQueryPurchaseOrderDto,
    columns: TableColumnMap,
    exceptColumn?: string,
  ): void {
    if (query.supplier_id) {
      qb.andWhere(`${HEADER_ALIAS}.supplier_id = :supplierId`, {
        supplierId: query.supplier_id,
      });
    }
    if (query.status) {
      qb.andWhere(`${HEADER_ALIAS}.status = :status`, { status: query.status });
    }
    if (query.exclude_status) {
      qb.andWhere(`${HEADER_ALIAS}.status <> :excludedStatus`, {
        excludedStatus: query.exclude_status,
      });
    }
    if (query.date_from || query.date_to) {
      applyDateBounds(
        qb,
        `${HEADER_ALIAS}.order_date`,
        query.date_from,
        query.date_to,
        'order_date',
      );
    }
    if (query.inventory_item_id) {
      this.lineExists(qb, `${LINE_ALIAS}.item_id = :itemId`, {
        itemId: query.inventory_item_id,
      });
    }
    if (query.only_receivable === true) {
      this.lineExists(
        qb,
        `${LINE_ALIAS}.item_id IS NOT NULL AND CAST(${LINE_ALIAS}.qty_ordered AS NUMERIC) > CAST(${LINE_ALIAS}.qty_received AS NUMERIC)`,
        {},
      );
    }
    if (query.search) {
      applyMultiKeywordMultiFieldFilter(
        qb,
        this.searchFields(),
        query.search,
        'po_kw',
      );
    }
    applyTableFilters(
      qb,
      this.payloadOf(query),
      columns,
      HEADER_ALIAS,
      exceptColumn,
    );
    this.applyExtraFilters(qb, query);
  }

  /** Tham số JSON của bảng; sai định dạng thì bỏ qua (xem parseFilterRecord). */
  private payloadOf(query: BaseQueryPurchaseOrderDto): TableFilterPayload {
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

  /** EXISTS trên bảng dòng, tương quan với header theo khóa ngoại. */
  private lineExists(
    qb: SelectQueryBuilder<H>,
    condition: string,
    params: ObjectLiteral,
  ): void {
    const sub = qb
      .subQuery()
      .select('1')
      .from(this.lineTable(), LINE_ALIAS)
      .where(`${LINE_ALIAS}.${this.lineFk()} = ${HEADER_ALIAS}.id`)
      .andWhere(condition, params);
    qb.andWhere(`EXISTS ${sub.getQuery()}`);
    qb.setParameters(sub.getParameters());
  }

  /** Dòng của nhiều phiếu, gom theo id header, đúng thứ tự lineNo. */
  protected async loadLines(headerIds: string[]): Promise<Map<string, L[]>> {
    const grouped = new Map<string, L[]>();
    if (headerIds.length === 0) return grouped;
    const fk = this.target.lineForeignKey;
    const rows = await this.dataSource.getRepository(this.target.line).find({
      where: { [fk]: In(headerIds) } as FindOptionsWhere<L>,
      order: { lineNo: 'ASC' } as FindOptionsOrder<L>,
    });
    for (const row of rows) {
      const key = (row as unknown as Record<string, string>)[fk];
      const bucket = grouped.get(key) ?? [];
      bucket.push(row);
      grouped.set(key, bucket);
    }
    return grouped;
  }

  private lineTable(): string {
    return this.dataSource.getMetadata(this.target.line).tableName;
  }

  private lineFk(): string {
    const column = this.dataSource
      .getMetadata(this.target.line)
      .findColumnWithPropertyName(this.target.lineForeignKey);
    if (!column) {
      throw new Error(
        `Thiếu cột khóa ngoại ${this.target.lineForeignKey} trên bảng dòng PO`,
      );
    }
    return column.databaseName;
  }
}
