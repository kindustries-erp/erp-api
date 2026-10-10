/**
 * "Bộ nhớ theo người bán": nếu một MST người bán đã có đủ hóa đơn được phân loại và gần như
 * toàn bộ cùng một danh mục thì dùng lại danh mục đó, không cần gọi AI (tiết kiệm token và
 * giảm số hóa đơn rơi vào TK tạm T0003). Phần chọn danh mục chiếm ưu thế là hàm thuần.
 */
export const MEMORY_MIN_SAMPLES = 3;
export const MEMORY_MIN_SHARE = 0.9;

export interface CategoryCountRow {
  category_code: string;
  n: number | string;
}

export interface DominantCategory {
  categoryCode: string;
  count: number;
  total: number;
  share: number;
}

export function pickDominantCategory(
  rows: CategoryCountRow[],
  minSamples: number = MEMORY_MIN_SAMPLES,
  minShare: number = MEMORY_MIN_SHARE,
): DominantCategory | null {
  const counts = rows
    .map((r) => ({ code: r.category_code, n: Number(r.n) }))
    .filter((r) => r.code && Number.isFinite(r.n) && r.n > 0);
  const total = counts.reduce((sum, r) => sum + r.n, 0);
  if (total < minSamples) return null;

  const top = counts.reduce((best, r) => (r.n > best.n ? r : best));
  const share = top.n / total;
  if (share < minShare) return null;

  return { categoryCode: top.code, count: top.n, total, share };
}
