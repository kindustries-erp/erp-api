import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { buildPagination } from '@/common/utils/paginated-result';
import { toMoney } from '@/v2/core/debts-core';
import type {
  GrossProfitReportItem,
  GrossProfitReportResponse,
} from '../dto/gross-profit-report.types';

export interface GrossProfitReportFilter {
  branchId: string;
  /** Lọc theo kỳ báo cáo của dòng lợi nhuận gộp (`report_from >= from`), như V1. */
  from?: string;
  /** Lọc theo kỳ báo cáo của dòng lợi nhuận gộp (`report_to <= to`), như V1. */
  to?: string;
  page?: number;
  pageSize?: number;
}

type Row = Record<string, unknown>;
const num = (v: unknown) => toMoney(v as string | number | null);
const str = (v: unknown) => (typeof v === 'string' ? v : null);
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

/**
 * Báo cáo lợi nhuận gộp theo vụ việc v2. Đi từ `kgara_gross_profit`, nối vụ việc theo mã chứng từ
 * (`vu_viec_code = so_chung_tu`) và CHỈ với vụ việc đang hoạt động: `hd_phieu_dich_vu_id` của hai bảng
 * thuộc hai không gian ID khác nhau nên không dùng để nối, còn mã chỉ duy nhất khi bỏ vụ việc đã xóa.
 * Phân trang và tổng bằng SQL (V1 kéo toàn bộ về rồi cộng bằng JS).
 */
@Injectable()
export class GrossProfitReportService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async getReport(
    f: GrossProfitReportFilter,
  ): Promise<GrossProfitReportResponse> {
    const page = Math.max(1, Math.floor(f.page ?? 1) || 1);
    const pageSize = Math.min(
      200,
      Math.max(1, Math.floor(f.pageSize ?? 20) || 20),
    );

    const params: unknown[] = [f.branchId];
    const conds = ['gp.branch_external_id = $1'];
    if (f.from) {
      params.push(f.from);
      conds.push(`gp.report_from >= $${params.length}`);
    }
    if (f.to) {
      params.push(f.to);
      conds.push(`gp.report_to <= $${params.length}`);
    }
    const where = conds.join(' AND ');
    // Một vụ việc cho mỗi dòng lãi gộp (LATERAL): mã trùng không nhân dòng cả rows lẫn totals.
    const from = `FROM kgara_gross_profit gp
      LEFT JOIN LATERAL (
        SELECT c2.* FROM kgara_cases c2
        WHERE c2.so_chung_tu = gp.vu_viec_code
          AND c2.branch_external_id = gp.branch_external_id
          AND c2.kgara_deleted_at IS NULL
        ORDER BY c2.updated_at DESC, c2.id ASC
        LIMIT 1
      ) c ON true`;

    const [totals, rows] = await Promise.all([
      this.ds.query<Row[]>(
        `SELECT COALESCE(SUM(gp.doanh_thu),0)::numeric AS revenue, COALESCE(SUM(gp.chi_phi),0)::numeric AS cost,
          COALESCE(SUM(gp.loi_nhuan),0)::numeric AS profit, COUNT(*)::int AS cnt
         ${from} WHERE ${where}`,
        params,
      ),
      this.ds.query<Row[]>(
        `SELECT gp.id, gp.created_at, gp.updated_at, gp.vu_viec_code, gp.vu_viec_name, gp.ten_khach_hang,
          gp.doanh_thu, gp.chi_phi, gp.loi_nhuan,
          c.id AS case_id, c.so_chung_tu, c.bien_so_xe, c.khach_hang_name, c.ngay_phat_sinh,
          c.ngay_hoan_thanh_cong_viec, c.ten_tinh_trang_dich_vu
         ${from} WHERE ${where}
         ORDER BY c.ngay_phat_sinh DESC NULLS LAST, gp.updated_at DESC, gp.id ASC
         LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        params,
      ),
    ]);

    const t = totals[0] ?? {};
    const rowCount = Number(t.cnt) || 0;
    return {
      items: rows.map(toItem),
      pagination: buildPagination(page, pageSize, rowCount),
      extraData: {
        totals: {
          revenue: num(t.revenue),
          cost: num(t.cost),
          profit: num(t.profit),
          rowCount,
        },
      },
    };
  }
}

export function toItem(r: Row): GrossProfitReportItem {
  const date = (v: unknown) => (v == null ? null : iso(v));
  return {
    id: str(r.id) ?? '',
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    caseCode: str(r.vu_viec_code),
    caseName: str(r.vu_viec_name),
    customerName: str(r.ten_khach_hang),
    revenue: num(r.doanh_thu),
    cost: num(r.chi_phi),
    profit: num(r.loi_nhuan),
    case:
      r.case_id == null
        ? null
        : {
            id: str(r.case_id) ?? '',
            soChungTu: str(r.so_chung_tu) ?? '',
            bienSoXe: str(r.bien_so_xe),
            khachHangName: str(r.khach_hang_name),
            ngayPhatSinh: date(r.ngay_phat_sinh),
            ngayHoanThanhCongViec: date(r.ngay_hoan_thanh_cong_viec),
            tenTinhTrangDichVu: str(r.ten_tinh_trang_dich_vu),
          },
  };
}
