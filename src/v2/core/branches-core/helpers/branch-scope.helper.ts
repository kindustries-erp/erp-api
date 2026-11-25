import { BadRequestException } from '@nestjs/common';
import type { EntityManager, ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/**
 * Lọc theo chi nhánh ERP khi có chọn: thêm `<alias>.branch_id = :param`. Không có `branchId` thì giữ nguyên
 * (xem mọi chi nhánh, kể cả bản ghi chưa gán chi nhánh). `param` đặt riêng để không đụng tham số khác của query.
 */
export function applyBranchScope<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  branchId?: string | null,
  param = 'scopeBranchId',
): SelectQueryBuilder<T> {
  if (!branchId) return qb;
  return qb.andWhere(`${alias}.branch_id = :${param}`, { [param]: branchId });
}

/** Điều kiện `where` cho `find*`: `{ branchId }` khi có chọn chi nhánh, ngược lại rỗng. */
export function branchWhere(branchId?: string | null): { branchId?: string } {
  return branchId ? { branchId } : {};
}

/**
 * Trước khi ghi `branch_id` lấy từ header: chi nhánh phải tồn tại và chưa xóa, nếu không trả 400
 * (thay vì lỗi FK 500). Không có `branchId` thì bỏ qua.
 */
export async function assertErpBranchExists(
  m: Pick<EntityManager, 'query'>,
  branchId?: string | null,
): Promise<void> {
  if (!branchId) return;
  const rows: unknown[] = await m.query(
    'SELECT 1 FROM branches_management WHERE id = $1 AND is_deleted = false LIMIT 1',
    [branchId],
  );
  if (!rows.length) {
    throw new BadRequestException('Chi nhánh không tồn tại.');
  }
}
