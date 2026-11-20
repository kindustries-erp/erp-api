import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { quotationStatusSql } from './kgara-case-filter.helper';

/** Phiếu còn mở: chưa hoàn thành và chưa hủy (tinh_trang_dich_vu = 9). */
export const OPEN_CASE_SQL =
  '(c.ngay_hoan_thanh_cong_viec IS NULL AND (c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9))';

/** Phiếu đã hoàn thành và không hủy. */
const COMPLETED_CASE_SQL =
  '(c.ngay_hoan_thanh_cong_viec IS NOT NULL AND (c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9))';

/** Mốc ngày kỳ của chế độ phễu: hoàn thành, rồi phát sinh, rồi tạo. */
export const FUNNEL_PERIOD_DATE_SQL =
  'COALESCE(c.ngay_hoan_thanh_cong_viec, c.ngay_phat_sinh, c.created_at)';

export interface CheckpointCaseFilters {
  dateFrom: string;
  /** Đã bao trọn cuối ngày (`YYYY-MM-DD 23:59:59.999`). */
  effectiveDateTo: string;
  isFunnelMode: boolean;
  status?: string;
  search?: string;
  paymentStatus?: 'all' | 'remaining' | 'paid' | 'unpaid';
  classification?: string;
}

/** Điều kiện SQL theo phân loại ERP (cần join `erp_module_categories` với alias `cat`). */
function classificationSql(classification: string): string | null {
  switch (classification) {
    case 'SUA_CHUA_CHUNG':
      return "COALESCE(cat.code, c.classification) = 'SUA_CHUA_CHUNG'";
    case 'KY_GUI_NOI_BO':
      return "COALESCE(cat.code, c.classification) IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO')";
    case 'OJ_NGOAI':
      return "COALESCE(cat.code, c.classification) IN ('OJ', 'OJ_NGOAI')";
    case 'KHAC':
      return "(COALESCE(cat.code, c.classification) IS NULL OR COALESCE(cat.code, c.classification) NOT IN ('SUA_CHUA_CHUNG', 'KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO', 'OJ', 'OJ_NGOAI'))";
    default:
      return null;
  }
}

/**
 * Áp bộ lọc kỳ, giai đoạn, tìm kiếm, tiến độ nợ và phân loại của `checkpoint-cases` lên query builder
 * `kgara_cases` (alias `c`, đã join `cat`). Dùng chung cho danh sách theo lệnh và theo xe.
 */
export function applyCheckpointCaseFilters<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  f: CheckpointCaseFilters,
): SelectQueryBuilder<T> {
  const quotation = quotationStatusSql('c');

  if (f.isFunnelMode) {
    qb.andWhere(`${FUNNEL_PERIOD_DATE_SQL} >= :dateFrom`, {
      dateFrom: f.dateFrom,
    }).andWhere(`${FUNNEL_PERIOD_DATE_SQL} <= :dateTo`, {
      dateTo: f.effectiveDateTo,
    });

    if (f.status === 'quotation') {
      qb.andWhere(`(${OPEN_CASE_SQL} AND ${quotation})`);
    } else if (f.status === 'in_progress') {
      qb.andWhere(`(${OPEN_CASE_SQL} AND NOT (${quotation}))`);
    } else if (f.status === 'completed') {
      qb.andWhere(COMPLETED_CASE_SQL);
    } else if (f.status === 'cancelled') {
      qb.andWhere('c.tinh_trang_dich_vu = 9');
    }
  } else {
    qb.andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
      .andWhere('c.ngay_hoan_thanh_cong_viec IS NOT NULL')
      .andWhere('c.ngay_hoan_thanh_cong_viec >= :dateFrom', {
        dateFrom: f.dateFrom,
      })
      .andWhere('c.ngay_hoan_thanh_cong_viec <= :dateTo', {
        dateTo: f.effectiveDateTo,
      });
  }

  if (f.search && f.search.trim()) {
    qb.andWhere(
      '(c.so_chung_tu ILIKE :search OR c.bien_so_xe ILIKE :search OR c.khach_hang_name ILIKE :search OR c.khach_hang_code ILIKE :search)',
      { search: `%${f.search.trim()}%` },
    );
  }

  if (f.paymentStatus === 'remaining') {
    qb.andWhere('COALESCE(c.tien_con_phai_thanh_toan, 0) > 0');
  } else if (f.paymentStatus === 'paid') {
    qb.andWhere(
      'COALESCE(c.tien_con_phai_thanh_toan, 0) <= 0 AND COALESCE(c.tien_da_thanh_toan, 0) > 0',
    );
  } else if (f.paymentStatus === 'unpaid') {
    qb.andWhere('COALESCE(c.tien_da_thanh_toan, 0) <= 0');
  }

  if (f.classification && f.classification !== 'ALL') {
    const cond = classificationSql(f.classification);
    if (cond) qb.andWhere(cond);
  }

  return qb;
}
