/** Làm tròn số thập phân theo số chữ số cho trước (mặc định 3 cho số lượng, 2 cho tiền). */
export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Chuyển giá trị numeric từ PostgreSQL (dạng chuỗi) sang số, rỗng coi là 0. */
export function toNumber(value: string | number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}
