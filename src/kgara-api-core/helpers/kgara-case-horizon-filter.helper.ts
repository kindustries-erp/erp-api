import { SelectQueryBuilder } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { getHorizonCaseSqlCondition } from './garage-debts-horizon.helper';

/** Cột lọc danh sách phiếu theo mốc tuổi nợ (dùng khi bấm dòng phân loại trong drawer mốc). */
export const AGING_HORIZON_COLUMN = 'agingHorizon';

/** Các mốc tuổi nợ được phép lọc; giá trị khác bị bỏ qua để không chèn SQL tùy ý. */
const ALLOWED_AGING_HORIZONS = [
  'nextWeekDue',
  'nextMonthDue',
  'overdue31To60',
  'overdue61To90',
  'criticalOverdue90Plus',
] as const;

/**
 * Áp dụng bộ lọc mốc tuổi nợ lên truy vấn danh sách phiếu (alias `"case"`).
 * Điều kiện tuổi nợ lấy từ `getHorizonCaseSqlCondition`, nên khớp với thẻ trên dashboard.
 * Nhiều mốc được nối bằng OR. Không có mốc hợp lệ thì không lọc.
 */
export function applyAgingHorizonFilter(
  qb: SelectQueryBuilder<KgaraCase>,
  values: string[],
): void {
  const horizons = values.filter((v) =>
    (ALLOWED_AGING_HORIZONS as readonly string[]).includes(v),
  );
  if (horizons.length === 0) return;

  const conditions = horizons.map((h) =>
    getHorizonCaseSqlCondition(h, '"case"'),
  );
  qb.andWhere(`(${conditions.join(' OR ')})`);
}
