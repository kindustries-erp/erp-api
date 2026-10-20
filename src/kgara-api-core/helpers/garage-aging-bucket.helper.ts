/**
 * Khoảng tuổi nợ (ngày) cho bộ lọc `agingBucket` của công nợ phải thu và phải trả.
 * Mỗi giá trị là điều kiện SQL áp lên `(CURRENT_DATE - DATE(ngày hoàn thành))`.
 */
export const GARAGE_AGING_BUCKET_RANGES: Record<string, string> = {
  '0-30': '<= 30',
  '31-60': 'BETWEEN 31 AND 60',
  '61-90': 'BETWEEN 61 AND 90',
  '>90': '> 90',
};
