import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseService } from '../entities/kgara_case_service.entity';
import { KgaraBranch } from '../entities/kgara_branch.entity';
import { applyMultiKeywordFilter } from '../../common/utils/query-builder.util';
import {
  getCaseServiceColumnSelectExpr,
  applyCaseServiceFilters,
  applySingleCaseServiceColumnFilter,
} from '../helpers/kgara-case-filter.helper';

@Injectable()
export class KgaraCaseServicesQueryService {
  private readonly logger = new Logger(KgaraCaseServicesQueryService.name);

  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraCaseService)
    private readonly serviceRepo: Repository<KgaraCaseService>,
    @Optional()
    @InjectRepository(KgaraBranch)
    private readonly branchRepo?: Repository<KgaraBranch>,
  ) {}

  /**
   * Truy vấn danh sách chi tiết Hạng mục Dịch vụ & Phụ tùng phân trang có tính tổng và tổng lũy kế
   */
  async findCaseServices(params: {
    branchId?: string;
    page?: number | string;
    pageSize?: number | string;
    q?: string;
    from?: string;
    to?: string;
    serviceType?: string;
    filtersStr?: string;
    sorts?: string | string[];
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    this.logger.log(
      `findCaseServices called: branchId=${params.branchId}, page=${page}, pageSize=${pageSize}, q=${params.q}, serviceType=${params.serviceType}, filtersStr=${params.filtersStr}`,
    );

    const repo =
      this.serviceRepo || this.caseRepo.manager.getRepository(KgaraCaseService);

    const baseQb = repo
      .createQueryBuilder('srv')
      .innerJoin(
        KgaraCase,
        'c',
        'c.hd_phieu_dich_vu_id = srv.hd_phieu_dich_vu_id',
      )
      .leftJoin(KgaraBranch, 'b', 'b.external_id = c.branch_external_id')
      .where('c.kgara_deleted_at IS NULL');

    if (
      params.branchId &&
      params.branchId !== 'null' &&
      params.branchId !== 'undefined' &&
      params.branchId.trim() !== ''
    ) {
      baseQb.andWhere('c.branch_external_id = :branchId', {
        branchId: params.branchId.trim(),
      });
    }

    if (params.serviceType && params.serviceType !== 'ALL') {
      baseQb.andWhere('srv.loai_san_pham_code = :serviceType', {
        serviceType: params.serviceType,
      });
    }

    if (params.from) {
      const fromDate = params.from.includes('T')
        ? params.from
        : `${params.from} 00:00:00`;
      baseQb.andWhere(
        'COALESCE(c.ngay_tiep_nhan, c.ngay_phat_sinh) >= :fromDate',
        { fromDate },
      );
    }

    if (params.to) {
      const toDate = params.to.includes('T')
        ? params.to
        : `${params.to} 23:59:59.999`;
      baseQb.andWhere(
        'COALESCE(c.ngay_tiep_nhan, c.ngay_phat_sinh) <= :toDate',
        { toDate },
      );
    }

    if (params.q) {
      const query = params.q.trim();
      baseQb.andWhere(
        new Brackets((sub) => {
          sub
            .where('srv.san_pham_code ILIKE :q', { q: `%${query}%` })
            .orWhere('srv.san_pham_name ILIKE :q', { q: `%${query}%` })
            .orWhere('srv.noi_dung_chi_tiet ILIKE :q', { q: `%${query}%` })
            .orWhere('c.so_chung_tu ILIKE :q', { q: `%${query}%` })
            .orWhere('c.bien_so_xe ILIKE :q', { q: `%${query}%` })
            .orWhere('c.khach_hang_name ILIKE :q', { q: `%${query}%` })
            .orWhere('c.khach_hang_code ILIKE :q', { q: `%${query}%` });
        }),
      );
    }

    applyCaseServiceFilters(baseQb, params.filtersStr, 'list_');

    // Tính tổng Grand Totals và Total count trước khi áp dụng ORDER BY / LIMIT / OFFSET
    const totalsQb = baseQb.clone();
    totalsQb.orderBy(); // Đảm bảo không có ORDER BY trong câu truy vấn tổng hợp
    totalsQb.select([
      'COUNT(srv.id) AS "totalRows"',
      'COALESCE(SUM(srv.so_luong_hoa_don), 0) AS "soLuongHoaDon"',
      'COALESCE(SUM(srv.tien_chua_thue), 0) AS "tienChuaThue"',
      'COALESCE(SUM(srv.tien_co_thue), 0) AS "tienCoThue"',
      'COALESCE(SUM(srv.tien_dich_vu), 0) AS "tienDichVu"',
      'COALESCE(SUM(srv.tien_phu_tung), 0) AS "tienPhuTung"',
      'COALESCE(SUM(srv.gia_von_phu_tung), 0) AS "giaVonPhuTung"',
      'COALESCE(SUM(srv.tien_chiet_khau_ct), 0) AS "tienChietKhauCt"',
      'COALESCE(SUM(srv.tien_phu_phi), 0) AS "tienPhuPhi"',
    ]);

    const rawTotals = await totalsQb.getRawOne();
    const total = Number(rawTotals?.totalRows || 0);

    const grandTotal = {
      soLuongHoaDon: Number(rawTotals?.soLuongHoaDon || 0),
      tienChuaThue: Number(rawTotals?.tienChuaThue || 0),
      tienCoThue: Number(rawTotals?.tienCoThue || 0),
      tienDichVu: Number(rawTotals?.tienDichVu || 0),
      tienPhuTung: Number(rawTotals?.tienPhuTung || 0),
      giaVonPhuTung: Number(rawTotals?.giaVonPhuTung || 0),
      tienChietKhauCt: Number(rawTotals?.tienChietKhauCt || 0),
      tienPhuPhi: Number(rawTotals?.tienPhuPhi || 0),
    };

    // Sắp xếp cho truy vấn danh sách phân trang
    const sortsArr = Array.isArray(params.sorts)
      ? params.sorts
      : params.sorts
        ? [params.sorts]
        : [];

    if (sortsArr.length > 0) {
      let isFirstSort = true;
      for (const s of sortsArr) {
        if (!s) continue;
        const isDesc = s.startsWith('-');
        const rawCol = isDesc ? s.substring(1) : s;
        const colExpr = getCaseServiceColumnSelectExpr(rawCol);
        if (colExpr) {
          const orderDir = isDesc ? 'DESC' : 'ASC';
          if (isFirstSort) {
            baseQb.orderBy(colExpr, orderDir);
            isFirstSort = false;
          } else {
            baseQb.addOrderBy(colExpr, orderDir);
          }
        }
      }
    } else {
      baseQb
        .orderBy('c.ngay_tiep_nhan', 'DESC', 'NULLS LAST')
        .addOrderBy('c.ngay_phat_sinh', 'DESC', 'NULLS LAST')
        .addOrderBy('c.so_chung_tu', 'DESC')
        .addOrderBy('srv.created_at', 'ASC');
    }

    // Query các bản ghi cho trang hiện tại
    baseQb
      .select([
        'srv.id AS "id"',
        'srv.hd_phieu_dich_vu_chi_tiet_id AS "hdPhieuDichVuChiTietId"',
        'srv.hd_phieu_dich_vu_id AS "hdPhieuDichVuId"',
        'srv.noi_dung_chi_tiet AS "noiDungChiTiet"',
        'srv.san_pham_code AS "sanPhamCode"',
        'srv.san_pham_name AS "sanPhamName"',
        'srv.loai_san_pham_code AS "loaiSanPhamCode"',
        'srv.don_vi_tinh_text AS "donViTinhText"',
        'srv.so_luong_hoa_don AS "soLuongHoaDon"',
        'srv.don_gia AS "donGia"',
        'srv.tien_chua_thue AS "tienChuaThue"',
        'srv.thue_suat AS "thueSuat"',
        'srv.tien_co_thue AS "tienCoThue"',
        'srv.so_gio_cong_lam AS "soGioCongLam"',
        'srv.tien_dich_vu AS "tienDichVu"',
        'srv.tien_phu_tung AS "tienPhuTung"',
        'srv.gia_von_phu_tung AS "giaVonPhuTung"',
        'srv.ty_le_chiet_khau_ct AS "tyLeChietKhauCt"',
        'srv.tien_chiet_khau_ct AS "tienChietKhauCt"',
        'srv.kho_code AS "khoCode"',
        'srv.tien_phu_phi AS "tienPhuPhi"',
        'c.so_chung_tu AS "soChungTu"',
        'c.bien_so_xe AS "bienSoXe"',
        'c.khach_hang_code AS "khachHangCode"',
        'c.khach_hang_name AS "khachHangName"',
        'c.tinh_trang_dich_vu AS "status"',
        'c.ten_tinh_trang_dich_vu AS "statusName"',
        'c.classification AS "classification"',
        'c.branch_external_id AS "branchExternalId"',
        'COALESCE(b.name, b.code, c.branch_external_id) AS "branchName"',
        'TO_CHAR(COALESCE(c.ngay_tiep_nhan, c.ngay_phat_sinh), \'YYYY-MM-DD\') AS "caseDate"',
        'TO_CHAR(c.ngay_hoan_thanh_cong_viec, \'YYYY-MM-DD\') AS "completionDate"',
      ])
      .offset(offset)
      .limit(pageSize);

    const rawRows = await baseQb.getRawMany();

    const data = rawRows.map((r) => ({
      id: r.id,
      hdPhieuDichVuChiTietId: r.hdPhieuDichVuChiTietId,
      hdPhieuDichVuId: r.hdPhieuDichVuId,
      soChungTu: r.soChungTu,
      bienSoXe: r.bienSoXe,
      khachHangCode: r.khachHangCode,
      khachHangName: r.khachHangName,
      caseDate: r.caseDate,
      completionDate: r.completionDate,
      branchExternalId: r.branchExternalId,
      branchName: r.branchName,
      status: Number(r.status ?? 0),
      statusName: r.statusName,
      classification: r.classification,
      sanPhamCode: r.sanPhamCode,
      sanPhamName: r.sanPhamName,
      noiDungChiTiet: r.noiDungChiTiet,
      loaiSanPhamCode: r.loaiSanPhamCode,
      donViTinhText: r.donViTinhText,
      soLuongHoaDon: Number(r.soLuongHoaDon ?? 0),
      donGia: Number(r.donGia ?? 0),
      tienChuaThue: Number(r.tienChuaThue ?? 0),
      thueSuat: Number(r.thueSuat ?? 0),
      tienCoThue: Number(r.tienCoThue ?? 0),
      soGioCongLam: Number(r.soGioCongLam ?? 0),
      tienDichVu: Number(r.tienDichVu ?? 0),
      tienPhuTung: Number(r.tienPhuTung ?? 0),
      giaVonPhuTung: Number(r.giaVonPhuTung ?? 0),
      tyLeChietKhauCt: Number(r.tyLeChietKhauCt ?? 0),
      tienChietKhauCt: Number(r.tienChietKhauCt ?? 0),
      khoCode: r.khoCode,
      tienPhuPhi: Number(r.tienPhuPhi ?? 0),
    }));

    // Tính tổng lũy kế đến hết trang hiện tại
    let cumulative = { ...grandTotal };
    if (page === 1) {
      cumulative = {
        soLuongHoaDon: data.reduce(
          (acc, r) => acc + (Number(r.soLuongHoaDon) || 0),
          0,
        ),
        tienChuaThue: data.reduce(
          (acc, r) => acc + (Number(r.tienChuaThue) || 0),
          0,
        ),
        tienCoThue: data.reduce(
          (acc, r) => acc + (Number(r.tienCoThue) || 0),
          0,
        ),
        tienDichVu: data.reduce(
          (acc, r) => acc + (Number(r.tienDichVu) || 0),
          0,
        ),
        tienPhuTung: data.reduce(
          (acc, r) => acc + (Number(r.tienPhuTung) || 0),
          0,
        ),
        giaVonPhuTung: data.reduce(
          (acc, r) => acc + (Number(r.giaVonPhuTung) || 0),
          0,
        ),
        tienChietKhauCt: data.reduce(
          (acc, r) => acc + (Number(r.tienChietKhauCt) || 0),
          0,
        ),
        tienPhuPhi: data.reduce(
          (acc, r) => acc + (Number(r.tienPhuPhi) || 0),
          0,
        ),
      };
    } else if (page * pageSize < total) {
      try {
        const cumRows = await baseQb
          .clone()
          .select([
            'srv.so_luong_hoa_don AS "soLuongHoaDon"',
            'srv.tien_chua_thue AS "tienChuaThue"',
            'srv.tien_co_thue AS "tienCoThue"',
            'srv.tien_dich_vu AS "tienDichVu"',
            'srv.tien_phu_tung AS "tienPhuTung"',
            'srv.gia_von_phu_tung AS "giaVonPhuTung"',
            'srv.tien_chiet_khau_ct AS "tienChietKhauCt"',
            'srv.tien_phu_phi AS "tienPhuPhi"',
          ])
          .offset(0)
          .limit(page * pageSize)
          .getRawMany();

        cumulative = {
          soLuongHoaDon: cumRows.reduce(
            (acc, r) => acc + (Number(r.soLuongHoaDon) || 0),
            0,
          ),
          tienChuaThue: cumRows.reduce(
            (acc, r) => acc + (Number(r.tienChuaThue) || 0),
            0,
          ),
          tienCoThue: cumRows.reduce(
            (acc, r) => acc + (Number(r.tienCoThue) || 0),
            0,
          ),
          tienDichVu: cumRows.reduce(
            (acc, r) => acc + (Number(r.tienDichVu) || 0),
            0,
          ),
          tienPhuTung: cumRows.reduce(
            (acc, r) => acc + (Number(r.tienPhuTung) || 0),
            0,
          ),
          giaVonPhuTung: cumRows.reduce(
            (acc, r) => acc + (Number(r.giaVonPhuTung) || 0),
            0,
          ),
          tienChietKhauCt: cumRows.reduce(
            (acc, r) => acc + (Number(r.tienChietKhauCt) || 0),
            0,
          ),
          tienPhuPhi: cumRows.reduce(
            (acc, r) => acc + (Number(r.tienPhuPhi) || 0),
            0,
          ),
        };
      } catch (err) {
        this.logger.warn(
          `Failed to calculate cumulative for case services: ${err}`,
        );
      }
    }

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
      totals: {
        grandTotal,
        cumulative,
      },
    };
  }

  /**
   * Lấy danh sách Distinct Filter Options cho cột của Hạng mục Dịch vụ
   */
  async getCaseServiceColumnOptions(
    branchId: string,
    column: string,
    search: string = '',
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
    serviceType?: string,
    date_from?: string,
    date_to?: string,
    date_type?: 'completion_date' | 'case_date',
    classification?: string,
    status?: string,
  ): Promise<{
    items: string[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const colExpr = getCaseServiceColumnSelectExpr(column);
    if (!colExpr) {
      return { items: [], total: 0, page: 1, totalPages: 1 };
    }

    const repo =
      this.serviceRepo || this.caseRepo.manager.getRepository(KgaraCaseService);

    const qb = repo
      .createQueryBuilder('srv')
      .innerJoin(
        KgaraCase,
        'c',
        'c.hd_phieu_dich_vu_id = srv.hd_phieu_dich_vu_id',
      )
      .where('c.kgara_deleted_at IS NULL');

    if (
      branchId &&
      branchId !== 'null' &&
      branchId !== 'undefined' &&
      branchId.trim() !== ''
    ) {
      qb.andWhere('c.branch_external_id = :branchId', {
        branchId: branchId.trim(),
      });
    }

    if (serviceType && serviceType !== 'ALL') {
      qb.andWhere('srv.loai_san_pham_code = :serviceType', {
        serviceType,
      });
    }

    if (classification && classification.trim() !== '') {
      qb.andWhere('c.classification = :classification', {
        classification: classification.trim(),
      });
    }

    if (status && status.trim() !== '' && status.toLowerCase() !== 'all') {
      qb.andWhere('c.tinh_trang_dich_vu = :status', {
        status: Number(status),
      });
    }

    const dateField =
      date_type === 'completion_date'
        ? 'c.ngay_hoan_thanh_cong_viec'
        : 'COALESCE(c.ngay_tiep_nhan, c.ngay_phat_sinh)';

    if (date_from) {
      const fromDate = date_from.includes('T')
        ? date_from
        : `${date_from} 00:00:00`;
      qb.andWhere(`${dateField} >= :fromDate`, { fromDate });
    }

    if (date_to) {
      const toDate = date_to.includes('T')
        ? date_to
        : `${date_to} 23:59:59.999`;
      qb.andWhere(`${dateField} <= :toDate`, { toDate });
    }

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, values] of Object.entries(filters)) {
          if (col === column) continue;
          if (!values || values.length === 0) continue;
          applySingleCaseServiceColumnFilter(qb, col, values, `opt_${col}`);
        }
      } catch {
        // ignore malformed filter JSON
      }
    }

    if (search && search.trim()) {
      applyMultiKeywordFilter(
        qb,
        `CAST(${colExpr} AS TEXT)`,
        search.trim(),
        'col_opt_search',
      );
    }

    qb.select(`DISTINCT CAST(${colExpr} AS TEXT)`, 'val').andWhere(
      `${colExpr} IS NOT NULL AND CAST(${colExpr} AS TEXT) != ''`,
    );

    const countQb = qb.clone();
    countQb.orderBy();
    const countRes = await countQb.getRawMany();
    const total = countRes.length;

    qb.orderBy('val', 'ASC')
      .offset((page - 1) * pageSize)
      .limit(pageSize);

    const rows = await qb.getRawMany();
    const items = rows.map((r) => r.val).filter(Boolean);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }
}
