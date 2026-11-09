/** Giới hạn kích thước cấu hình bảng (AC-4). Hào phóng để FE không mất lưu lặng lẽ. */
export const TABLE_PREFERENCE_LIMITS = {
  tableIdMax: 200,
  tableIdPrefixMax: 100,
  customViewsMax: 50,
  orderMax: 300,
  orderItemMax: 100,
  recordKeysMax: 300,
  labelMax: 200,
  keyMax: 100,
} as const;
