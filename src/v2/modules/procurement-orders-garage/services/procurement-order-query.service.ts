import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { nextDocumentNo } from '@/common/numbering/document-numbering';
import { ApprovalEvent } from '@/v2/core/approval-core/entities/approval-event.entity';
import { GarageProcurementOrder } from '../entities/procurement-order.entity';
import { GarageProcurementOrderLine } from '../entities/procurement-order-line.entity';
import { GarageProcurementOrderAcceptance } from '../entities/procurement-order-acceptance.entity';
import { GARAGE_PROCUREMENT_ORDER_PREFIX } from '../procurement-orders-garage.constants';
import { CoreUser } from '../../../../users/entities/core-user.entity';
import { resolveCreatedByEmails } from '../helpers/resolve-created-by-email';
import {
  applyTableFilters,
  applyTableSort,
  findTableColumnOptions,
  parseFilterRecord,
  resolveTableColumn,
  TableDateRange,
  TableOperatorFilter,
  TableOptionsPage,
} from '@/common/utils/table-query';
import {
  TABLE_COLUMNS,
  toFilterPayload,
} from '../constants/procurement-order-table.constants';

/** Mã loại chứng từ của họ Garage trong nhật ký duyệt. Khớp với docType của command. */
const DOC_TYPE = 'GARAGE_PROCUREMENT_ORDER';

export interface GarageProcurementOrderFilter {
  page: number;
  pageSize: number;
  branchId?: string;
  status?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sort?: string;
  column_filters?: unknown;
  column_search?: unknown;
  column_operators?: unknown;
  date_ranges?: unknown;
}

@Injectable()
export class GarageProcurementOrderQueryService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(GarageProcurementOrder)
    private readonly headers: Repository<GarageProcurementOrder>,
    @InjectRepository(GarageProcurementOrderLine)
    private readonly lines: Repository<GarageProcurementOrderLine>,
    @InjectRepository(GarageProcurementOrderAcceptance)
    private readonly acceptances: Repository<GarageProcurementOrderAcceptance>,
    @InjectRepository(ApprovalEvent)
    private readonly events: Repository<ApprovalEvent>,
    @InjectRepository(CoreUser)
    private readonly users: Repository<CoreUser>,
  ) {}

  /** Nhật ký duyệt của một đơn mua Garage, theo thứ tự thời gian. */
  async approvalEvents(id: string): Promise<ApprovalEvent[]> {
    return this.events.find({
      where: { docType: DOC_TYPE, docId: id },
      order: { createdAt: 'ASC' },
    });
  }

  async list(filter: GarageProcurementOrderFilter) {
    const qb = this.headers
      .createQueryBuilder('h')
      .where('h.isDeleted = :notDeleted', { notDeleted: false });
    if (filter.branchId) {
      qb.andWhere('h.branchId = :branchId', { branchId: filter.branchId });
    }
    if (filter.status) {
      qb.andWhere('h.status = :status', { status: filter.status });
    }
    if (filter.supplierId) {
      qb.andWhere('h.supplierId = :supplierId', {
        supplierId: filter.supplierId,
      });
    }
    if (filter.dateFrom) {
      qb.andWhere('h.orderDate >= :dateFrom', { dateFrom: filter.dateFrom });
    }
    if (filter.dateTo) {
      qb.andWhere('h.orderDate <= :dateTo', { dateTo: filter.dateTo });
    }
    if (filter.search) {
      qb.andWhere('(h.orderNo ILIKE :q OR h.supplierName ILIKE :q)', {
        q: `%${filter.search}%`,
      });
    }
    applyTableFilters(
      qb,
      {
        columnFilters: parseFilterRecord<Record<string, string[]>>(
          filter.column_filters,
        ),
        columnSearch: parseFilterRecord<Record<string, string>>(
          filter.column_search,
        ),
        columnOperators: parseFilterRecord<Record<string, TableOperatorFilter>>(
          filter.column_operators,
        ),
        dateRanges: parseFilterRecord<Record<string, TableDateRange>>(
          filter.date_ranges,
        ),
      },
      TABLE_COLUMNS,
      'filter',
    );
    applyTableSort(qb, filter.sort, TABLE_COLUMNS, {
      sql: 'h.createdAt',
      direction: 'DESC',
    });
    const [rows, total] = await qb
      .skip((filter.page - 1) * filter.pageSize)
      .take(filter.pageSize)
      .getManyAndCount();
    const createdByEmails = await resolveCreatedByEmails(
      this.users,
      rows.map((row) => row.createdBy),
    );
    return {
      rows,
      total,
      page: filter.page,
      pageSize: filter.pageSize,
      createdByEmails,
    };
  }

  /** Gợi ý giá trị của một cột, áp dụng bộ lọc của các cột khác (Popover Filter V2). */
  async findColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    filters: unknown,
  ): Promise<TableOptionsPage> {
    const def = resolveTableColumn(TABLE_COLUMNS, column);
    if (!def) return { items: [], total: 0, next: null };

    const qb = this.headers
      .createQueryBuilder('h')
      .where('h.isDeleted = :notDeleted', { notDeleted: false });

    applyTableFilters(
      qb,
      toFilterPayload(filters),
      TABLE_COLUMNS,
      'col_opt',
      column,
    );
    return findTableColumnOptions(qb, def, search, page, pageSize);
  }

  /** Số đơn kế tiếp theo ngày (xem trước, chưa giữ số). */
  async nextNo(date?: string): Promise<string> {
    return this.dataSource.transaction((manager) =>
      nextDocumentNo(
        manager,
        GarageProcurementOrder,
        'orderNo',
        GARAGE_PROCUREMENT_ORDER_PREFIX,
        date,
      ),
    );
  }

  async findOne(id: string) {
    const header = await this.headers.findOne({
      where: { id, isDeleted: false },
    });
    if (!header) throw new NotFoundException('Không tìm thấy đơn mua');
    const lines = await this.lines.find({
      where: { orderId: id },
      order: { lineNo: 'ASC' },
    });
    const acceptances = await this.acceptances.find({
      where: { orderId: id },
      order: { acceptedAt: 'ASC' },
    });
    return { header, lines, acceptances };
  }
}
