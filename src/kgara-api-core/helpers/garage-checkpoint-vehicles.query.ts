import type { Repository } from 'typeorm';
import { vehicleKeySql } from '@/common/utils/vehicle-count-sql';
import { CHECKPOINT_CASES_MAX_PAGE_SIZE } from '@/kgara-api-core/dto/garage-checkpoint-cases-query.dto';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { KgaraGrossProfit } from '@/kgara-api-core/entities/kgara_gross_profit.entity';
import {
  FUNNEL_PERIOD_DATE_SQL,
  applyCheckpointCaseFilters,
  type CheckpointCaseFilters,
} from '@/kgara-api-core/helpers/garage-checkpoint-case-filters';
import {
  groupCheckpointCasesByVehicle,
  toCheckpointCaseItem,
  toCheckpointVehicleItem,
  type CheckpointVehicleItem,
} from '@/kgara-api-core/helpers/garage-checkpoint-case-item.mapper';

const VEHICLE_KEY = vehicleKeySql('c', 'bien_so_xe');

/**
 * Biểu thức sắp xếp theo XE (tổng hợp các lệnh của xe), lấy từ whitelist, không nhận input người dùng.
 * Cột tiền sắp theo tổng, cột ngày theo mốc mới nhất, số phiếu theo mã nhỏ nhất.
 */
const VEHICLE_SORT_SQL: Record<string, string> = {
  tienCoThue: 'SUM(COALESCE(c.tien_co_thue, 0))',
  tienDaThanhToan: 'SUM(COALESCE(c.tien_da_thanh_toan, 0))',
  tienConPhaiThanhToan: 'SUM(COALESCE(c.tien_con_phai_thanh_toan, 0))',
  doanhThu: 'SUM(COALESCE(c.doanh_thu, c.tien_co_thue, 0))',
  ngayPhatSinh: 'MAX(c.ngay_phat_sinh)',
  soChungTu: 'MIN(c.so_chung_tu)',
};
const DEFAULT_CHECKPOINT_PAGE_SIZE = 20;
const DEFAULT_SORT_SQL = `MAX(${FUNNEL_PERIOD_DATE_SQL})`;

export interface CheckpointVehiclesParams {
  filters: CheckpointCaseFilters;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
}

export interface CheckpointVehiclesResult {
  items: CheckpointVehicleItem[];
  /** Tổng số XE khớp bộ lọc (không phải số lệnh). */
  total: number;
}

/**
 * Danh sách `checkpoint-cases` gom theo XE: phân trang và `total` tính theo xe, mỗi dòng kèm các lệnh của xe.
 * Cùng bộ lọc với danh sách theo lệnh (`applyCheckpointCaseFilters`) nên khớp thẻ và tab.
 */
export async function listCheckpointVehicles(
  caseRepo: Repository<KgaraCase>,
  params: CheckpointVehiclesParams,
): Promise<CheckpointVehiclesResult> {
  const { filters } = params;
  // Chặn ở tầng truy vấn để lời gọi nội bộ không tải vô hạn (DTO đã chặn ở biên API).
  const page = Number.isFinite(params.page)
    ? Math.max(1, Math.floor(params.page))
    : 1;
  const pageSize = Number.isFinite(params.pageSize)
    ? Math.min(
        CHECKPOINT_CASES_MAX_PAGE_SIZE,
        Math.max(1, Math.floor(params.pageSize)),
      )
    : DEFAULT_CHECKPOINT_PAGE_SIZE;
  const filtered = () =>
    applyCheckpointCaseFilters(
      caseRepo
        .createQueryBuilder('c')
        .leftJoin('erp_module_categories', 'cat', 'cat.id = c.category_id')
        .where('c.kgara_deleted_at IS NULL')
        .andWhere('(c.exclude_from_reports IS NOT TRUE)'),
      filters,
    );

  const totalRow = await filtered()
    .select(`COUNT(DISTINCT ${VEHICLE_KEY})`, 'total')
    .getRawOne<{ total?: unknown }>();
  const total = Number(totalRow?.total) || 0;

  const sortExpr = VEHICLE_SORT_SQL[params.sortBy] ?? DEFAULT_SORT_SQL;
  const keyRows = await filtered()
    .select(VEHICLE_KEY, 'vehicle_key')
    .addSelect(sortExpr, 'sort_value')
    .groupBy(VEHICLE_KEY)
    .orderBy('sort_value', params.sortOrder, 'NULLS LAST')
    .addOrderBy('vehicle_key', 'ASC')
    .offset((page - 1) * pageSize)
    .limit(pageSize)
    .getRawMany<{ vehicle_key: string }>();
  const keys = keyRows.map((row) => row.vehicle_key);
  if (!keys.length) return { items: [], total };

  const rows = await applyCheckpointCaseFilters(
    caseRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.category', 'cat')
      .leftJoinAndMapOne(
        'c.grossProfit',
        KgaraGrossProfit,
        'gp',
        'gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu',
      )
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.exclude_from_reports IS NOT TRUE)')
      .andWhere(`${VEHICLE_KEY} IN (:...keys)`, { keys }),
    filters,
  )
    .orderBy('c.ngayPhatSinh', 'DESC', 'NULLS LAST')
    .addOrderBy('c.ngayHoanThanhCongViec', 'DESC', 'NULLS LAST')
    .addOrderBy('c.createdAt', 'DESC')
    .addOrderBy('c.id', 'DESC')
    .getMany();

  const grouped = groupCheckpointCasesByVehicle(rows.map(toCheckpointCaseItem));
  const items = keys.map((key) =>
    toCheckpointVehicleItem(key, grouped.get(key) ?? []),
  );
  return { items, total };
}
