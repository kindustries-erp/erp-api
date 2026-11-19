import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { buildPagination } from '@/common/utils/paginated-result';
import {
  applyListSummaries,
  parseSummaryKeys,
} from '@/common/utils/table-query';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { KgaraGrossProfit } from '@/kgara-api-core/entities/kgara_gross_profit.entity';
import {
  applyCaseListFilters,
  getCaseColumnSelectExpr,
} from '@/kgara-api-core/helpers/kgara-case-filter.helper';
import {
  applyCaseListDefaultOrder,
  applyCaseListSorts,
} from '@/kgara-api-core/helpers/kgara-case-sort.helper';
import type { CaseListResponse } from '../dto/case-list.types';
import { toCaseListItem } from '../helpers/case-list.mapper';
import { CaseListEnrichmentService } from './case-list-enrichment.service';

export interface CaseListFilter {
  branchId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  from?: string;
  to?: string;
  /** JSON `{ cột: [giá trị] }`, cùng định dạng `filtersStr` của V1. */
  columnFilters?: string;
  /** `a,-b`: dấu `-` là giảm dần. */
  sort?: string;
  includeDeleted?: boolean;
  summaryKeys?: string;
}

/** Cột được phép tính `summaries`; SQL lấy từ bản đồ cột của V1, không từ input. */
const SUMMARY_KEYS = [
  'doanhThu',
  'chiPhi',
  'loiNhuan',
  'tienCoThue',
  'tienDaThanhToan',
  'tienConPhaiThanhToan',
  'phaiThuKhachHang',
  'phaiThuBaoHiem',
];

/**
 * Danh sách vụ việc v2. Dùng lại bộ lọc/sắp xếp của V1 (đã có spec) nhưng: lãi gộp nối theo mã chứng từ
 * (bỏ `OR hd_phieu_dich_vu_id` vốn không khớp), không trả `raw_data`, tổng theo trang/lũy kế bằng `applyListSummaries`.
 */
@Injectable()
export class CaseListQueryService {
  constructor(
    @InjectRepository(KgaraCase) private readonly cases: Repository<KgaraCase>,
    private readonly enrichment: CaseListEnrichmentService,
  ) {}

  async findPage(f: CaseListFilter): Promise<CaseListResponse> {
    const page = Math.max(1, Math.floor(f.page ?? 1) || 1);
    const pageSize = Math.min(
      200,
      Math.max(1, Math.floor(f.pageSize ?? 20) || 20),
    );
    const qb = this.baseQuery(f.branchId)
      .leftJoinAndSelect('case.category', 'cat')
      .leftJoinAndMapOne(
        'case.grossProfit',
        KgaraGrossProfit,
        'gp',
        'gp.vuViecCode = case.soChungTu',
      );
    this.applyScope(qb, f);
    applyCaseListFilters(qb, f.columnFilters);
    const sorts = (f.sort ?? '').split(',').filter(Boolean);
    if (sorts.length) applyCaseListSorts(qb, sorts);
    else applyCaseListDefaultOrder(qb);
    // Khóa phụ duy nhất: trang và `summaries` cùng một thứ tự, dòng không lặp giữa các trang.
    qb.addOrderBy('case.id', 'ASC');

    const summaries = await applyListSummaries(qb, {
      columns: SUMMARY_KEYS.map((key) => ({
        key,
        sql: `COALESCE(${getCaseColumnSelectExpr(key)}, 0)`,
      })),
      keys: parseSummaryKeys(f.summaryKeys),
      page,
      pageSize,
      tieBreaker: 'case.id',
    });

    const [rows, total] = await qb
      .take(pageSize)
      .skip((page - 1) * pageSize)
      .getManyAndCount();
    const ids = rows.map((r) => r.id);
    const [sums, linkCounts] = await Promise.all([
      this.enrichment.settlementSums(ids),
      this.enrichment.linkCounts(ids),
    ]);

    return {
      items: rows.map((r) =>
        toCaseListItem(
          r,
          sums.get(r.id),
          linkCounts.get(r.id),
          (r as any).grossProfit,
        ),
      ),
      pagination: buildPagination(page, pageSize, total),
      summaries,
    };
  }

  private baseQuery(branchId: string): SelectQueryBuilder<KgaraCase> {
    return this.cases
      .createQueryBuilder('case')
      .where('case.branchExternalId = :branchId', { branchId });
  }

  private applyScope(qb: SelectQueryBuilder<KgaraCase>, f: CaseListFilter) {
    if (!f.includeDeleted) qb.andWhere('case.kgaraDeletedAt IS NULL');
    if (f.from) {
      const v = f.from.includes('T') ? f.from : `${f.from} 00:00:00`;
      qb.andWhere('case.ngayPhatSinh >= :fromDate', { fromDate: v });
    }
    if (f.to) {
      const v = f.to.includes('T') ? f.to : `${f.to} 23:59:59.999`;
      qb.andWhere('case.ngayPhatSinh <= :toDate', { toDate: v });
    }
    const q = f.search?.trim();
    if (!q) return;
    const asNumber = Number(q.replace(/[,.]/g, ''));
    qb.andWhere(
      new Brackets((b) => {
        b.where('case.soChungTu ILIKE :q', { q: `%${q}%` })
          .orWhere('case.bienSoXe ILIKE :q', { q: `%${q}%` })
          .orWhere('case.khachHangName ILIKE :q', { q: `%${q}%` })
          .orWhere('case.khachHangCode ILIKE :q', { q: `%${q}%` })
          .orWhere('case.hangXeName ILIKE :q', { q: `%${q}%` })
          .orWhere('case.dongXeName ILIKE :q', { q: `%${q}%` });
        if (asNumber > 0) {
          b.orWhere('case.tienCoThue = :qNum', { qNum: asNumber }).orWhere(
            'case.chiPhi = :qNum',
            { qNum: asNumber },
          );
        }
      }),
    );
  }
}
