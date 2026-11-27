/** Ba nguồn công nợ garage được đối soát. */
export const RECONCILE_SOURCES = ['v1', 'v2', 'led'] as const;
export type ReconcileSource = (typeof RECONCILE_SOURCES)[number];

type Num = string | number | null | undefined;
export type ReconcileRow = Record<string, Num> & {
  case_id: string;
  code?: string | null;
};

export interface ReconcileMismatch {
  caseId: string;
  code: string | null;
  /** Chỉ tiêu lệch, ví dụ `bal`, `paid`. */
  field: string;
  values: Record<ReconcileSource, number>;
}

export interface ReconcileResult {
  totals: Record<string, Record<ReconcileSource, number>>;
  mismatches: ReconcileMismatch[];
}

/** Sai số làm tròn chấp nhận được (VND, numeric 2 chữ số thập phân). */
const EPSILON = 0.005;

const num = (v: Num): number => (v === null || v === undefined ? 0 : Number(v));

/**
 * So từng vụ việc theo các chỉ tiêu `fields` (cột `<nguồn>_<chỉ tiêu>`). Vụ thiếu ở một nguồn
 * tính là 0 ở nguồn đó: vụ còn 0 ở V1 mà sổ nợ không có dòng thì vẫn khớp.
 */
export function reconcileRows(
  rows: ReconcileRow[],
  fields: string[],
): ReconcileResult {
  const totals: ReconcileResult['totals'] = {};
  for (const f of fields) totals[f] = { v1: 0, v2: 0, led: 0 };
  const mismatches: ReconcileMismatch[] = [];

  for (const row of rows) {
    for (const field of fields) {
      const values = { v1: 0, v2: 0, led: 0 } as Record<
        ReconcileSource,
        number
      >;
      for (const s of RECONCILE_SOURCES) {
        values[s] = num(row[`${s}_${field}`]);
        totals[field][s] += values[s];
      }
      const max = Math.max(values.v1, values.v2, values.led);
      const min = Math.min(values.v1, values.v2, values.led);
      if (max - min > EPSILON) {
        mismatches.push({
          caseId: row.case_id,
          code: row.code ?? null,
          field,
          values,
        });
      }
    }
  }
  return { totals, mismatches };
}
