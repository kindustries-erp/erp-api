import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GarageProcurementRequest } from '../entities/procurement-request.entity';
import { GarageProcurementRequestLine } from '../entities/procurement-request-line.entity';
import { ApprovalEvent } from '@/v2/core/approval-core/entities/approval-event.entity';
import { ListProcurementRequestsDto } from '../dto/procurement-request.dto';
import { applyMultiKeywordMultiFieldFilter } from '@/common/utils/query-builder.util';
import {
  applyDateBounds,
  applyTableFilters,
  applyTableSort,
  applyListSummaries,
  parseSummaryKeys,
  SummaryMetric,
  findTableColumnOptions,
  parseListFilterPayload,
  resolveTableColumn,
  emptyOptionsPage,
  TableOptionsPage,
} from '@/common/utils/table-query';
import {
  SEARCH_COLUMNS,
  SUMMARY_COLUMNS,
  TABLE_COLUMNS,
  toFilterPayload,
} from '../constants/procurement-request-table.constants';
import { GarageProcurementOrder } from '@/v2/modules/procurement-orders-garage/entities/procurement-order.entity';
import {
  applyRelatedOrderFilter,
  RELATED_ORDERS_KEY,
} from '../helpers/related-order-filter.helper';

export { TABLE_COLUMNS, SEARCH_COLUMNS };

/** Mã loại chứng từ của họ Garage trong nhật ký duyệt. Khớp với docType của command. */
const GARAGE_PURCHASE_REQUEST_DOC_TYPE = 'GARAGE_PROCUREMENT_REQUEST';

@Injectable()
export class GarageProcurementRequestQueryService {
  constructor(
    @InjectRepository(GarageProcurementRequest)
    private readonly headers: Repository<GarageProcurementRequest>,
    @InjectRepository(GarageProcurementRequestLine)
    private readonly lines: Repository<GarageProcurementRequestLine>,
    @InjectRepository(ApprovalEvent)
    private readonly events: Repository<ApprovalEvent>,
    @InjectRepository(GarageProcurementOrder)
    private readonly orders: Repository<GarageProcurementOrder>,
  ) {}

  /** Nhật ký duyệt của một đề nghị Garage, theo thứ tự thời gian. */
  async approvalEvents(id: string): Promise<ApprovalEvent[]> {
    return this.events.find({
      where: { docType: GARAGE_PURCHASE_REQUEST_DOC_TYPE, docId: id },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Truy vấn danh sách đề nghị mua hàng Garage:
   * Hỗ trợ tìm kiếm từ khóa, bộ lọc cột chuẩn V2, lọc ngày và sắp xếp động.
   */
  async list(dto: ListProcurementRequestsDto): Promise<{
    rows: GarageProcurementRequest[];
    total: number;
    page: number;
    pageSize: number;
    summaries: Record<string, SummaryMetric | null>;
  }>;
  async list(
    page: number,
    pageSize?: number,
    branchId?: string,
  ): Promise<{
    rows: GarageProcurementRequest[];
    total: number;
    page: number;
    pageSize: number;
    summaries: Record<string, SummaryMetric | null>;
  }>;
  async list(
    dtoOrPage: ListProcurementRequestsDto | number = 1,
    rawPageSize = 20,
    rawBranchId?: string,
  ) {
    const dto: ListProcurementRequestsDto =
      typeof dtoOrPage === 'number'
        ? { page: dtoOrPage, pageSize: rawPageSize, branchId: rawBranchId }
        : dtoOrPage;

    const page = Math.max(1, Number(dto.page) || 1);
    const pageSize = Math.max(1, Math.min(200, Number(dto.pageSize) || 20));

    const qb = this.headers
      .createQueryBuilder('h')
      .where('h.isDeleted = :deleted', { deleted: dto.deleted === 'only' });

    if (dto.branchId) {
      qb.andWhere('h.branchId = :branchId', { branchId: dto.branchId });
    }

    if (dto.status) {
      qb.andWhere('h.status = :status', { status: dto.status });
    }

    const keyword = dto.search?.trim();
    if (keyword) {
      applyMultiKeywordMultiFieldFilter(
        qb,
        SEARCH_COLUMNS,
        keyword,
        'global_search',
      );
    }

    const listPayload = parseListFilterPayload(dto);
    applyTableFilters(qb, listPayload, TABLE_COLUMNS, 'filter');
    applyRelatedOrderFilter(qb, this.orders, listPayload, 'relOrd');

    applyDateBounds(qb, 'h.createdAt', dto.date_from, dto.date_to, 'legacy');

    applyTableSort(
      qb,
      dto.sort,
      TABLE_COLUMNS,
      { sql: 'h.createdAt', direction: 'DESC' },
      'h.id',
    );

    // Tổng theo summary_keys trên toàn bộ dòng khớp, nên phải gọi trước khi phân trang
    const summaries = await applyListSummaries(qb, {
      columns: SUMMARY_COLUMNS,
      keys: parseSummaryKeys(dto.summary_keys),
      page,
      pageSize,
      tieBreaker: 'h.id',
    });

    const [rows, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { rows, total, page, pageSize, summaries };
  }

  /** Gợi ý danh sách giá trị của một cột cho Popover Filter trên Header bảng V2. */
  async findColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    filters: unknown,
    deleted?: 'only',
  ): Promise<TableOptionsPage> {
    const isDeleted = deleted === 'only';
    const headerQb = () =>
      this.headers
        .createQueryBuilder('h')
        .where('h.isDeleted = :deleted', { deleted: isDeleted });

    if (column === RELATED_ORDERS_KEY) {
      // Gợi ý số PO: PO còn hiệu lực thuộc các đề nghị khớp bộ lọc cột khác (cascading).
      const headerIds = headerQb().select('h.id');
      applyTableFilters(
        headerIds,
        toFilterPayload(filters),
        TABLE_COLUMNS,
        'rel_opt_h',
        column,
      );
      const orderQb = this.orders
        .createQueryBuilder('o')
        .where('o.isDeleted = false')
        .andWhere(`o.requestId IN (${headerIds.getQuery()})`)
        .setParameters(headerIds.getParameters());
      return findTableColumnOptions(
        orderQb,
        { sql: 'o.orderNo', type: 'text' },
        search,
        page,
        pageSize,
        'rel_opt',
      );
    }

    const def = resolveTableColumn(TABLE_COLUMNS, column);
    if (!def) return emptyOptionsPage(page, pageSize);

    const qb = headerQb();
    applyTableFilters(
      qb,
      toFilterPayload(filters),
      TABLE_COLUMNS,
      'col_opt',
      column,
    );
    return findTableColumnOptions(qb, def, search, page, pageSize);
  }

  async findOne(id: string): Promise<{
    header: GarageProcurementRequest;
    lines: GarageProcurementRequestLine[];
  }> {
    const header = await this.headers.findOne({
      where: { id, isDeleted: false },
    });
    if (!header) throw new NotFoundException('Không tìm thấy đề nghị mua');
    const lines = await this.lines.find({
      where: { requestId: id },
      order: { lineNo: 'ASC' },
    });
    return { header, lines };
  }
}
