/**
 * Override của cases-garage: dùng bộ chung `link-override-core`, chỉ giữ phần riêng của module
 * (tập khóa không đưa vào snapshot). Giữ nguyên tên export để các service hiện có không đổi.
 */
import {
  applyProjection as applyLinkProjection,
  type SnapshotSkipKeys,
} from '@/v2/core/link-override-core';

export {
  OVERRIDE_DELETED,
  type OverrideMap,
  hasOverride,
  isLineDeleted,
  markOverrides,
  overriddenFields,
  revertFields,
  sameValue,
  toSnapshotValue,
} from '@/v2/core/link-override-core';

/** Không đưa vào snapshot (định danh, khóa nối, mốc hệ thống). */
export const CASE_SNAPSHOT_SKIP: SnapshotSkipKeys = new Set([
  'id',
  'origin',
  'externalId',
  'accountKey',
  'branchExternalId',
  'caseId',
  'createdAt',
  'updatedAt',
]);

/** Tách kết quả map v1 thành `snapshot` (luôn ghi) và `patch` (chỉ field không bị override). */
export function applyProjection(
  mapped: Record<string, unknown>,
  overrides: Record<string, true>,
): { snapshot: Record<string, unknown>; patch: Record<string, unknown> } {
  return applyLinkProjection(mapped, overrides, CASE_SNAPSHOT_SKIP);
}
