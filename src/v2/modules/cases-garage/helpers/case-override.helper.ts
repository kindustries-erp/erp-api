/**
 * Cơ chế override v2 trên dữ liệu sync từ KGara (hàm thuần, không đụng DB).
 * - `sourceSnapshot`: giá trị mới nhất sync từ v1 (khóa camelCase, giá trị JSON-safe).
 * - `overrides`: tập khóa field đã sửa ở v2; khóa `_deleted` trên dòng là xóa mềm.
 * Cột hiệu lực của entity luôn là giá trị đang dùng; projector chỉ ghi vào cột khi field không bị override.
 */
type Dict = Record<string, unknown>;
export type OverrideMap = Record<string, true>;

/** Khóa đặc biệt trên dòng: dòng đã bị xóa ở v2, projector không hồi sinh. */
export const OVERRIDE_DELETED = '_deleted';

/** Không đưa vào snapshot (định danh, khóa nối, mốc hệ thống). */
const SNAPSHOT_SKIP = new Set([
  'id',
  'origin',
  'externalId',
  'accountKey',
  'branchExternalId',
  'caseId',
  'createdAt',
  'updatedAt',
]);

/** Giá trị về dạng JSON-safe để lưu snapshot (Date → ISO). */
export function toSnapshotValue(v: unknown): unknown {
  return v instanceof Date ? v.toISOString() : (v ?? null);
}

/** So sánh giá trị đã chuẩn hóa: Date ↔ ISO, số ↔ chuỗi số, null ↔ undefined. */
export function sameValue(a: unknown, b: unknown): boolean {
  const x = toSnapshotValue(a);
  const y = toSnapshotValue(b);
  if (x === y) return true;
  if (x === null || y === null) return false;
  if (typeof x !== typeof y && x !== '' && y !== '') {
    const nx = Number(x);
    const ny = Number(y);
    if (Number.isFinite(nx) && Number.isFinite(ny)) return nx === ny;
  }
  return false;
}

export function hasOverride(overrides: OverrideMap, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(overrides ?? {}, key);
}

/**
 * Tách kết quả map v1 thành `snapshot` (luôn ghi) và `patch` (chỉ field không bị override).
 */
export function applyProjection(
  mapped: Dict,
  overrides: OverrideMap,
): { snapshot: Dict; patch: Dict } {
  const snapshot: Dict = {};
  const patch: Dict = {};
  for (const [k, v] of Object.entries(mapped)) {
    if (!SNAPSHOT_SKIP.has(k)) snapshot[k] = toSnapshotValue(v);
    if (!hasOverride(overrides, k)) patch[k] = v;
  }
  return { snapshot, patch };
}

/**
 * Cập nhật `overrides` sau khi v2 sửa `fields`: field khác snapshot → đánh dấu; trùng lại snapshot → bỏ
 * dấu (coi như về giá trị KGara). Chỉ xét khóa trong `trackedKeys`; khóa v2-native không theo dõi.
 */
export function markOverrides(
  fields: Dict,
  snapshot: Dict,
  overrides: OverrideMap,
  trackedKeys: ReadonlySet<string>,
): OverrideMap {
  const next: OverrideMap = { ...(overrides ?? {}) };
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || !trackedKeys.has(k)) continue;
    if (k in snapshot && sameValue(v, snapshot[k])) delete next[k];
    else next[k] = true;
  }
  return next;
}

/**
 * Về giá trị KGara: trả `{ values, overrides }` với giá trị lấy từ snapshot (khóa không có trong
 * snapshot bị bỏ qua). `dateKeys` là các khóa cần đổi ISO về `Date`.
 */
export function revertFields(
  keys: readonly string[],
  snapshot: Dict,
  overrides: OverrideMap,
  dateKeys: ReadonlySet<string>,
): { values: Dict; overrides: OverrideMap } {
  const values: Dict = {};
  const next: OverrideMap = { ...(overrides ?? {}) };
  for (const k of keys) {
    if (!hasOverride(next, k) || !(k in snapshot)) continue;
    const v = snapshot[k];
    values[k] = dateKeys.has(k) && typeof v === 'string' ? new Date(v) : v;
    delete next[k];
  }
  return { values, overrides: next };
}

/** Danh sách khóa field đã override (không kể `_deleted`) cho response. */
export function overriddenFields(overrides: OverrideMap): string[] {
  return Object.keys(overrides ?? {})
    .filter((k) => k !== OVERRIDE_DELETED)
    .sort();
}

export function isLineDeleted(overrides: OverrideMap): boolean {
  return hasOverride(overrides, OVERRIDE_DELETED);
}
