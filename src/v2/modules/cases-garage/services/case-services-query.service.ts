import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { buildPagination } from '@/common/utils/paginated-result';
import {
  applyListSummaries,
  parseSummaryKeys,
} from '@/common/utils/table-query';
import { KgaraBranch } from '@/kgara-api-core/entities/kgara_branch.entity';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { KgaraCaseService } from '@/kgara-api-core/entities/kgara_case_service.entity';
import {
  applyCaseServiceFilters,
  getCaseServiceColumnSelectExpr,
} from '@/kgara-api-core/helpers/kgara-case-filter.helper';
import type { CaseServicesResponse } from '../dto/case-service-row.types';
import {
  CASE_SERVICE_SELECT,
  toCaseServiceRow,
} from '../helpers/case-service-row.mapper';

export interface CaseServicesFilter {
  branchId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  /** Ngày tiếp nhận (hoặc phát sinh) từ/đến. */
  from?: string;
  to?: string;
  serviceType?: string;
  /** JSON `{ cột: [giá trị] }`, cùng định dạng `filtersStr` của V1. */
  columnFilters?: string;
  /** `a,-b`: dấu `-` là giảm dần. */
  sort?: string;
  summaryKeys?: string;
}

/** Các cột số được phép tính `summaries` (cột SQL cố định, không từ input). */
const SUMMARY_COLUMNS = [
  ['soLuongHoaDon', 'srv.so_luong_hoa_don'],
  ['tienChuaThue', 'srv.tien_chua_thue'],
  ['tienCoThue', 'srv.tien_co_thue'],
  ['tienDichVu', 'srv.tien_dich_vu'],
  ['tienPhuTung', 'srv.tien_phu_tung'],
  ['giaVonPhuTung', 'srv.gia_von_phu_tung'],
  ['tienChietKhauCt', 'srv.tien_chiet_khau_ct'],
  ['tienPhuPhi', 'srv.tien_phu_phi'],
].map(([key, sql]) => ({ key, sql }));

/**
 * Hạng mục dịch vụ và phụ tùng của vụ việc v2. Cùng phạm vi và bộ lọc với V1, trừ join chi nhánh đủ `account_key` (V1 nhân đôi dòng); tổng toàn bộ, tổng trang
 * và lũy kế đều bằng SQL qua `applyListSummaries` (V1 kéo các dòng về rồi cộng bằng JS cho từng trang).
 */
@Injectable()
export class CaseServicesQueryService {
  constructor(
    @InjectRepository(KgaraCaseService)
    private readonly services: Repository<KgaraCaseService>,
  ) {}

  async findPage(f: CaseServicesFilter): Promise<CaseServicesResponse> {
    const page = Math.max(1, Math.floor(f.page ?? 1) || 1);
    const pageSize = Math.min(
      200,
      Math.max(1, Math.floor(f.pageSize ?? 20) || 20),
    );
    const qb = this.baseQuery(f);
    applyCaseServiceFilters(qb, f.columnFilters, 'list_');
    this.applySort(qb, f.sort);
    // Khóa phụ duy nhất: trang và `summaries` cùng một thứ tự, dòng không lặp giữa các trang.
    qb.addOrderBy('srv.id', 'ASC');

    const summaries = await applyListSummaries(qb, {
      columns: SUMMARY_COLUMNS,
      keys: parseSummaryKeys(f.summaryKeys),
      page,
      pageSize,
      tieBreaker: 'srv.id',
    });
    const count = await qb
      .clone()
      .orderBy()
      .select('COUNT(srv.id)', 'total')
      .getRawOne<{ total: string }>();
    const rows = await qb
      .select(CASE_SERVICE_SELECT)
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<Record<string, unknown>>();

    return {
      items: rows.map(toCaseServiceRow),
      pagination: buildPagination(page, pageSize, Number(count?.total) || 0),
      summaries,
    };
  }

  private baseQuery(
    f: CaseServicesFilter,
  ): SelectQueryBuilder<KgaraCaseService> {
    const qb = this.services
      .createQueryBuilder('srv')
      .innerJoin(
        KgaraCase,
        'c',
        'c.hd_phieu_dich_vu_id = srv.hd_phieu_dich_vu_id',
      )
      // Một `external_id` có một dòng chi nhánh cho mỗi `account_key` (MAIN, OJ): phải join đủ hai cột,
      // nếu không mỗi hạng mục bị nhân đôi (lỗi đang có ở V1 `cases/services`).
      .leftJoin(
        KgaraBranch,
        'b',
        'b.external_id = c.branch_external_id AND b.account_key = c.account_key',
      )
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('srv.deleted_at IS NULL')
      .andWhere('c.branch_external_id = :branchId', { branchId: f.branchId });
    if (f.serviceType && f.serviceType !== 'ALL') {
      qb.andWhere('srv.loai_san_pham_code = :serviceType', {
        serviceType: f.serviceType,
      });
    }
    const dateExpr = 'COALESCE(c.ngay_tiep_nhan, c.ngay_phat_sinh)';
    if (f.from) {
      const v = f.from.includes('T') ? f.from : `${f.from} 00:00:00`;
      qb.andWhere(`${dateExpr} >= :fromDate`, { fromDate: v });
    }
    if (f.to) {
      const v = f.to.includes('T') ? f.to : `${f.to} 23:59:59.999`;
      qb.andWhere(`${dateExpr} <= :toDate`, { toDate: v });
    }
    const q = f.search?.trim();
    if (q) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('srv.san_pham_code ILIKE :q', { q: `%${q}%` })
            .orWhere('srv.san_pham_name ILIKE :q', { q: `%${q}%` })
            .orWhere('srv.noi_dung_chi_tiet ILIKE :q', { q: `%${q}%` })
            .orWhere('c.so_chung_tu ILIKE :q', { q: `%${q}%` })
            .orWhere('c.bien_so_xe ILIKE :q', { q: `%${q}%` })
            .orWhere('c.khach_hang_name ILIKE :q', { q: `%${q}%` })
            .orWhere('c.khach_hang_code ILIKE :q', { q: `%${q}%` });
        }),
      );
    }
    return qb;
  }

  private applySort(qb: SelectQueryBuilder<KgaraCaseService>, sort?: string) {
    let first = true;
    for (const part of (sort ?? '').split(',').filter(Boolean)) {
      const desc = part.startsWith('-');
      const expr = getCaseServiceColumnSelectExpr(desc ? part.slice(1) : part);
      if (!expr) continue;
      const dir = desc ? 'DESC' : 'ASC';
      if (first) qb.orderBy(expr, dir);
      else qb.addOrderBy(expr, dir);
      first = false;
    }
    if (!first) return;
    qb.orderBy('c.ngay_tiep_nhan', 'DESC', 'NULLS LAST')
      .addOrderBy('c.ngay_phat_sinh', 'DESC', 'NULLS LAST')
      .addOrderBy('c.so_chung_tu', 'DESC')
      .addOrderBy('srv.created_at', 'ASC');
  }
}
