import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpBusinessPartner } from '../entities/erp_business_partner.entity';
import { QueryErpBusinessPartnerDto } from '../dto/query-erp-business-partner.dto';
import {
  partnerCodePrefix,
  storedPartnerType,
} from '../helpers/erp-business-partner-code.helper';
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
  code: { sql: 'e.code', type: 'text' },
  name: { sql: 'e.name', type: 'text' },
  displayName: { sql: 'e.displayName', type: 'text' },
  display_name: { sql: 'e.displayName', type: 'text' },
  partnerType: { sql: 'e.partnerType', type: 'text' },
  partner_type: { sql: 'e.partnerType', type: 'text' },
  taxCode: { sql: 'e.taxCode', type: 'text' },
  tax_code: { sql: 'e.taxCode', type: 'text' },
  phone: { sql: 'e.phone', type: 'text' },
  email: { sql: 'e.email', type: 'text' },
  address: { sql: 'e.address', type: 'text' },
  contactName: { sql: 'e.contactName', type: 'text' },
  contact_name: { sql: 'e.contactName', type: 'text' },
  status: { sql: 'e.status', type: 'status' },
  notes: { sql: 'e.notes', type: 'text' },
};

/** Cột số được cộng vào `summaries` (tổng toàn bộ dòng khớp bộ lọc). */
const SUMMARY_COLUMNS: { key: string; sql: string }[] = [];

/** Cột dùng cho ô tìm kiếm chung (ILIKE, nhiều từ khóa cách nhau bằng dấu `;`). */
// Đúng 7 cột ô tìm kiếm chung của V1 (không gồm loại đối tác, địa chỉ, ghi chú)
const SEARCH_COLUMNS: string[] = [
  'e.code',
  'e.name',
  'e.displayName',
  'e.taxCode',
  'e.phone',
  'e.email',
  'e.contactName',
];

export interface ErpBusinessPartnerPageResult {
  items: ErpBusinessPartner[];
  total: number;
  page: number;
  pageSize: number;
  summaries: Record<string, number>;
}

/** Đọc dữ liệu: lọc, sắp xếp, phân trang, gợi ý giá trị cột và tổng. Chỉ đọc các dòng chưa xóa mềm. */
@Injectable()
export class ErpBusinessPartnerQueryService {
  constructor(
    @InjectRepository(ErpBusinessPartner)
    private readonly repo: Repository<ErpBusinessPartner>,
  ) {}

  async findAll(
    query: QueryErpBusinessPartnerDto,
  ): Promise<ErpBusinessPartnerPageResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Math.min(200, Number(query.pageSize) || 20));
    const qb = this.baseQuery();

    if (query.partnerType) {
      qb.andWhere('e.partnerType = :partnerType', {
        partnerType: query.partnerType,
      });
    }
    if (query.status) {
      qb.andWhere('e.status = :status', { status: query.status });
    }

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

  /**
   * Các mã đã dùng để tính số thứ tự kế tiếp: mã có tiền tố của loại hoặc thuộc loại đó.
   * Không lọc xóa mềm, để số đã dùng không bị cấp lại.
   */
  async findCodesForNextCode(partnerType?: string): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('e')
      .select('e.code', 'code')
      .where('e.code LIKE :prefix', {
        prefix: `${partnerCodePrefix(partnerType)}%`,
      })
      .orWhere('e.partnerType = :partnerType', {
        partnerType: storedPartnerType(partnerType),
      })
      .getRawMany<{ code: string }>();
    return rows.map((row) => row.code);
  }

  /** Gợi ý giá trị của một cột, áp dụng bộ lọc các cột khác và loại đối tác (nếu có). */
  async findColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    filters: unknown,
    partnerType?: string,
  ): Promise<TableOptionsPage> {
    const def = resolveTableColumn(TABLE_COLUMNS, column);
    if (!def) return { items: [], total: 0, next: null };

    const qb = this.baseQuery();
    if (partnerType) {
      qb.andWhere('e.partnerType = :partnerType', { partnerType });
    }
    applyTableFilters(
      qb,
      this.toPayload(filters),
      TABLE_COLUMNS,
      'col_opt',
      column,
    );
    return findTableColumnOptions(qb, def, search, page, pageSize);
  }

  findById(id: string): Promise<ErpBusinessPartner | null> {
    return this.repo.findOne({ where: { id, isDeleted: false } });
  }

  private baseQuery() {
    return this.repo
      .createQueryBuilder('e')
      .where('e.isDeleted = :isDeleted', { isDeleted: false });
  }

  private readFilters(query: QueryErpBusinessPartnerDto): TableFilterPayload {
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
