export type AuditDiff = Record<string, { before: unknown; after: unknown }>;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

/** So sánh hai snapshot, trả về các trường thực sự thay đổi (khóa sắp xếp tăng dần). */
export function buildAuditDiff(
  beforePayload: unknown,
  afterPayload: unknown,
): AuditDiff {
  const before = asRecord(beforePayload);
  const after = asRecord(afterPayload);
  const keys = Array.from(
    new Set([...Object.keys(before), ...Object.keys(after)]),
  ).sort();
  const diff: AuditDiff = {};
  for (const key of keys) {
    const beforeValue = before[key] ?? null;
    const afterValue = after[key] ?? null;
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      diff[key] = { before: beforeValue, after: afterValue };
    }
  }
  return diff;
}
