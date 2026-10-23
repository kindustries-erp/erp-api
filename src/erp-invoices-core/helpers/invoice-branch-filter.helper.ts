import { BadRequestException } from '@nestjs/common';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Chuẩn hóa giá trị lọc chi nhánh từ query: `null`/rỗng → không lọc hoặc `'null'` (chưa gán),
 * UUID hợp lệ → giữ nguyên. Giá trị khác bị từ chối, nên có thể đưa vào SQL an toàn.
 */
export function parseBranchFilter(
  value: string | null | undefined,
): 'null' | string | null {
  if (!value) return null;
  if (value === 'null') return 'null';
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException('branchId không hợp lệ');
  }
  return value;
}

/** Điều kiện SQL lọc theo cột `branch_ids` của `inv`. Chỉ nhận giá trị đã qua `parseBranchFilter`. */
export function branchIdsSqlCondition(filter: 'null' | string): string {
  return filter === 'null'
    ? 'cardinality(inv.branch_ids) = 0'
    : `inv.branch_ids && ARRAY['${filter}']::uuid[]`;
}
