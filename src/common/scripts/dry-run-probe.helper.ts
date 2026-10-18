/**
 * Hỗ trợ kiểm thử thủ công "dry-run không để lại dấu vết": đếm số dòng các bảng trước/sau khi chạy script.
 */
export type Queryable = { query: (sql: string) => Promise<any> };
export type RowCounts = Record<string, number>;

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;

export async function countRows(
  db: Queryable,
  tables: string[],
): Promise<RowCounts> {
  const counts: RowCounts = {};
  for (const table of tables) {
    if (!IDENTIFIER.test(table)) {
      throw new Error(`Tên bảng không hợp lệ: ${table}`);
    }
    const res = await db.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
    const rows = Array.isArray(res) ? res : res?.rows;
    counts[table] = Number(rows?.[0]?.n ?? 0);
  }
  return counts;
}

export function diffCounts(
  before: RowCounts,
  after: RowCounts,
): Record<string, { before: number; after: number; delta: number }> {
  const out: Record<string, { before: number; after: number; delta: number }> =
    {};
  for (const table of new Set([
    ...Object.keys(before),
    ...Object.keys(after),
  ])) {
    const b = before[table] ?? 0;
    const a = after[table] ?? 0;
    if (a !== b) out[table] = { before: b, after: a, delta: a - b };
  }
  return out;
}
