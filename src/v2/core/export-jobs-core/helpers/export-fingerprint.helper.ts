/** JSON ổn định (khóa sắp xếp) để dựng fingerprint. */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const obj = value as Record<string, unknown>;
  const entries = Object.keys(obj)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`);
  return `{${entries.join(',')}}`;
}

/** Chuẩn hóa chuỗi JSON (column_filters...) về dạng so sánh được. */
export function normalizeJsonString(input?: string): string {
  if (!input) return '';
  try {
    return stableStringify(JSON.parse(input));
  } catch {
    return input.trim();
  }
}
